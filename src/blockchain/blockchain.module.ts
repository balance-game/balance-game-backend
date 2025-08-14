import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { User } from 'src/auth/entity/user.entity';
import { Vote } from 'src/game/entity/vote.entity';
import { Blockchain } from './entity/blockchain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, User, Vote, Blockchain])],
  providers: [BlockchainService],
  controllers: [BlockchainController]
})
export class BlockchainModule {}
