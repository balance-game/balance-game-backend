import { User } from "src/auth/entity/user.entity";
import { LikeType } from "src/auth/enum/like-type.enum";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Comment } from "./comment.entity";

@Entity("like")
export class Like {
    @PrimaryColumn({ name: "user_id" })
    userId;

    @PrimaryColumn({ name: "comment_id" })
    commentId;

    @Column({ type: "enum", enum: LikeType, nullable: false })
    type;

    @ManyToOne(() => User, (user) => user.likes)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;

    @ManyToOne(() => Comment, (comment) => comment.likes)
    @JoinColumn({ name: "comment_id", referencedColumnName: "id" })
    comment: Comment;
}