import { IsEnum } from "class-validator";
import { LikeType } from "src/comment/enum/like-type.enum";

export class HandleCommentLike {
    @IsEnum(LikeType)
    type: LikeType;
}