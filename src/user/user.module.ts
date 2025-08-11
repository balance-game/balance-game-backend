import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from 'src/game/entity/vote.entity';
import { User } from 'src/auth/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, User])],
  controllers: [UserController],
  providers: [UserService]
})
export class UserModule {}
