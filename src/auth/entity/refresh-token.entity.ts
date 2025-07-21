import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_token")
export class RefreshToken {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column({ unique: true, type: "varchar", length: 255, nullable: false })
    token: string;
    
    @ManyToOne(() => User, (user) => user.refreshToken)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;

    @Column({ name: "expiry_date", type: "timestamp", nullable: false })
    expiryDate: Date;
}