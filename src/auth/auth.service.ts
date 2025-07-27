import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Nonce } from './entity/nonce.entity';
import { GetNonce } from './dto/get-nonce.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { HandleUserAuth } from './dto/handle-user-auth.dto';
import { ethers } from 'ethers';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entity/refresh-token.entity';
import { JwtPayload } from 'src/common/interface/jwt-payload';
import { User } from './entity/user.entity';
import { EditUser } from './dto/edit-user.dto';
import { v4 } from 'uuid';

const signMessage = "Please login with";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Nonce)
    private readonly nonceRepo: Repository<Nonce>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource
  ) {}

  async getNonce(dto: GetNonce) {
    const nonce = Math.floor(Math.random() * 1000000000000);
    const expiryDate = new Date(Date.now() + 3 * 60 * 1000);

    await this.nonceRepo.save({
      address: dto.address,
      nonce: nonce,
      expiryDate: expiryDate,
    });

    return { "message": `${signMessage} ${nonce}` };
  }

  async handleUserAuth(dto: HandleUserAuth) {
    const nonceValidCheck = await this.nonceValidCheck(dto.address);

    if (!nonceValidCheck.nonceValid) {
      await this.nonceRepo.delete({ address: nonceValidCheck.address });
      throw new UnauthorizedException("인증코드가 만료되었습니다.");
    }
    const signer = ethers.verifyMessage(`${signMessage} ${nonceValidCheck.nonce}`, dto.signature).toLocaleLowerCase();
    if (signer !== dto.address) {
      throw new UnauthorizedException("유효하지 않은 서명입니다.");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(Nonce, { address: nonceValidCheck.address });

      let user = await queryRunner.manager.findOne(User, {
        where: { address: nonceValidCheck.address },
        withDeleted: true
      });

      if (!user) {
        user = await queryRunner.manager.save(User, {
          address: dto.address,
          name: dto.address,
        });
      }
      else if (user.deletedAt) {
        user.deletedAt = null;
        await queryRunner.manager.save(user);
      }

      const payload = { userId: user.id };
      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken(payload);
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const refreshTokenInDB = await queryRunner.manager.save(RefreshToken, {
        token: refreshToken,
        user: user,
        expiryDate: expiryDate,
      });

      await queryRunner.commitTransaction();

      return {
        accessToken,
        refreshTokenId: refreshTokenInDB.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(error);
      throw new InternalServerErrorException("서버 오류로 로그인에 실패했습니다.");
    } finally {
      await queryRunner.release();
    }
  }

  async newAccessToken(refreshTokenId: number) {
    const findRefreshToken =  await this.refreshTokenRepo.findOne({ 
      where: { id: refreshTokenId },
      relations: ["user"]
    });

    if (findRefreshToken) {
      if (findRefreshToken.expiryDate < new Date()) {
        await this.refreshTokenRepo.delete({ id: findRefreshToken.id });
        throw new UnauthorizedException("재 로그인이 필요합니다.");
      }

      const payload = { userId: findRefreshToken.user.id };
      const accessToken = this.generateAccessToken(payload);
      return {
        accessToken: accessToken
      };
    }
    else {
      throw new UnauthorizedException("잘못된 refreshToken 입니다.");
    }
  }

  async me(userId: number) {
    const user = await this.userRepo.findOne({ 
      where: { id: userId },
      select: { name: true, address: true }
    });
    if (user) {
      return user;
    }
    else {
      throw new BadRequestException("존재하지 않는 유저입니다.");
    }
  }

  async editUserName(userId: number, dto: EditUser) {
    let user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      const findExistUser = await this.userRepo.findOne({ where: { name: dto.name } });
      if (findExistUser) {
        throw new ConflictException("이미 존재하는 이름입니다.");
      }
      user.name = dto.name;
      user = await this.userRepo.save(user);
      return {
        address: user.address,
        name: user.name
      }
    }
    else {
      throw new BadRequestException("존재하지 않는 유저입니다.");
    }
  }

  async deleteUser(userId: number) {
    const user = await this.userRepo.findOne({ 
      where: { id: userId },
      relations: ["refreshToken"]
    });
    if (user) {
      user.name = v4();
      await this.refreshTokenRepo.remove(user.refreshToken);
      await this.userRepo.softRemove(user);
      this.userRepo.save(user);
    }
    else {
      throw new BadRequestException("존재하지 않는 유저입니다.");
    }
  }

  async nonceValidCheck(address: string) {
    const nowDate = new Date();
    const nonce = await this.nonceRepo.findOne({ where: { address: address } });

    if (!nonce) {
      throw new BadRequestException("인증코드가 존재하지 않습니다.");
    }

    return {
      nonceValid: nonce.expiryDate > nowDate,
      address: nonce.address,
      nonce: nonce.nonce
    };
  }

  generateAccessToken(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });
    return accessToken;
  }
  
  generateRefreshToken(payload: JwtPayload) {
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
    return refreshToken;
  }
}
