import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, MoreThan, QueryRunner, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { BalanceGame } from './typechain-types';

// TypeChain 추후 분리 예정
import { BalanceGame__factory } from './typechain-types';

import { Blockchain } from './entity/blockchain.entity';
import { NewGameEvent, NewVoteEvent } from './typechain-types/contracts/BalanceGame';
import { handleNewGame } from './util/event/handleNewGame';
import { handleNewVote } from './util/event/handleNewVote';
import { Vote } from 'src/game/entity/vote.entity';
import { User } from 'src/auth/entity/user.entity';
import { VoteOption } from 'src/game/enum/vote-option.enum';
import { TypedContractEvent, TypedDeferredTopicFilter } from './typechain-types/common';

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
    let fromBlock;
    const toBlock = "latest";

    type BalanceGameContractEventFilter =
  | TypedContractEvent<NewGameEvent.InputTuple, NewGameEvent.OutputTuple, NewGameEvent.OutputObject>
  | TypedContractEvent<NewVoteEvent.InputTuple, NewVoteEvent.OutputTuple, NewVoteEvent.OutputObject>;

    const eventFilters: TypedDeferredTopicFilter<BalanceGameContractEventFilter>[] = [
      this.contract.filters.NewGame(),
      this.contract.filters.NewVote(),
    ];

    // 현재 네트워크 한개로 고정
    const chainInfoInDB = await this.blockChainRepo.findOne({ where: {} });
    const latestBlock = await this.contract.runner!.provider!.getBlock("latest");

    if (chainInfoInDB) {
      fromBlock = BigInt(chainInfoInDB.lastBlockNumber);
    }
    else {
      fromBlock = 0;
    }
    
    this.logger.log(`Event Recovering BlockNumber from ${fromBlock} to ${latestBlock!.number}`);

    let games: Partial<Game>[] = [];
    let votes: Partial<Vote>[] = [];
    for (const filter of eventFilters) {
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
      for (const event of events) {
        switch (event.eventName) {
          case "NewGame": {
            const args = event.args as NewGameEvent.OutputTuple & NewGameEvent.OutputObject;
            const newGameUser = await this.userRepo.findOne({ where : { address: args.creator }});

            if (!newGameUser) {
              throw new Error("VoteSaveError: unknown Address" + args.creator);
            }
            
            games.push({
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
            votes.push({
              gameId: args.gameId.toString(),
              userId: newVoteUser.id,
              option: Number(args.voteOpttion) == 0 ? VoteOption.A : VoteOption.B,
              votedAt: new Date(Number(args.votedAt) * 1000),
            });

            break;
          }
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let game = queryRunner.manager.create(Game, games);
      let vote = queryRunner.manager.create(Vote, votes);
      await queryRunner.manager.upsert(Game, games, ["id"]);
      await queryRunner.manager.upsert(Vote, votes, ["gameId", "userId"]);

      await this.saveBlockNumber(latestBlock!.number.toString(), queryRunner);
      this.logger.log("Event Recovering Success");

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
  }
  
  // 1분에 한번씩 온체인 데이터 반영
  @Cron('* * * * *')
  async getVoteCountFromOnchain() {
    const now = new Date();

    const gameList = await this.gameRepo.find({
      where: {
        deadline: MoreThan(now),
      }
    });

    for(const game of gameList) {
      try {
        const gameInfo = await this.contract.findGameById(game.id);
        
        game.voteCountA = gameInfo[4].toString();
        game.voteCountB = gameInfo[5].toString();
        await this.gameRepo.save(game);
      } catch(err) {
        console.error("온체인 데이터 반영 실패" + err);
      }
    }
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
