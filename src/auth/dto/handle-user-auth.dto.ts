import { IsEthereumAddress, Matches } from "class-validator";

export class HandleUserAuth {
    @IsEthereumAddress()
    address: string;

    @Matches(/^0x[a-fA-F0-9]+$/, { message: 'Invalid signature format' })
    signature;
}