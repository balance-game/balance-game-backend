import { User } from "src/auth/entity/user.entity";
import { Game } from "src/game/entity/game.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("game_winner")
@Unique(['gameId', 'userId'])
export class GameWinner {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string;

    @Column({ type: "bigint", name: "game_id" })
    gameId: string;

    @Column({ type: "bigint", name: "user_id" })
    userId: string;

    @Column({ type: "tinyint" })
    rank: number;

    @Column({ type: "bigint", name: "claim_pool", default: 0 })
    claimPool: string;

    @Column({ name: "is_claimed", default: false })
    isClaimed: boolean;

    @ManyToOne(() => Game, (game) => game.gameWinners)
    @JoinColumn({ name: "game_id", referencedColumnName: "id" })
    game: Game;

    @ManyToOne(() => User, (user) => user.gameWinners)
    @JoinColumn({ name: "user_id", referencedColumnName: "id" })
    user: User;
}