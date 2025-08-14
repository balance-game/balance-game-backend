import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("blockchain")
export class Blockchain {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", name: "chain_name", unique: true })
    chainName: string

    @Column({ type: "bigint", name: "chain_id", unique: true })
    chainId: string;

    @Column({ type: "bigint", name: "last_block_number" })
    lastBlockNumber: string;

}