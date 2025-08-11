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
                }
            });

            if (!userInfo) {
                throw new NotFoundException("존재하지 않는 유저입니다.");
            }

            const votedList = await this.voteRepo
            .createQueryBuilder('v')
            .leftJoinAndSelect('v.game', 'g')
            .select([
                'v.game_id',
                'g.option_a',
                'g.option_b',
                'v.option',
            ])
            .where('v.user_id = :userId', { userId: user.userId })
            .getRawMany();

            return {
                ...userInfo,
                votedList
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
                    address: true,
                    name: true,
                    createdAt: true
                }
            });

            if (!userInfo) {
                throw new NotFoundException("존재하지 않는 유저입니다.");
            }

            const votedList = await this.voteRepo
            .createQueryBuilder('v')
            .leftJoinAndSelect('v.game', 'g')
            .select([
                'v.game_id',
                'g.option_a',
                'g.option_b',
                'v.option',
            ])
            .where('v.user_id = :userId', { userId: id })
            .getRawMany();

            return {
                ...userInfo,
                votedList
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
