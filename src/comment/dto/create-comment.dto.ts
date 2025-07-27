import { Expose } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateComment {
    @IsNumber()
    @Expose({ name: "game_id" })
    gameId: number

    @IsOptional()
    @IsNumber()
    @Expose({ name: "parent_id" })
    parentId: number | null;

    @IsString()
    content: string;
}