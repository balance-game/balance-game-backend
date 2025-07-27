import { Expose } from "class-transformer";
import { IsNumber, IsString } from "class-validator";

export class EditComment {
    @IsNumber()
    @Expose({ name: "comment_id" })
    commentId: number

    @IsString()
    content: string;
}