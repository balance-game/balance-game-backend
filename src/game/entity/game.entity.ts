import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Comment } from "src/comment/entity/comment.entity";
import { User } from "src/auth/entity/user.entity";
import { Vote } from "./vote.entity";
import { GameWinner } from "src/game/entity/game-winner.entity";

@Entity("game")
export class Game {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string;

    @Column({ type: "varchar", name: "topic", length: 255 })
    topic: string;

    @Column({ type: "varchar", name: "option_a", length: 255 })
    optionA: string;

    @Column({ type: "varchar", name: "option_b", length: 255 })
    optionB: string;

    @Column({ type: "timestamp", name: "created_at" })
    createdAt: Date;

    @Column({ type: "bigint", name: "vote_count_a", default: 0, nullable: false })
    voteCountA: string;

    @Column({ type: "bigint", name: "vote_count_b", default: 0, nullable: false })
    voteCountB: string;

    @Column({ type: "bigint", name: "total_pool", default: 0, nullable: false })
    totalPool: string;

    @Column({ type: "bigint", name: "created_by" })
    createdBy: string;

    @Column({ type: "timestamp" })
    deadline: Date;

    @Column({ type: "boolean", name: "is_checked", default: false })
    isChecked: boolean;

    @Column({ type: "text", name: "fail_message", default: null, select: false })
    failMessage: string;

    @OneToMany(() => Comment, (comment) => comment.game)
    comments: Comment[];

    @OneToMany(() => Vote, (vote) => vote.game)
    votes: Vote[];

    @OneToMany(() => GameWinner, (gameWinner) => gameWinner.game)
    gameWinners: GameWinner[];

    @ManyToOne(() => User, (user) => user.games)
    @JoinColumn({ name: "created_by", referencedColumnName: "id" })
    user: User;
}
