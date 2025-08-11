import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { VoteOption } from "../enum/vote-option.enum";
import { User } from "src/auth/entity/user.entity";
import { Game } from "./game.entity";

@Entity("vote")
@Unique(['userId', 'gameId'])
export class Vote {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "user_id" })
    userId: number;

    @Column({ name: "game_id" })
    gameId: number;

    @Column({ type: "enum", enum: VoteOption, nullable: false })
    option: VoteOption;

    @ManyToOne(() => User, (user) => user.votes)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;
    
    @ManyToOne(() => Game, (game) => game.votes)
    @JoinColumn({ name: "game_id", referencedColumnName: "id" })
    game: Game;
}