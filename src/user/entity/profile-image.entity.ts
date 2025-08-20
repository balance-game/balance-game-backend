import { User } from "src/auth/entity/user.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity("profile_image")
export class ProfileImage {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string;

    @Column({ type: "bigint", name: "user_id", unique: true, select: false })
    userId: string;

    @Column({ type: "varchar", name: "url", length: "255" })
    url: string;
    
    @OneToOne(() => User, (user) => user.profileImage)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;
}