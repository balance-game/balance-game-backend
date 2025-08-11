import { Expose } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateComment {
    @IsNumber()
    @Expose({ name: "game_id" })
    gameId: string

    @IsOptional()
    @IsNumber()
    @Expose({ name: "parent_id" })
    parentId: string | null;

    @IsString()
    content: string;
}