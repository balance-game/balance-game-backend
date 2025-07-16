import { User } from "src/auth/entity/user.entity";
import { LikeType } from "src/auth/enum/like-type.enum";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Comment } from "./comment.entity";

@Entity("like")
export class Like {
    @PrimaryColumn()
    address;

    @PrimaryColumn({ name: "comment_id" })
    commentId;

    @Column({ type: "enum", enum: LikeType, nullable: false })
    type;

    @ManyToOne(() => User, (user) => user.likes) // ← 유저가 남긴 like들
    @JoinColumn({ name: "address", referencedColumnName: "address" })
    user: User;

    @ManyToOne(() => Comment, (comment) => comment.likes) // ← 댓글에 달린 like들
    @JoinColumn({ name: "comment_id", referencedColumnName: "id" })
    comment: Comment;
}