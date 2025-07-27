import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { Comment } from "src/comment/entity/comment.entity";
import { User } from "src/auth/entity/user.entity";

@Entity("game")
export class Game {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column({ type: "varchar", name: "option_a", length: 255 })
    optoinA: string;

    @Column({ type: "varchar", name: "option_b", length: 255 })
    optionB: string;

    @CreateDateColumn({ type: "timestamp", name: "created_at" })
    createdAt: Date;

    @Column({ type: "varchar", name: "created_by" })
    createdBy: string

    @Column({ type: "timestamp" })
    deadline: Date

    @OneToMany(() => Comment, (comment) => comment.game)
    comments: Comment[];

    @ManyToOne(() => User, (user) => user.games)
    @JoinColumn({ name: "created_by", referencedColumnName: "id" })
    user: User[];

}
