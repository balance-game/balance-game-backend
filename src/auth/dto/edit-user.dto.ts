import { IsString, MaxLength } from "class-validator";

export class EditUser {
    @IsString()
    @MaxLength(42)
    name: string
}