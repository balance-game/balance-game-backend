import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { JwtPayload } from 'src/common/interface/jwt-payload';
import { CreateComment } from './dto/create-comment.dto';
import { EditComment } from './dto/edit-comment.dto';
import { jwtUser } from 'src/common/interface/jwt-user';

@Controller('comment')
@UseGuards(AuthGuard("jwt"))
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post("/")
  createComment(@GetUser() user: jwtUser, @Body() dto: CreateComment) {
    return this.commentService.createComment(user, dto);
  }

  @Put("/")
  editComment(@GetUser() user: jwtUser, @Body() dto: EditComment) {
    return this.commentService.editComment();
  }

  @Delete("/:id")
  deleteComment(@GetUser() user: jwtUser, @Param("id") id: number) {
    return this.commentService.deleteComment()
  }
}
