import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entity/user.entity';
import { IsNull, Repository } from 'typeorm';
import { JwtPayload } from 'src/common/interface/jwt-payload';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {
    const secret = configService.get<string>('TOKEN_SECRET');
    if (!secret) throw new Error('TOKEN_SECRET is not defined in .env');
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const userId = Number(payload.userId);
    const isUser = await this.userRepo.findOne({ where: { id: userId, deletedAt: IsNull() } });

    if (isUser) {
      return { userId };
    }
    else {
      throw new UnauthorizedException("존재하지 않는 유저입니다.");
    }
  }
}
