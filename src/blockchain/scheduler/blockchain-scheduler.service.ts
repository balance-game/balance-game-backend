import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Game } from "src/game/entity/game.entity";
import { LessThan, MoreThan, Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { JsonRpcProvider, Signer, WebSocketProvider } from "ethers";
import { BalanceGame } from "../typechain-types";

@Injectable()
export class BlockchainSchedulerService {
    constructor(
        @InjectRepository(Game)
        private readonly gameRepo: Repository<Game>,
        @Inject("BLOCKCHAIN_CONNECTION")
        private readonly blockchainProvider: {
            contractAddress: string,
            httpProvider: JsonRpcProvider, 
            webSocketProvider: WebSocketProvider,
            httpContract: BalanceGame,
            webSocketContract: BalanceGame,
            ownerWallet: Signer
        },
        private readonly configService: ConfigService,
    ) {}

    private readonly logger = new Logger(BlockchainSchedulerService.name);

    // 30초에 한번씩 온체인 데이터 반영
    @Cron('*/30 * * * * *')
    async getVoteCountFromOnchain() {
        const now = new Date();

        const gameList = await this.gameRepo.find({
            where: {
                deadline: MoreThan(now),
            }
        });

        // 투표 현황 반영
        for(const game of gameList) {
            try {
                const gameInfo = await this.blockchainProvider.httpContract.getGameInfo(game.id);

                game.voteCountA = gameInfo.voteCountA.toString();
                game.voteCountB = gameInfo.voteCountB.toString();
                game.totalPool = gameInfo.totalpool.toString();

                await this.gameRepo.save(game);
            } catch(err) {
                this.logger.error("온체인 데이터 반영 실패" + err);
            }
        }

        this.logger.log("success wirte onchain data");
    }

    /**
     * @TODO 
     * [ "Not enough voters" ] 에러 처리하기
     * 처리한뒤 try catch로 다시 감싸기
     */
    // 1분마다 끝난 이벤트 당첨자 조회 요청
    @Cron('* * * * *')
    async getFinishGame() {    
        const now = new Date();
        const finishGames  = await this.gameRepo.find({
            where: { 
                deadline: LessThan(now),
                isChecked: false
            }
        });
        
        for(const game of finishGames) {
            try {
                // 온체인 데이터 반영
                const gameInfo = await this.blockchainProvider.httpContract.getGameInfo(game.id);
        
                game.voteCountA = gameInfo.voteCountA.toString();
                game.voteCountB = gameInfo.voteCountB.toString();
                game.totalPool = gameInfo.totalpool.toString();                
            } catch(err) {
                this.logger.error("온체인 데이터 반영 실패" + err);
            }

            // 추첨 요청
            try {
                await this.blockchainProvider.httpContract.connect(this.blockchainProvider.ownerWallet).checkWinner(game.id);
            } catch(err) {
                /**
                 * @TODO
                 */
            }
            
            game.isChecked = true;
            await this.gameRepo.save(game);

        }

        this.logger.log("success call checkWinner");
    }
}