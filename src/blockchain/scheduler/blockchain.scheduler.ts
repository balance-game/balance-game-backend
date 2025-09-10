import { Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { WebSocketProvider } from "ethers";
import { Game } from "src/game/entity/game.entity";
import { LessThan, MoreThan, Repository } from "typeorm";
import { BalanceGame__factory } from "../typechain-types/factories/contracts/BalanceGame__factory";
import { BalanceGame } from "../typechain-types";
import { ConfigService } from "@nestjs/config";

@Injectable()
class BlockchainScheduler implements OnModuleInit {
    private provider: WebSocketProvider;
    private contract: BalanceGame;
    
    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Game)
        private readonly gameRepo: Repository<Game>,
    ) {}

    onModuleInit() {
        const contractAddress = this.configService.get<string>("CONTRACT_ADDRESS");
        const rpcUrl = this.configService.get<string>("RPC_URL_WS");

        if (!contractAddress || !rpcUrl) {
            throw new Error('Missing CONTRACT_ADDRESS or RPC_URL_WS in env');
        }

        try {
            this.provider = new WebSocketProvider(rpcUrl);
            this.contract = BalanceGame__factory.connect(
            contractAddress,
            this.provider
            );
        } catch(err) {
            console.error(err);
            throw new Error("Connection failed to contract");
        }
    }

    // 1분에 한번씩 온체인 데이터 반영
    @Cron('* * * * *')
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
                const gameInfo = await this.contract.getGameInfo(game.id);

                game.voteCountA = gameInfo.voteCountA.toString();
                game.voteCountB = gameInfo.voteCountB.toString();
                game.totalPool = gameInfo.totalpool.toString();

                console.log(gameInfo);

                await this.gameRepo.save(game);
            } catch(err) {
                console.error("온체인 데이터 반영 실패" + err);
            }
        }
    }

    // 5분마다 끝난 이벤트 당첨자 조회 요청
    @Cron('*/5 * * * *')
    async getFinishGame() {    
        const now = new Date();

        /**
         * 투표 온체인 데이터 한번 반영해줘야됨
         */

        const finishGames  = await this.gameRepo.find({
            where: { deadline: LessThan(now) }
        });

        for(const game of finishGames) {
            // 끝난이벤트 추첨 요청
            // 당첨된 유저 DB저장
        }
    }
}