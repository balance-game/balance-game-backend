import { Controller } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
    constructor(private readonly blockChainService: BlockchainService) {}

}
