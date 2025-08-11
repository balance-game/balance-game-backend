import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { Vote } from 'src/game/entity/vote.entity';
import { VoteOption } from 'src/game/enum/vote-option.enum';
import { Cron } from '@nestjs/schedule';
import { BalanceGame } from './typechain-types';

// TypeChain 추후 분리 예정
import { BalanceGame__factory } from './typechain-types';

/**
 *
 * 2025-08-05 Memo
 * 1. 좋아요 내가 좋아요 누른건지 구별하는 칼럼 반환하도록 수정하기 O
 * 2. DB에 게임정보 저장하도록 하기 (blockchain) O 
 * 3. 투표한 사람 정보 저장 (blockchain) O
 * 4. 내 정보 반환할때 투표 및 상대방 조회기능도 만들기 O
 * 5. 백엔드 API 업데이트 하기 
 * 6. Redis 캐시화 하기 
 * 7. Nest 배치로 주기적으로 조회하기
 * 8. 서버 꺼졌을때 이벤트 복구 기능
 * 
 */

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
    private readonly dataSource: DataSource
  ) {}

  private readonly logger = new Logger(BlockchainService.name);
  
  async onModuleInit() {
    const contractAddress = this.configService.get<string>("CONTRACT_ADDRESS");
    const rpcUrl = this.configService.get<string>("RPC_URL_WS"); 
    
    if (!contractAddress || !rpcUrl) {
      throw new Error('Missing CONTRACT_ADDRESS or RPC_URL_WS in env');
    }

    this.provider = new WebSocketProvider(rpcUrl);
    this.contract = BalanceGame__factory.connect(
      contractAddress,
      this.provider
    );

    this.listenToEvents();
  }

  listenToEvents() {
    this.contract.on(this.contract.getEvent("NewGame"), async (gameId, questionA, questionB, deadline, creator) => {
      const deadlineToDate = new Date(Number(deadline) * 1000);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const user = await this.userRepo.findOne({
          where: { address: creator },
          select: { id: true }
        });

        if (!user) {
          this.logger.warn("GameSaveError: unknown Address " + creator);
        }
        else {
          // const game = this.gameRepo.create({
          //   id: gameId,
          //   optionA: questionA,
          //   optionB: questionB,
          //   deadline: deadlineToDate,
          //   createdBy: user.id
          // });

          // this.gameRepo.save(game);
          // this.logger.log("GameSaveSuccess: GameId " + gameId);
        }

        await queryRunner.commitTransaction();
      } catch(err) {
        await queryRunner.rollbackTransaction();
        console.error(err);
        throw new InternalServerErrorException("게임정보 저장중 오류가 발생했습니다.");
      }
    });

    this.contract.on(this.contract.getEvent("NewVote"), async (gameId, address, voteOpttion) => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const user = await queryRunner.manager.findOne(User, { 
          where: { address: address }
        });

        if (!user) {
          this.logger.warn("VoteSaveError: unknown Address " + address);
        }
        else {
          // const vote = queryRunner.manager.create(Vote, {
          //   gameId: gameId,
          //   userId: user.id,
          //   option: Number(voteOpttion) == 0 ? VoteOption.A : VoteOption.B
          // });

          // const voteResult = await queryRunner.manager.save(vote);
          // this.logger.log("VoteSaveSuccess: VoteId " + voteResult.id);
        }

        await queryRunner.commitTransaction();
      } catch(err) {
        await queryRunner.rollbackTransaction();
        console.error(err);
        throw new InternalServerErrorException("투표 정보 저장중 오류가 발생했습니다.");
      }
    });
  }
  
  @Cron('* * * * * *')
  async getVoteCountFromOnchain() {
    const now = new Date();

    const gameList = await this.gameRepo.find({
      where: {
        deadline: MoreThan(now),
      }
    });

    for(const game of gameList) {
      const gameInfo = await this.contract.findGameById(game.id);
      console.log(gameInfo);
    }
  }
}
