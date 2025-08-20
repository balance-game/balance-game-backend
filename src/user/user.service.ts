import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entity/user.entity';
import { jwtUser } from 'src/common/interface/jwt-user';
import { Vote } from 'src/game/entity/vote.entity';
import { Repository } from 'typeorm';
import { ProfileImage } from './entity/profile-image.entity';
import { R2Service } from 'src/infrastructure/r2.service';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Vote)
        private readonly voteRepo: Repository<Vote>,
        @InjectRepository(ProfileImage)

        private readonly profileImageRepo: Repository<ProfileImage>,
        private readonly r2Service: R2Service
    ) {}

    async myProfile(user: jwtUser) {
        try {
            const userInfo = await this.userRepo.findOne({
                where: { id: user.userId },
                select: { 
                    id: true,
                    address: true,
                    name: true,
                    createdAt: true
                },
                relations: ["votes", "games", "profileImage"]
            });

            if (!userInfo) {
                throw new NotFoundException("존재하지 않는 유저입니다.");
            }

            return {
                ...userInfo
            }
        } catch(err) {
            if (err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }

    async getUserProfile(id: string) {
        try {
            const userInfo = await this.userRepo.findOne({
                where: { id: id },
                select: { 
                    id: true,
                    address: true,
                    name: true,
                    createdAt: true
                },
                relations: ["votes", "games", "profileImage"]
            });

            if (!userInfo) {
                throw new NotFoundException("존재하지 않는 유저입니다.");
            }

            return {
                ...userInfo
            }
        } catch(err) {
            if (err instanceof NotFoundException) {
                throw err;
            }
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }
    
    async editProfileImage(file: Express.Multer.File, userId: string) {
        try {
            const imageName = await this.r2Service.uploadImage(file, "profile");
            const profileImage = this.profileImageRepo.create({
                userId: userId,
                url: imageName
            });

            await this.profileImageRepo.save(profileImage);
        } catch(err) {
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }
}
