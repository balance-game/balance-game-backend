import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from './entity/game.entity';
import { IsNull, Repository } from 'typeorm';
import { GameSortType } from './enum/gameSortType.enum';
import { GameStatusType } from './enum/gameStatusType.enum';
import { Comment } from 'src/comment/entity/comment.entity';
import { CommentService } from 'src/comment/comment.service';
import { jwtUser } from 'src/common/interface/jwt-user';

@Injectable()
export class GameService {
    constructor(
        @InjectRepository(Game)
        private readonly gameRepo: Repository<Game>,
        private readonly commentService: CommentService
    ) {}

    async getAllGames(
        page: number,
        limit: number,
        gameSortType: GameSortType,
        gameStatusType: GameStatusType
        ) {
        try {
            const qb = this.gameRepo.createQueryBuilder("game")
            .leftJoinAndSelect("game.user", "user");

            // 상태 조건
            if (gameStatusType === GameStatusType.ACTIVE) {
                qb.andWhere("game.deadline > :now", { now: new Date() });
            } 
            else if (gameStatusType === GameStatusType.CLOSED) {
                qb.andWhere("game.deadline < :now", { now: new Date() });
            }

            // 정렬
            if (gameSortType === GameSortType.LATEST) {
                qb.orderBy("game.createdAt", "DESC");
            } 
            else if (gameSortType === GameSortType.OLDEST) {
                qb.orderBy("game.createdAt", "ASC");
            } 
            else if (gameSortType === GameSortType.POPULAR) {
                qb.addSelect("game.vote_count_a + game.vote_count_b", "totalVotes")
                    .orderBy("totalVotes", "DESC")
                    .addOrderBy("game.createdAt", "DESC");
            }

            qb.skip((page - 1) * limit)
            .take(limit);

            const [data, total] = await qb.getManyAndCount();
            const gameList = data.map(game => {
                const { user, ...rest } = game;
                return {
                    ...rest,
                    createdByName: user?.name || null,
                };
            });
            
            return {
                total,             // 전체 게시글 수
                page,              // 현재 페이지
                limit,             // 한 페이지당 개수
                totalPages: Math.ceil(total / limit), // 총 페이지 수
                gameList: gameList,              // 실제 게시글 목록
            };
        } catch(err) {
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async getTop3Games() {
        try {
            const games = await this.gameRepo.createQueryBuilder("game")
            .leftJoinAndSelect("game.user", "user")
            .addSelect("game.vote_count_a + game.vote_count_b", "totalVotes")
            .orderBy("totalVotes", "DESC")
            .addOrderBy("game.createdAt", "DESC")
            .take(3)
            .getMany();

            const gameList = games.map(game => {
                const { user, ...rest } = game;
                return {
                    ...rest,
                    createdByName: user?.name || null,
                };
            });

            return gameList;
        } catch (err) {
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async getGame(_user: jwtUser, id: number) {
        try {
            const game = await this.gameRepo.find({
                where: { id: id },
                relations: ["user"]
            });

            if (game) {
                const { user, ...rest } = game[0];
                const comment = await this.commentService.getComment(_user, id);
                return {
                    ...rest,
                    createdByName: user?.name || null,
                    comment
                };
            }
            else {
                throw new NotFoundException("존재하지 않는 게임입니다.");
            }
        } catch(err) {
            if (err instanceof ForbiddenException || err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.")
        }     
    }
}
