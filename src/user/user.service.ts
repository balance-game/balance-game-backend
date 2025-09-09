import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entity/user.entity';
import { Vote } from 'src/game/entity/vote.entity';
import { Repository } from 'typeorm';
import { ProfileImage } from './entity/profile-image.entity';
import { R2Service } from 'src/infrastructure/r2.service';
import { GameWinner } from 'src/game/entity/game-winner.entity';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Vote)
        private readonly voteRepo: Repository<Vote>,
        @InjectRepository(ProfileImage)
        private readonly profileImageRepo: Repository<ProfileImage>,
        @InjectRepository(GameWinner)
        private readonly gameWinnerRepo: Repository<GameWinner>,

        private readonly r2Service: R2Service
    ) {}

    async getUserProfile(userId: string) {
        try {
            const userInfo = await this.userRepo.findOne({
                where: { id: userId },
                select: { 
                    id: true,
                    address: true,
                    name: true,
                    createdAt: true
                },
                relations: ["votes", "votes.game", "games", "games.user", "profileImage"]
            });

            console.log(userInfo);

            if (userInfo) {
                return {
                    id: userInfo.id,
                    address: userInfo.address,
                    name: userInfo.name,
                    profileImage: userInfo.profileImage.imageName,
                    games:
                        userInfo.games.map((game) => {
                            return {
                                id: game.id,
                                optionA: game.optionA,
                                optionB: game.optionB,
                                createdAt: game.createdAt,
                                deadline: game.deadline
                            }
                        }),
                    votes: 
                        userInfo.votes.map((vote) => {
                            return {
                                gameId: vote.gameId,
                                optionA: vote.game.optionA,
                                optionB: vote.game.optionB,
                                voteOption: vote.option,
                                votedAt: vote.votedAt
                            }
                        })
                }
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

    async getUserWinnerHistory(userId: string) {
        try {
            const rs = await this.gameWinnerRepo.find({
                where: { userId: userId }
            });
            
            return rs.map((history) => {
                return {
                    gameId: history.gameId,
                    userId: history.userId,
                    rank: history.rank,
                    claimPool: history.claimPool,
                    isClaimed: history.isClaimed
                }
            });
        } catch(err) {
            console.error(err);
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }
    
    async editProfileImage(file: Express.Multer.File, userId: string) {
        try {
            let profileImage = await this.profileImageRepo.findOne({ where: { userId: userId } });

            // 없을 경우 생성
            if (!profileImage) {
                profileImage = this.profileImageRepo.create({
                    userId: userId,
                    imageName: "default.jpg"
                });

                await this.profileImageRepo.save(profileImage);
            }

            const imageName = await this.r2Service.uploadProfileImage(file, "profile", profileImage.imageName);

            // 새로운 프로필 이미지 저장
            profileImage.imageName = imageName;
            await this.profileImageRepo.save(profileImage);

            return {
                profileImage: imageName
            };
        } catch(err) {
            console.error(err);
            if (err instanceof InternalServerErrorException) {
                throw err;
            }
            throw new InternalServerErrorException("서버에 오류가 발생했습니다.");
        }
    }
}
