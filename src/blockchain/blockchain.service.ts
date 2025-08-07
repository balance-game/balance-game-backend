import { Injectable, OnModuleInit } from '@nestjs/common';
import { Contract, WebSocketProvider } from 'ethers';
import * as BalanceGameJson from './abi/BalanceGame.json';

const CONTRACT_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';
const RPC_URL = 'ws://127.0.0.1:8545';

/**
 *
 * 2025-08-05 Memo
 * 1. 좋아요 내가 좋아요 누른건지 구별하는 칼럼 반환하도록 수정하기
 * 2. DB에 게임정보 저장하도록 하기 (blockchain)
 * 3. 투표한 사람 정보 저장 (blockchain)
 * 4. 내 정보 반환할때 투표 및 상대방 조회기능도 만들기
 * 5. 백엔드 API 업데이트 하기 
 * 6. Redis 캐시화 하기 
 * 
 */

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider;
  private contract: Contract;

  async onModuleInit() {
    this.provider = new WebSocketProvider(RPC_URL);

    this.contract = new Contract(
      CONTRACT_ADDRESS,
      BalanceGameJson.abi,
      this.provider
    );

    this.listenToEvents();
  }

  listenToEvents() {
    this.contract.on('NewGame', (gameId, questionA, questionB, deadline, creator) => {
      console.log('🔥 NewGame 이벤트 감지됨');
      console.log('Game ID:', gameId.toString());
      console.log('A:', questionA);
      console.log('B:', questionB);
      console.log('마감시간:', deadline.toString());
      console.log('생성자:', creator);
    });
  }
}
