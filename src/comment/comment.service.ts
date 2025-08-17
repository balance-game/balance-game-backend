import { ConflictException, ConsoleLogger, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateComment } from './dto/create-comment.dto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entity/comment.entity';
import { jwtUser } from 'src/common/interface/jwt-user';
import { EditComment } from './dto/edit-comment.dto';
import { Like } from './entity/like.entity';    
import { LikeType } from 'src/comment/enum/like-type.enum';
import { Game } from 'src/game/entity/game.entity';

/**
 * 
 * 2025-08-18 Memo
 * 댓글 삭제시 대댓글 처리 추가하기
 * 
 */
@Injectable()
export class CommentService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Comment)
        private readonly commentRepo: Repository<Comment>,
        @InjectRepository(Like)
        private readonly likeRepo: Repository<Like>,
        @InjectRepository(Game)
        private readonly gameRepo: Repository<Game>,
        private readonly dataSource: DataSource
    ) {}

    async createComment(user: jwtUser, dto: CreateComment) {
        try {
            const game = await this.gameRepo.findOne({ where: { id: dto.gameId } });
            if (!game) {
                throw new NotFoundException("존재 하지 않는 게임입니다.");
            }
            if (dto.parentId) {
                const existComment = await this.commentRepo.findOne({
                    where: { id: dto.parentId }
                });
                if (!existComment) {
                    throw new NotFoundException("존재하지 않는 댓글입니다.");
                } 
                if (existComment.parentId) {
                    throw new ConflictException("대대댓글은 허용되지 않습니다.");
                }
            }

            const comment = await this.commentRepo.save({
                gameId: dto.gameId,
                content: dto.content,
                parentId: dto.parentId,
                author: user.userId
            });
    
            return {
                commentId: comment.id,
                content: comment.content,
                parentId: comment.parentId,
                author: user.userName,
                createAt: comment.createdAt,
                likeCount: 0,
                disLikeCount: 0,
                likedByUser: null
            }
        } catch(err) {
            if (err instanceof NotFoundException || err instanceof ConflictException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async editComment(user: jwtUser, id: string, dto: EditComment) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const comment = await manager.findOne(Comment, { where: { id: id } });
                if (comment) {
                    if (comment.author == user.userId) {
                        comment.content = dto.content;
                        await manager.save(comment);

                        const commentLikeCount = await this.commentLikeCount(id);
                        const likeCount = commentLikeCount[0].count;
                        const dislikeCount = commentLikeCount[1].count;
                        const likedByUser = await manager.findOne(Like, { where: { 
                            commentId: id,
                            userId: user.userId
                        }});

                        return {
                            id: comment.id,
                            content: comment.content,
                            parentId: comment.parentId,
                            author: user.userName,
                            createAt: comment.createdAt,
                            likeCount: likeCount,
                            dislikeCount: dislikeCount,
                            likedByUser: likedByUser?.type ?? null
                        }
                    }
                    else {
                        throw new ForbiddenException("댓글에 접근할 권한이 없습니다");
                    }
                }
                else {
                    throw new NotFoundException("존재하지 않는 댓글입니다.");
                }
            });
        } catch(err) {
            if (err instanceof ForbiddenException || err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async deleteComment(user: jwtUser, commentId: string) {
        try {
            await this.dataSource.transaction(async (manager) => {
                const comment = await manager.findOne(Comment, { where: { id: commentId } });
                if (comment) {
                    if (comment.author == user.userId) {
                        await manager.softRemove(comment);
                    }
                    else {
                        throw new ForbiddenException("댓글에 접근할 권한이 없습니다");
                    }
                }
                else {
                    throw new NotFoundException("존재하지 않는 댓글입니다.");
                }
            });
        } catch(err) {
            if (err instanceof ForbiddenException || err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async handleCommentLike(user: jwtUser, commentId: string, type: LikeType) {
        try {
            let likedByUser;
            let comment;

            await this.dataSource.transaction(async (manager) => {
                comment = await manager.findOne(Comment, { where: { id: commentId } });
                if (comment) {
                    const like = await manager.findOne(Like, { where: { userId: user.userId, commentId: commentId } });

                    if (like) {
                        // 현재 좋아요 타입과 요청한 좋아요 타입이 같다면 좋아요 취소
                        if (like.type == type) {
                            await manager.remove(like);
                        }
                        else {
                            // 서로 다르면 타입 변경
                            like.type = type;
                            likedByUser = type;

                            await manager.save(Like, like);
                        }
                    }
                    else {
                        await manager.insert(Like, {
                            user: { id: user.userId },
                            comment: { id: commentId },
                            type: type
                        });

                        likedByUser = type;
                    }
                }
                else {
                    throw new NotFoundException("존재하지 않는 댓글입니다.");
                }
            });

            const commentLikeCount = await this.commentLikeCount(commentId);
            const likeCount = commentLikeCount[0].count;
            const dislikeCount = commentLikeCount[1].count;

            return {
                commentId: comment.id,
                content: comment.content,
                parentId: comment.parentId,
                author: user.userName,
                createAt: comment.createdAt,
                likeCount,
                dislikeCount,
                likedByUser: likedByUser ?? null
            };
        } catch (err) {
            if (err instanceof ForbiddenException || err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async commentLikeCount(commentId: string) {
        return await this.likeRepo.query(`
            SELECT t.type, COUNT(l.comment_id) AS count
            FROM (SELECT 'LIKE' AS type UNION ALL SELECT 'DISLIKE') t
            LEFT JOIN \`like\` l
            ON l.type = t.type AND l.comment_id = ?
            GROUP BY t.type
        `, [commentId]);
    }

    async getComment(user: jwtUser,gameId: string) {
        const userId = user ? user.userId : 0;

        const subQuery = this.likeRepo
        .createQueryBuilder("like")
        .select(["like.comment_id", "like.type as type"])
        .where("like.user_id = :userId", { userId });

        // 기본 조회
        let qb = this.commentRepo
        .createQueryBuilder("co")
        .leftJoin("co.user", "u")
        .leftJoin("like", "li", "li.comment_id = co.id")
        .leftJoin(
            "(" + subQuery.getQuery() + ")",
            "li_user_id",
            "li_user_id.comment_id = co.id"
        )
        .setParameters(subQuery.getParameters())
        .select([
            "co.id AS commentId",
            "co.game_id AS gameId",
            "co.content AS content",
            "co.parent_id AS parentId",
            "u.name AS author",
            "co.created_at AS created_at",
            `SUM(CASE WHEN li.type = 'like' THEN 1 ELSE 0 END) AS likeCount`,
            `SUM(CASE WHEN li.type = 'dislike' THEN 1 ELSE 0 END) AS dislikeCount`,
            `li_user_id.type AS likedByUser`
        ])
        .groupBy("co.id")
        .addGroupBy("co.game_id")
        .addGroupBy("co.content")
        .addGroupBy("co.parent_id")
        .addGroupBy("u.name")
        .addGroupBy("co.created_at");

        // 전체 댓글 조회
        const commentList = await qb
        .where("parent_id is null")
        .orderBy("co.created_at", "DESC")
        .getRawMany();

        // top3 댓글 조회
        const top3Comment = await this.commentRepo.query(`
            SELECT
                co.id AS commentId,
                co.game_id AS gameId,
                co.content AS content,
                co.parent_id AS parentId,
                u.name AS author,
                co.created_at AS createdAt,
                SUM(CASE WHEN li.type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
                SUM(CASE WHEN li.type = 'DISLIKE' THEN 1 ELSE 0 END) AS dislikeCount,
                li_user_id.type AS likedByUser
            FROM comment co
            LEFT JOIN user u ON u.id = co.author
            LEFT JOIN \`like\` li ON li.comment_id = co.id
            LEFT JOIN (
                SELECT comment_id, type FROM \`like\`
                WHERE user_id = ?
            ) li_user_id ON li_user_id.comment_id = co.id
            GROUP BY
                co.id,
                co.game_id,
                co.content,
                co.parent_id,
                u.name,
                co.created_at
            HAVING likeCount + dislikeCount >= 15
            ORDER BY (likeCount + dislikeCount) DESC, likeCount DESC
            LIMIT 3;
        `, [userId]);

        const commentCount = commentList.length;

        // 대댓글 조회
        const allComent = await Promise.all(
            commentList.map(async (comment) => {
                const replies = await qb
                .where("co.parent_id = :parentId", { parentId: comment.commentId })
                .orderBy("co.created_at", "ASC")
                .getRawMany();

                return {
                    ...comment,
                    replies,
                };
            })
        );

        return { top3Comment, allComent, commentCount };
    }
}
 