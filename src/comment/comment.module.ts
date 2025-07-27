import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entity/user.entity';
import { Comment } from './entity/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Comment])],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
