import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { Comment } from "src/comment/entity/comment.entity";
import { User } from "src/auth/entity/user.entity";
import { Vote } from "./vote.entity";

@Entity("game")
export class Game {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string;

    @Column({ type: "varchar", name: "option_a", length: 255 })
    optionA: string;

    @Column({ type: "varchar", name: "option_b", length: 255 })
    optionB: string;

    @CreateDateColumn({ type: "timestamp", name: "created_at" })
    createdAt: Date;

    @Column({ type: "bigint", name: "vote_count_a", default: 0, nullable: false })
    voteCountA: string;

    @Column({ type: "bigint", name: "vote_count_b", default: 0, nullable: false })
    voteCountB: string;

    @Column({ type: "bigint", name: "created_by" })
    createdBy: string

    @Column({ type: "timestamp" })
    deadline: Date

    @OneToMany(() => Comment, (comment) => comment.game)
    comments: Comment[];

    @OneToMany(() => Vote, (vote) => vote.game)
    votes: Vote[];

    @ManyToOne(() => User, (user) => user.games)
    @JoinColumn({ name: "created_by", referencedColumnName: "id" })
    user: User;
}
