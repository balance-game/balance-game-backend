import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, PrimaryColumnCannotBeNullableError } from "typeorm";
import { User } from "./user.entity";

@Entity("nonce")
export class Nonce {
  @PrimaryColumn({ type: "varchar", length: 42 })
  address: string;

  @Column({ nullable: false })
  nonce: number;

  @OneToOne(() => User) 
  @JoinColumn({ name: "address", referencedColumnName: "address" })
  user: User;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}
