import { User } from "src/auth/entity/user.entity";
import { Game } from "src/game/entity/game.entity";
import { Like } from "./like.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity,JoinColumn,ManyToOne,OneToMany,PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("comment")
export class Comment {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column({ type: "bigint", name: "game_id", nullable: false })
    gameId: number;

    @ManyToOne(() => Game, (game) => game.comments)
    @JoinColumn({ name: "game_id", referencedColumnName: "id"})
    game: Game;

    @Column({ type: "text", nullable: false })
    content: string;

    @Column({ type: "varchar", length: 42, nullable: false })
    author: string;

    @ManyToOne(() => User, (user) => user.comments)
    @JoinColumn({ name: "author", referencedColumnName: "name" })
    user: User;

    @Column({ type: "bigint", name: "parent_id", nullable: true })
    parentId: number;

    @Column({ type: "int", name: "like_count", default: 0, nullable: false })
    likeCount: number

    @Column({ type: "int", name: "dis_like_count", default: 0, nullable: false })
    disLikeCount: number

    @CreateDateColumn({ type: "timestamp", name: "created_at", nullable: false})
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamp", name: "update_at", nullable: false })
    updateAt: Date;

    @DeleteDateColumn({ type: "timestamp", name: "deleted_at", nullable: true })
    deletedAt: Date;

    @OneToMany(() => Like, (like) => like.comment)
    likes: Like[];
}