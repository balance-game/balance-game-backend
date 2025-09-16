import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { User } from 'src/auth/entity/user.entity';
import { Vote } from 'src/game/entity/vote.entity';
import { Blockchain } from './entity/blockchain.entity';
import { GameWinner } from 'src/game/entity/game-winner.entity';
import { BlockchainProviderModule } from './provider/blockchain-provider.module';
import { BlockchainSchedulerService } from './scheduler/blockchain-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameWinner, User, Vote, Blockchain]), BlockchainProviderModule],
  providers: [BlockchainService, BlockchainSchedulerService],
  controllers: [BlockchainController]
})
export class BlockchainModule {}
