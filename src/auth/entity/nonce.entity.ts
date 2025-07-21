import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("nonce")
export class Nonce {
  @PrimaryColumn({ type: "varchar", length: 42 })
  address: string;

  @Column({ type: "bigint", nullable: false })
  nonce: number;

  @Column({ name: "expiry_date", type: "timestamp", nullable: false })
  expiryDate: Date;
}
