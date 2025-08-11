import { User } from "src/auth/entity/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity("notification")
export class Notification {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string

    @Column({ name: "user_id", type: "bigint" })
    user_id: string;

    @ManyToOne(() => User, (user) => user.notifications)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;

    @Column({ type: "text", nullable: false})
    content: string;

    @Column({ type: "timestamp", nullable: false })
    read_at: Date;
}