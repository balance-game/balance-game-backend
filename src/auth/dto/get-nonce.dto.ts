import { IsEthereumAddress } from "class-validator";

export class GetNonce {
    @IsEthereumAddress()
    address: string;
}