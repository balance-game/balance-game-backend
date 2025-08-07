import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entity/user.entity';
import { Comment } from './entity/comment.entity';
import { Like } from './entity/like.entity';
import { Game } from 'src/game/entity/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Comment, Like, Game])],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService]
})
export class CommentModule {}
