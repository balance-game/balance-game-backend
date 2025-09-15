import { Global, Module } from "@nestjs/common";
import { blockchainProvider } from "./blockchain.provider";
import { ConfigModule } from "@nestjs/config";

@Global()
@Module({
    imports: [ConfigModule],
    providers: [blockchainProvider],
    exports: [blockchainProvider]
})

export class BlockchainProviderModule {}