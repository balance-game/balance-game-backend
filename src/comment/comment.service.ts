import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateComment } from './dto/create-comment.dto';
import { DataSource, Repository } from 'typeorm';
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
            const comment = await this.commentRepo.save({
                gameId: dto.gameId,
                content: dto.content,
                parentId: dto.parentId,
                author: user.userId,
            });
    
            return {
                id: comment.id,
                content: comment.content,
                parentId: comment.parentId,
                author: user.userName,
                createAt: comment.createdAt,
            }
        } catch(err) {
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
}
 