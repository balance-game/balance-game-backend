import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entity/user.entity';
import { jwtUser } from 'src/common/interface/jwt-user';
import { Vote } from 'src/game/entity/vote.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Vote)
        private readonly voteRepo: Repository<Vote>,
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
                relations: ["votes", "games"]
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
                relations: ["votes", "games"]
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
}
