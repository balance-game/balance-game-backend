import { User } from "src/auth/entity/user.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity("profile_image")
export class ProfileImage {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string;

    @Column({ type: "bigint", name: "user_id", unique: true })
    userId: string;

    @Column({ type: "varchar", name: "image_name", length: "255" })
    imageName: string;
    
    @OneToOne(() => User, (user) => user.profileImage)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;
}