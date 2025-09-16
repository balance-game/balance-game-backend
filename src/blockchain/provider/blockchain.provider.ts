import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import { BalanceGame__factory } from '../typechain-types';

export const blockchainProvider: Provider = {
  provide: 'BLOCKCHAIN_CONNECTION',
  useFactory: async (
    configService: ConfigService
  ) => {
    // 블록체인 연결
    const contractAddress = configService.get<string>("CONTRACT_ADDRESS");
    const webSocketRpcUrl = configService.get<string>("RPC_URL_WS");
    const httpRpcUrl = configService.get<string>("RPC_URL_HTTP");
    const ownerPrivateKey = configService.get<string>("OWNER_WALLET_PRIVATEKEY");
    
    if (!contractAddress || !webSocketRpcUrl || !httpRpcUrl || !ownerPrivateKey ) {
      throw new Error('Missing env value');
    }

    let webSocketProvider = new WebSocketProvider(webSocketRpcUrl);
    let httpProvider = new JsonRpcProvider(httpRpcUrl);
    
    // 스마트컨트랙트 연결
    const httpContract = BalanceGame__factory.connect(contractAddress, httpProvider);
    const webSocketContract = BalanceGame__factory.connect(contractAddress, webSocketProvider);
    if (await httpProvider.getCode(await httpContract.getAddress()) === "0x") {
      throw new Error("Not Found Contract");
    }

    const ownerWallet = new ethers.Wallet(ownerPrivateKey, httpProvider);

    return { 
      contractAddress, 
      httpProvider,
      webSocketProvider, 
      httpContract,
      webSocketContract,
      ownerPrivateKey,
      ownerWallet
    };
  },
  inject: [ConfigService]
};