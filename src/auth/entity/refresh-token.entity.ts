import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToOne, PrimaryColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_token")
export class RefreshToken {
    @PrimaryColumn({ type: "varchar", length: 42 })
    address: string;

    @ManyToOne(() => User, (user) => user.refreshToken)
    @JoinColumn({ name: "address", referencedColumnName: "address" })
    user: User;

    @Column({ type: "varchar", length: 255, nullable: false })
    token: string;

    @Column({ name: "expriy_date", type: "timestamp", nullable: false })
    expriyDate: Date;
}