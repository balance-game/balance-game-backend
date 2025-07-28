import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateComment } from './dto/create-comment.dto';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entity/comment.entity';
import { jwtUser } from 'src/common/interface/jwt-user';
import { EditComment } from './dto/edit-comment.dto';

@Injectable()
export class CommentService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Comment)
        private readonly commentRepo: Repository<Comment>,
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
                likeCount: comment.likeCount,
                disLikeCount: comment.disLikeCount
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
                            likeCount: comment.likeCount,
                            disLikeCount: comment.disLikeCount
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
}
