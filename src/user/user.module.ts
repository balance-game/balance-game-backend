import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from 'src/game/entity/vote.entity';
import { User } from 'src/auth/entity/user.entity';
import { ProfileImage } from './entity/profile-image.entity';
import { R2Service } from 'src/infrastructure/r2.service';
import { HttpModule } from '@nestjs/axios';
import { GameWinner } from 'src/game/entity/game-winner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, User, ProfileImage, GameWinner]), HttpModule],
  controllers: [UserController],
  providers: [UserService, R2Service]
})
export class UserModule {}
