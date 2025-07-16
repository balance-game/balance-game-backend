import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Role } from "../enum/role.enum";
import { RefreshToken } from "./refresh-token.entity";
import { Comment } from "src/comment/entity/comment.entity";
import { Notification } from "src/notification/entity/notification.entity";
import { Like } from "src/comment/entity/like.entity";

@Entity("user")
export class User {
  @PrimaryColumn({ type: "varchar", length: 42 })
  address: string;

  @Column({ unique: true, type: "varchar", length: 42, nullable: false })
  name: string;

  @Column({ type: "enum", enum: Role, default: Role.USER, nullable: false })
  role: Role;

  @CreateDateColumn({ name: "created_at", type: "timestamp", nullable: false })
  createdAt: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamp", nullable: true })
  deletedAt: Date;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshToken: RefreshToken[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];
}
