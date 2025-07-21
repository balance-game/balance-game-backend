import { User } from "src/auth/entity/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity("notification")
export class Notification {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, (user) => user.notifications)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;

    @Column({ type: "text", nullable: false})
    content: string;

    @Column({ type: "timestamp", nullable: false })
    read_at: Date;
}