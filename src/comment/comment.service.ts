import { Injectable } from '@nestjs/common';
import { CreateComment } from './dto/create-comment.dto';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entity/comment.entity';
import { jwtUser } from 'src/common/interface/jwt-user';

@Injectable()
export class CommentService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Comment)
        private readonly commentRepo: Repository<Comment>
    ) {}
    
    async createComment(user: jwtUser, dto: CreateComment) {
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
    }

    async editComment() {

    }

    async deleteComment() {

    }
}
