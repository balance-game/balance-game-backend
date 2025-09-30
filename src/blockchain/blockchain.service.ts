import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Block, JsonRpcProvider, Signer, WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { BalanceGame } from './typechain-types';
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
import { handleClaimPool } from './event/handleClaimPool';

type NewGameEventArgs = NewGameEvent.OutputTuple & NewGameEvent.OutputObject;
type NewVoteEventArgs = NewVoteEvent.OutputTuple & NewVoteEvent.OutputObject;
type NewWinnerEventArgs = NewWinnerEvent.OutputTuple & NewWinnerEvent.OutputObject;
type ClaimPoolEventArgs = ClaimPoolEvent.OutputTuple & ClaimPoolEvent.OutputObject;

/**
 * @TODO
 * 이벤트 복구하는 부분에서 
 * arg(readonly) 객체안에 있는 지갑주소 부분 소문자로 바꾸는 코드 추가해야됨 
 * 
 * DB 옵션 변경 or DB 변경시 대소문자 문제로 유저/게임이 조회되지 않아서 오류 날 수도 있음
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GameWinner)
    private readonly gameWinnerRepo: Repository<GameWinner>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Blockchain)
    private readonly blockChainRepo: Repository<Blockchain>,
    @Inject("BLOCKCHAIN_CONNECTION")
    private readonly blockchainProvider: {
      contractAddress: string,
      httpProvider: JsonRpcProvider, 
      webSocketProvider: WebSocketProvider,
      httpContract: BalanceGame,
      webSocketContract: BalanceGame,
      ownerWallet: Signer
    },
    private readonly dataSource: DataSource
  ) {}

  private readonly logger = new Logger(BlockchainService.name);
  
  async onModuleInit() {
    this.listenToEvents();
    await this.recoverEvents();
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
      this.blockchainProvider.httpContract.filters.NewGame(),
      this.blockchainProvider.httpContract.filters.NewVote(),
      this.blockchainProvider.httpContract.filters.NewWinner(),
      this.blockchainProvider.httpContract.filters.ClaimPool()
    ];

    // 현재 네트워크 한개로 고정
    const chainInfoInDB = await this.blockChainRepo.findOne({ where: {} });
    const latestBlock = await this.blockchainProvider.httpContract.runner!.provider!.getBlock("latest");

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

    /**
     * @TODO
     * 나눠서 조회 하는 방식으로 변경 해야됨
     */
    for (const filter of eventFilters) {
      const events = await this.blockchainProvider.httpContract.queryFilter(filter, fromBlock, toBlock);
      if (events.length === 0) continue;
      for (const event of events) {
        // 배열에 이벤트 수집
        switch (event.eventName) {
          case "NewGame": {
            const args = event.args as NewGameEventArgs;
            const creator = args.creator.toLowerCase();
            const newGameUser = await this.userRepo.findOne({ where : { address: creator }});

            if (!newGameUser) {
              throw new Error("VoteSaveError: unknown Address" + creator);
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
            const votedAddress = args.votedAddress.toLocaleLowerCase();
            const newVoteUser = await this.userRepo.findOne({ where : { address: votedAddress }});

            if (!newVoteUser) {
              throw new Error("VoteSaveError: unknown Address" + votedAddress);
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
            const sortedUsers = winners.map(addr => users.find(u => u.address === addr.toLocaleLowerCase()));
            
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
            const claimAddress = args.claimAddress.toLocaleLowerCase();
            const newClaimPoolUser = await this.userRepo.findOne({ where : { address: claimAddress }});

            if (!newClaimPoolUser) {
              throw new Error("ClaimPoolSaveError: unknown Address" + claimAddress);
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
    const wsc = this.blockchainProvider.webSocketContract

    wsc.on(wsc.filters.NewGame(), async (...args) => {
      const event = args[args.length - 1] as NewGameEvent.Log;
      if (!event) {
        return;
      }
      await handleNewGame(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });

    wsc.on(wsc.filters.NewVote(), async (...args) => {
      const event = args[args.length - 1] as NewVoteEvent.Log;
      if (!event) {
        return;
      }
      await handleNewVote(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });

    wsc.on(wsc.filters.NewWinner(), async(...args) => {
      const event = args[args.length -1] as NewWinnerEvent.Log;
      if (!event) {
        return;
      }
      await handleNewWinner(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });

    wsc.on(wsc.filters.ClaimPool(), async(...args) => {
      const event = args[args.length -1] as ClaimPoolEvent.Log;
      if (!event) {
        return;
      }
      await handleClaimPool(event, this.dataSource, this.logger, this.saveBlockNumber.bind(this));
    });
  }

  // 마지막 블록번호 저장
  async saveBlockNumber(
    blockNumber: string, 
    queryRunner: QueryRunner
  ): Promise<void> {
    const network = await this.blockchainProvider.httpContract.runner!.provider!.getNetwork();
    await queryRunner.manager.upsert(Blockchain, {
        chainId: network.chainId.toString(),
        chainName: network.name,
        lastBlockNumber: blockNumber
    }, ['chainId']);
  }
}
