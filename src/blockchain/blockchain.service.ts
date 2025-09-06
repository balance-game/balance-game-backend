import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Block, WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, In, LessThan, MoreThan, QueryRunner, Repository } from 'typeorm';
import { BalanceGame } from './typechain-types';

// TypeChain 추후 분리 예정
import { BalanceGame__factory } from './typechain-types';

import { Blockchain } from './entity/blockchain.entity';
import { ClaimPoolEvent, NewGameEvent, NewVoteEvent, NewWinnerEvent } from './typechain-types/contracts/BalanceGame';
import { handleNewGame } from './event/handleNewGame';
import { handleNewVote } from './event/handleNewVote';
import { Vote } from 'src/game/entity/vote.entity';
import { User } from 'src/auth/entity/user.entity';
import { VoteOption } from 'src/game/enum/vote-option.enum';
import { TypedContractEvent, TypedDeferredTopicFilter } from './typechain-types/common';
import { handleNewWinner } from './event/handleNewWinner';
import { GameWinner } from 'src/game/entity/game-winner.entity';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: WebSocketProvider;
  private contract: BalanceGame;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Blockchain)
    private readonly blockChainRepo: Repository<Blockchain>,
    private readonly dataSource: DataSource
  ) {}

  private readonly logger = new Logger(BlockchainService.name);
  
  async onModuleInit() {
    const contractAddress = this.configService.get<string>("CONTRACT_ADDRESS");
    const rpcUrl = this.configService.get<string>("RPC_URL_WS"); 
    
    if (!contractAddress || !rpcUrl) {
      throw new Error('Missing CONTRACT_ADDRESS or RPC_URL_WS in env');
    }

    try {
      this.provider = new WebSocketProvider(rpcUrl);
      this.contract = BalanceGame__factory.connect(
        contractAddress,
        this.provider
      );
    } catch(err) {
      console.error(err);
      throw new Error("Connection failed to contract");
    }

    await this.recoverEvents();
    this.listenToEvents();
  }

  // 이벤트 복구
  async recoverEvents() {
    let fromBlock: number;
    const toBlock = "latest";

    type BalanceGameContractEventFilter =
  | TypedContractEvent<NewGameEvent.InputTuple, NewGameEvent.OutputTuple, NewGameEvent.OutputObject>
  | TypedContractEvent<NewVoteEvent.InputTuple, NewVoteEvent.OutputTuple, NewVoteEvent.OutputObject>
  | TypedContractEvent<NewWinnerEvent.InputTuple, NewWinnerEvent.OutputTuple, NewWinnerEvent.OutputObject>
  | TypedContractEvent<ClaimPoolEvent.InputTuple, ClaimPoolEvent.OutputTuple, ClaimPoolEvent.OutputObject>;

    const eventFilters: TypedDeferredTopicFilter<BalanceGameContractEventFilter>[] = [
      this.contract.filters.NewGame(),
      this.contract.filters.NewVote(),
      this.contract.filters.NewWinner(),
      this.contract.filters.ClaimPool()
    ];

    // 현재 네트워크 한개로 고정
    const chainInfoInDB = await this.blockChainRepo.findOne({ where: {} });
    const latestBlock = await this.contract.runner!.provider!.getBlock("latest");

    if (chainInfoInDB) {
      fromBlock = Number(chainInfoInDB.lastBlockNumber);
    }
    else {
      fromBlock = Number(this.configService.get<String>("CONTRACT_DEPLOY_BLOCK_NUMBER"));
    }
    
    this.logger.log(`Event Recovering BlockNumber from ${fromBlock} to ${latestBlock!.number}`);

    let gamesDB: Partial<Game>[] = [];
    let votesDB: Partial<Vote>[] = [];
    let winnersDB: Partial<GameWinner>[] = [];

    let lastEventName;

    for (const filter of eventFilters) {
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
      if (events.length === 0) continue;
      for (const event of events) {
        // 배열에 이벤트 수집
        switch (event.eventName) {
          case "NewGame": {
            const args = event.args as NewGameEvent.OutputTuple & NewGameEvent.OutputObject;
            const newGameUser = await this.userRepo.findOne({ where : { address: args.creator }});

            if (!newGameUser) {
              throw new Error("VoteSaveError: unknown Address" + args.creator);
            }
            
            gamesDB.push({
              id: args.gameId.toString(),
              optionA: args.questionA,
              optionB: args.questionB,
              createdAt: new Date(Number(args.createdAt) * 1000),
              deadline: new Date(Number(args.deadline) * 1000),
              createdBy: newGameUser.id
            });

            break;
          }
          case "NewVote": {
            const args = event.args as NewVoteEvent.OutputTuple & NewVoteEvent.OutputObject;
            const newVoteUser = await this.userRepo.findOne({ where : { address: args.votedAddress }});

            if (!newVoteUser) {
              throw new Error("VoteSaveError: unknown Address" + args.votedAddress);
            }
            votesDB.push({
              gameId: args.gameId.toString(),
              userId: newVoteUser.id,
              option: Number(args.voteOption) == 0 ? VoteOption.A : VoteOption.B,
              votedAt: new Date(Number(args.votedAt) * 1000),
            });

            break;
          }
          case "NewWinner": {
            const [gameId, winners] = event.args as NewWinnerEvent.OutputTuple & NewVoteEvent.OutputObject;
            const users = await this.userRepo.find({ where: { address: In(winners) }});
            const sortedUsers = winners.map(addr => users.find(u => u.address === addr));
            
            for(let i = 0; i < winners.length; i++) {
              if (!sortedUsers[i]) {
                this.logger.warn("GameWinnerSaveError: unknown Address " + sortedUsers[i]);
                continue;
              }
              winnersDB.push({
                gameId: gameId.toString(),
                userId: sortedUsers[i]!.id,
                rank: i + 1
              });
            }

            break;
          }
          case "ClaimPool": {
            break;
          }
        }

        lastEventName = event.eventName;
      }

      // 이벤트별 DB 저장
      await this.saveEventInDB(lastEventName, gamesDB, votesDB, winnersDB, latestBlock!);
    }

    this.logger.log("Event Recovering Finish")
  }

  async saveEventInDB(
    lastEventName: string,
    gamesDB: Partial<Game>[] = [],
    votesDB: Partial<Vote>[] = [],
    winnersDB: Partial<GameWinner>[] = [],
    latestBlock: Block
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // DB 반영
      switch(lastEventName) {
        case "NewGame": {
          await queryRunner.manager.upsert(Game, gamesDB, ["id"]);

          break;
        }
        case "NewVote": {
          await queryRunner.manager.upsert(Vote, votesDB, ["gameId", "userId"]);

          break;
        }
        case "NewWinner": {
          await queryRunner.manager.upsert(GameWinner, winnersDB, ["gameId", "userId"]);

          break;
        }
        case "ClaimPool": {
          break;
        }
      }

      await this.saveBlockNumber(latestBlock!.number.toString(), queryRunner);
      this.logger.log(`${lastEventName} Recovering Success`);
      await queryRunner.commitTransaction();
    } catch(err) {
      console.error(err);
      await queryRunner.rollbackTransaction();
      throw new Error("이벤트 복구중 오류가 발생했습니다.");
    } finally {
      await queryRunner.release();
    }
  }

  // 블록체인 이벤트 등록
  listenToEvents() {
    this.contract.on(this.contract.getEvent("NewGame"), async (...args) => {
      const event = args[args.length - 1] as NewGameEvent.Log;
      if (!event) {
        return;
      }
      await handleNewGame(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });

    this.contract.on(this.contract.getEvent("NewVote"), async (...args) => {
      const event = args[args.length - 1] as NewVoteEvent.Log;
      if (!event) {
        return;
      }
      await handleNewVote(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });

    this.contract.on(this.contract.getEvent("NewWinner"), async(...args) => {
      const event = args[args.length -1] as NewWinnerEvent.Log;
      if (!event) {
        return;
      }
      await handleNewWinner(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });
  }

  // 마지막 블록번호 저장
  async saveBlockNumber(blockNumber: string, queryRunner: QueryRunner) {
    const network = await this.contract.runner!.provider!.getNetwork();
    await queryRunner.manager.upsert(Blockchain, {
        chainId: network.chainId.toString(),
        chainName: network.name,
        lastBlockNumber: blockNumber
    }, ['chainId']);
  }
}
