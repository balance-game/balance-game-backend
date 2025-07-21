import { IsEthereumAddress, IsString } from "class-validator";

export class GetNonce {
    @IsEthereumAddress()
    address: string;
}