import { ConsoleLogger, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateComment } from './dto/create-comment.dto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entity/comment.entity';
import { jwtUser } from 'src/common/interface/jwt-user';
import { EditComment } from './dto/edit-comment.dto';
import { Like } from './entity/like.entity';    
import { LikeType } from 'src/comment/enum/like-type.enum';

@Injectable()
export class CommentService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Comment)
        private readonly commentRepo: Repository<Comment>,
        @InjectRepository(Like)
        private readonly likeRepo: Repository<Like>,
        private readonly dataSource: DataSource
    ) {}

    async createComment(user: jwtUser, dto: CreateComment) {
        try {
            if (dto.parentId) {
                const existComment = await this.commentRepo.findOne({
                    where: { id: dto.parentId }
                });
                if (!existComment) {
                    throw new NotFoundException("존재하지 않는 댓글입니다");
                } 
            }
            const comment = await this.commentRepo.save({
                gameId: dto.gameId,
                content: dto.content,
                parentId: dto.parentId,
                author: user.userId
            });
    
            return {
                id: comment.id,
                content: comment.content,
                parentId: comment.parentId,
                author: user.userName,
                createAt: comment.createdAt,
            }
        } catch(err) {
            if (err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async editComment(user: jwtUser, dto: EditComment) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const comment = await manager.findOne(Comment, { where: { id: dto.commentId } });
                if (comment) {
                    if (comment.author == user.userId) {
                        comment.content = dto.content;
                        await manager.save(comment);

                        return {
                            id: comment.id,
                            content: comment.content,
                            parentId: comment.parentId,
                            author: user.userName,
                            createAt: comment.createdAt,
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

    async deleteComment(user: jwtUser, commentId: number) {
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

    async handleCommentLike(user: jwtUser, commentId: number, type: LikeType) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const comment = await manager.findOne(Comment, { where: { id: commentId } });
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
                            await manager.save(Like, like);
                        }
                    }
                    else {
                        await manager.insert(Like, {
                            user: { id: user.userId },
                            comment: { id: commentId },
                            type: type
                        });
                    }

                    const commentLikeCount = await this.commentLikeCount(commentId);
                    const likeCount = commentLikeCount[0]?.count ?? 0;
                    const dislikeCount = commentLikeCount[1]?.count ?? 0;
                    return {
                        ...comment,
                        likeCount: likeCount,
                        dislikeCount: dislikeCount
                    };
                }
                else {
                    throw new NotFoundException("존재하지 않는 댓글입니다.");
                }
            });
        } catch (err) {
            if (err instanceof ForbiddenException || err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async commentLikeCount(commentId: number) {
        return await this.likeRepo
        .createQueryBuilder()
        .select("like.type", "type")
        .addSelect("count(*)", "count")
        .where("like.comment_id = :commentId", { commentId })
        .groupBy("like.type")
        .getRawMany();
    }

    async getComment(gameId: number) {
        let qb = this.commentRepo
        .createQueryBuilder("co")
        .leftJoin("co.user", "u")
        .leftJoin("like", "li", "li.comment_id = co.id")
        .select([
            "co.id AS comment_id",
            "co.game_id AS game_id",
            "co.content AS content",
            "co.parent_id AS parent_id",
            "u.name AS author",
            "co.created_at AS created_at",
            `SUM(CASE WHEN li.type = 'like' THEN 1 ELSE 0 END) AS likeCount`,
            `SUM(CASE WHEN li.type = 'dislike' THEN 1 ELSE 0 END) AS dislikeCount`,
        ])
        .groupBy("co.id")
        .addGroupBy("co.game_id")
        .addGroupBy("co.content")
        .addGroupBy("co.parent_id")
        .addGroupBy("u.name")
        .addGroupBy("co.created_at")

        const commentList = await qb
        .where("parent_id is null")
        .orderBy("co.created_at", "DESC")
        .getRawMany();

        const top3Comment = await this.commentRepo.query(`
            SELECT
                co.id AS comment_id,
                co.game_id AS game_id,
                co.content AS content,
                co.parent_id AS parent_id,
                u.name AS author,
                co.created_at AS created_at,
                SUM(CASE WHEN li.type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
                SUM(CASE WHEN li.type = 'DISLIKE' THEN 1 ELSE 0 END) AS dislikeCount
            FROM comment co
            LEFT JOIN user u ON u.id = co.author
            LEFT JOIN \`like\` li ON li.comment_id = co.id
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
        `);

        console.log(top3Comment);

        const allComent = await Promise.all(
            commentList.map(async (comment) => {
                const replies = await qb
                .where("co.parent_id = :parentId", { parentId: comment.comment_id })
                .orderBy("co.created_at", "ASC")
                .getRawMany();

                return {
                    ...comment,
                    replies,
                };
            })
        );

        return { top3Comment, allComent };
    }
}
 