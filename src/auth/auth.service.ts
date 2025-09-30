import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Nonce } from './entity/nonce.entity';
import { GetNonce } from './dto/get-nonce.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { HandleUserAuth } from './dto/handle-user-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entity/refresh-token.entity';
import { JwtPayload } from 'src/common/interface/jwt-payload';
import { User } from './entity/user.entity';
import { EditUser } from './dto/edit-user.dto';
import { v4 } from 'uuid';
import { ethers, JsonRpcProvider, Signer, WebSocketProvider } from 'ethers';
import { ProfileImage } from 'src/user/entity/profile-image.entity';
import { BalanceGame } from 'src/blockchain/typechain-types';

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
    @Inject("BLOCKCHAIN_CONNECTION")
    private readonly blockchainProvider: {
      contractAddress: string,
      httpProvider: JsonRpcProvider,
      webSocketProvider: WebSocketProvider,
      httpContract: BalanceGame,
      webSocketContract: BalanceGame,
      ownerWallet: Signer
    },
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async getNonce(dto: GetNonce) {
    const nonce = (Math.floor(Math.random() * 1000000000000)).toString();
    const expiryDate = new Date(Date.now() + 3 * 60 * 1000);

    try {
      await this.nonceRepo.upsert({
        address: dto.address,
        nonce,
        expiryDate,
      }, ['address']);

    } catch(err) {
      console.error(err);
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }

    return { nonceMessage: `${signMessage} ${nonce}` };
  }

  async handleUserAuth(dto: HandleUserAuth) {
    const nonceValidCheck = await this.nonceValidCheck(dto.address);

    if (!nonceValidCheck.nonceValid) {
      await this.nonceRepo.delete({ address: nonceValidCheck.address });
      throw new UnauthorizedException("인증코드가 만료되었습니다.");
    }
    // 모두 소문자로 변경한뒤 저장해야지 비교시 오류안남
    dto.address = dto.address.toLocaleLowerCase();
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

      let needBlockchainUpdate = false;

      // 회원가입 또는 탈퇴회원 재 가입 처리
      if (!user) {
        user = await queryRunner.manager.save(User, {
          address: dto.address,
          name: dto.address,
        });

        await queryRunner.manager.save(ProfileImage, {
          userId: user.id,
          imageName: "default.jpg"
        });

        needBlockchainUpdate = true;
      }
      else if (user.deletedAt) {
        user.deletedAt = null;
        await queryRunner.manager.save(user);

        needBlockchainUpdate = true;
      }

      // 토큰 발급
      const payload = { userId: user.id.toString() };
      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken(payload);
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const refreshTokenInDB = await queryRunner.manager.save(RefreshToken, {
        token: refreshToken,
        user: user,
        expiryDate: expiryDate,
      });

      // whitelist update
      if (needBlockchainUpdate) {
        await this.updateWhitelist(dto.address, true);
      }

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

  async logout(refreshTokenId: number) {
    if (!refreshTokenId) {
      throw new BadRequestException("refreshTokenId가 비어있습니다");
    }
    try {
      await this.refreshTokenRepo.delete({
        id: refreshTokenId.toString()
      });
    } catch(err) {
      throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
    }
  }

  async newAccessToken(refreshTokenId: number) {
    const findRefreshToken =  await this.refreshTokenRepo.findOne({ 
      where: { id: refreshTokenId.toString() },
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

  async me(userId: string) {
    try {
      const user = await this.userRepo.findOne({ 
        where: { id: userId },
        select: { id: true, name: true, address: true },
        relations: ["profileImage"]
      });

      if (user) {
        return {
          id: user.id,
          address: user.address,
          name: user.name,
          profileImage: user.profileImage.imageName,
        };
      }

      throw new NotFoundException("존재하지 않는 유저입니다.");
    } catch(err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      console.error(err);
      throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
    }
  }

  async updateWhitelist(address: string, status: boolean) {
      const tx = await this.blockchainProvider.httpContract.connect(this.blockchainProvider.ownerWallet).whitelistUpdate(address, status);
      const receipt = await tx.wait();
      const eventTopic = this.blockchainProvider.httpContract.interface.getEvent("WhiteListUpdate").topicHash;

      const foundlog = receipt?.logs.find((log) => log.topics[0] === eventTopic);
      const parseLog = this.blockchainProvider.httpContract.interface.parseLog(foundlog!);
      
      if (!parseLog || parseLog.args.userAddress.toLocaleLowerCase() !== address || parseLog.args.status !== status) {
        throw new BadGatewayException("whitelist 업데이트에 실패했습니다");
      }
  }

  async editUserName(userId: string, dto: EditUser) {
    let user = await this.userRepo.findOne({ where: { id: userId.toString() } });
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

  async deleteUser(userId: string) {
    try {
      await this.dataSource.transaction(async manager => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          relations: ["refreshToken"]
        });
        
        if (!user) throw new NotFoundException("존재하지 않는 유저입니다.");
      
        user.name = v4();
        await manager.remove(user.refreshToken);
        await manager.softRemove(user);
        await manager.save(user);

        await this.updateWhitelist(user.address, false);
      });
    } catch(err) {
      if (err instanceof NotFoundException || BadGatewayException) {
        throw err;
      }
      
      console.error(err);
      throw new Error("서버에 오류가 발생했습니다.");
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
