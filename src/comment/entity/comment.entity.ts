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

    @Column({ name: 'author', type: 'bigint', nullable: false })
    author: number;

    @ManyToOne(() => User, (user) => user.comments)
    @JoinColumn({ name: "author", referencedColumnName: "id" })
    user: User;

    @Column({ type: "bigint", name: "parent_id", nullable: true })
    parentId: number | null;

    @CreateDateColumn({ type: "timestamp", name: "created_at", nullable: false})
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamp", name: "update_at", nullable: false })
    updatedAt: Date;

    @DeleteDateColumn({ type: "timestamp", name: "deleted_at", nullable: true })
    deletedAt: Date;

    @OneToMany(() => Like, (like) => like.comment)
    likes: Like[];
}