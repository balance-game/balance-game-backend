import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Block, WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
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
import { WebSocket } from 'ws';

type NewGameEventArgs = NewGameEvent.OutputTuple & NewGameEvent.OutputObject;
type NewVoteEventArgs = NewVoteEvent.OutputTuple & NewVoteEvent.OutputObject;
type NewWinnerEventArgs = NewWinnerEvent.OutputTuple & NewWinnerEvent.OutputObject;
type ClaimPoolEventArgs = ClaimPoolEvent.OutputTuple & ClaimPoolEvent.OutputObject;

/**
 * 
 * 2025-09-07 Memo
 * ClaimPool 이벤트 완성하고 테스트하기
 * 
 */

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: WebSocketProvider;
  private contract: BalanceGame;
  private rpcUrl: string;
  private reconnectDelay = 3000;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GameWinner)
    private readonly gameWinnerRepo: Repository<GameWinner>,
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

    this.rpcUrl = rpcUrl;

    this.connectNetwork();
    await this.smartContractConnect(contractAddress);
    this.listenToEvents();
    await this.recoverEvents();
  }

  // 스마트 컨트랙트 연결
  private async smartContractConnect(contractAddress: string): Promise<void> {
    this.contract = BalanceGame__factory.connect(contractAddress, this.provider);
    if (await this.provider.getCode(await this.contract.getAddress()) === "0x") {
      throw new Error("Not Found Contract");
    }
  }

  // 네트워크 연결
  private connectNetwork(): void {
    this.provider = new WebSocketProvider(this.rpcUrl);
    const ws = this.provider.websocket as WebSocket;

    ws.on("close", (code: number) => {
      console.error(`WS closed with code ${code}, reconnecting in ${this.reconnectDelay / 1000}s...`);
      this.reconnectNetwork();
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
      this.reconnectNetwork();
    });
  }

  // 네트워크 재연결
  private reconnectNetwork(): void {
    setTimeout(async () => {
      // 재연결 및 복구
      this.provider = new WebSocketProvider(this.rpcUrl);
      await this.smartContractConnect(await this.contract.getAddress());
      this.listenToEvents();
      await this.recoverEvents();
      console.log("Reconnected to WS:", this.rpcUrl);
    }, this.reconnectDelay);
  }

  // 이벤트 복구
  async recoverEvents(): Promise<void> {
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
    let claimPoolDB: Partial<GameWinner>[] = [];

    let lastEventName;

    for (const filter of eventFilters) {
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
      if (events.length === 0) continue;
      for (const event of events) {
        // 배열에 이벤트 수집
        switch (event.eventName) {
          case "NewGame": {
            const args = event.args as NewGameEventArgs;
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
            const args = event.args as NewVoteEventArgs;
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
            const [gameId, winners] = event.args as NewWinnerEventArgs;
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
            const args = event.args as ClaimPoolEventArgs;
            const newClaimPoolUser = await this.userRepo.findOne({ where : { address: args.claimAddress }});

            if (!newClaimPoolUser) {
              throw new Error("ClaimPoolSaveError: unknown Address" + args.claimAddress);
            }
            
            claimPoolDB.push({
              gameId: args.gameId.toString(),
              userId: newClaimPoolUser.id,
              rank: Number(args.winnerRank),
              claimPool: args.amount.toString(),
              isClaimed: true
            });

            break;
          }
        }

        lastEventName = event.eventName;
      }

      // 이벤트별 DB 저장
      await this.saveEventInDB(lastEventName, gamesDB, votesDB, winnersDB, claimPoolDB, latestBlock!);
    }

    this.logger.log("Event Recovering Finish");
  }

  // 이벤트 저장
  private async saveEventInDB(
    lastEventName: string,
    gamesDB: Partial<Game>[] = [],
    votesDB: Partial<Vote>[] = [],
    winnersDB: Partial<GameWinner>[] = [],
    claimPoolDB: Partial<GameWinner>[] = [],
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
          await queryRunner.manager.upsert(GameWinner, claimPoolDB, ["gameId", "userId"]);

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
  listenToEvents(): void {
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

    this.contract.on(this.contract.getEvent("ClaimPool"), async(...args) => {
      const event = args[args.length -1] as NewWinnerEvent.Log;
      if (!event) {
        return;
      }
      await handleNewWinner(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });
  }

  // 마지막 블록번호 저장
  async saveBlockNumber(
    blockNumber: string, 
    queryRunner: QueryRunner
  ): Promise<void> {
    const network = await this.contract.runner!.provider!.getNetwork();
    await queryRunner.manager.upsert(Blockchain, {
        chainId: network.chainId.toString(),
        chainName: network.name,
        lastBlockNumber: blockNumber
    }, ['chainId']);
  }
}
