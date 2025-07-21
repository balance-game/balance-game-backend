import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Comment } from "src/comment/entity/comment.entity";

@Entity("game")
export class Game {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column({ type: "varchar", length: 255 })
    optoinA: string;

    @Column({ type: "varchar", length: 255 })
    optionB: string;

    @CreateDateColumn({ type: "timestamp", name: "created_at" })
    createdAt: Date;

    @Column({ type: "varchar", length: 42 })
    createdBy: string

    @OneToMany(() => Comment, (comment) => comment.game)
    comments: Comment[];
}
