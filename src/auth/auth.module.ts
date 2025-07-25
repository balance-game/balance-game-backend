import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nonce } from './entity/nonce.entity';
import { User } from './entity/user.entity';
import { RefreshToken } from './entity/refresh-token.entity';
import { AccessTokenStrategy } from './strategies/jwt-token.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([Nonce, User, RefreshToken])],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy],
})
export class AuthModule {}
