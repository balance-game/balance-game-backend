import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { Contract, id, WebSocketProvider } from 'ethers';
import * as BalanceGameJson from './abi/BalanceGame.json';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { Vote } from 'src/game/entity/vote.entity';
import { VoteOption } from 'src/game/enum/vote-option.enum';

/**
 *
 * 2025-08-05 Memo
 * 1. 좋아요 내가 좋아요 누른건지 구별하는 칼럼 반환하도록 수정하기 O
 * 2. DB에 게임정보 저장하도록 하기 (blockchain) 
 * 3. 투표한 사람 정보 저장 (blockchain)
 * 4. 내 정보 반환할때 투표 및 상대방 조회기능도 만들기
 * 5. 백엔드 API 업데이트 하기 
 * 6. Redis 캐시화 하기 
 * 7. Nest 배치로 주기적으로 조회하기
 * 
 */

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: WebSocketProvider;
  private contract: Contract;

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
    this.contract = new Contract(
      contractAddress,
      BalanceGameJson.abi,
      this.provider
    );

    this.listenToEvents();
  }

  listenToEvents() {
    this.contract.on('NewGame', async (gameId: number, questionA: string, questionB: string, deadline: number, creator: string) => {
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
          const game = this.gameRepo.create({
            id: gameId,
            optoinA: questionA,
            optionB: questionB,
            deadline: deadlineToDate,
            createdBy: user.id
          });

          this.gameRepo.save(game);
          this.logger.log("GameSaveSuccess: GameId " + gameId);
        }

        await queryRunner.commitTransaction();
      } catch(err) {
        await queryRunner.rollbackTransaction();
        console.error(err);
        throw new InternalServerErrorException("게임정보 저장중 오류가 발생했습니다.");
      }
    });

    this.contract.on('NewVote', async (gameId: number, address: string, voteOpttion: number) => {
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
          const vote = queryRunner.manager.create(Vote, {
            gameId: gameId,
            userId: user.id,
            option: voteOpttion == 0 ? VoteOption.A : VoteOption.B
          });

          const voteResult = await queryRunner.manager.save(vote);
          this.logger.log("VoteSaveSuccess: VoteId " + voteResult.id);
        }

        await queryRunner.commitTransaction();
      } catch(err) {
        await queryRunner.rollbackTransaction();
        console.error(err);
        throw new InternalServerErrorException("투표 정보 저장중 오류가 발생했습니다.");
      }
    })
  }
}
