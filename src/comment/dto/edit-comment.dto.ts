import { IsString } from "class-validator";

export class EditComment {
    @IsString()
    content: string;
}