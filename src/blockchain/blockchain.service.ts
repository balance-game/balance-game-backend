import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketProvider } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/game/entity/game.entity';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { BalanceGame } from './typechain-types';

// TypeChain 추후 분리 예정
import { BalanceGame__factory } from './typechain-types';
import { Blockchain } from './entity/blockchain.entity';
import { NewGameEvent, NewVoteEvent } from './typechain-types/contracts/BalanceGame';
import { handleNewGame } from './util/event/handleNewGame';
import { handleNewVote } from './util/event/handleNewVote';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: WebSocketProvider;
  private contract: BalanceGame;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Blockchain)
    private readonly blockChainRepo: Repository<Blockchain>,
    private readonly dataSource: DataSource
  ) {}

  private readonly logger = new Logger(BlockchainService.name);
  
  async onModuleInit() {
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

    await this.recoverEvents();
    this.listenToEvents();
  }

  // 이벤트 복구
  async recoverEvents() {
    let fromBlock;
    const toBlock = "latest";
    const eventFilters = [
      this.contract.filters.NewGame(),
      this.contract.filters.NewVote(),
    ];

    // 현재 네트워크 한개로 고정
    const chainInfo = await this.blockChainRepo.findOne({ where: { id: 1 } });
    if (chainInfo) {
      const latestBlock = await this.contract.runner!.provider!.getBlock("latest")
      // 같은 경우 패스
      if (chainInfo.lastBlockNumber == latestBlock!.number.toString()) {
        return;
      }
      else {
        fromBlock = BigInt(chainInfo.lastBlockNumber);
      }
    }
    else {
      fromBlock = 0;
    }
    
    // 이벤트 복구
  }

  // 블록체인 이벤트 등록
  listenToEvents() {
    this.contract.on(this.contract.getEvent("NewGame"), async (...args) => {
      const event = args[args.length - 1] as NewGameEvent.Log;
      if (!event) { 
        return;
      }
      await handleNewGame(event, this.dataSource, this.logger);
      await this.saveBlockNumber(event);
    });

    this.contract.on(this.contract.getEvent("NewVote"), async (...args) => {
      const event = args[args.length - 1] as NewVoteEvent.Log;
      if (!event) {
        return;
      }
      await handleNewVote(event, this.dataSource, this.logger);
      await this.saveBlockNumber(event);
    });
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

    for(const game of gameList) {
      try {
        const gameInfo = await this.contract.findGameById(game.id);
        
        game.voteCountA = gameInfo[4].toString();
        game.voteCountB = gameInfo[5].toString();
        await this.gameRepo.save(game);
      } catch(err) {
        console.error("온체인 데이터 반영 실패" + err);
      }
    }
  }

  // 마지막 블록번호 저장
  async saveBlockNumber(event: 
    NewGameEvent.Log | 
    NewVoteEvent.Log
  ) {
    const network = await this.contract.runner!.provider!.getNetwork();
    await this.blockChainRepo.upsert({
      chainId: network.chainId.toString(),
      chainName: network.name,
      lastBlockNumber: (await event.getBlock()).number.toString()
    },
    ['chainId']);
  }
}
