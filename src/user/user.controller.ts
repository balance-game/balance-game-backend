import { Controller, Get, Param, ParseFilePipeBuilder, Patch, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { jwtUser } from 'src/common/interface/jwt-user';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
    ) {}

    @Get("/me")
    @UseGuards(AuthGuard("jwt"))
    myProfile(@GetUser() user: jwtUser) {
        return this.userService.getUserProfile(user.userId);
    }

    @Get("/:userId")
    getUserProfile(@Param("userId") userId: string) {
        return this.userService.getUserProfile(userId);
    }

    @Get("/:userId/winner-history")
    getUserWinnerHistory(@Param("userId") userId: string) {
        return this.userService.getUserWinnerHistory(userId);
    }

    // Profile Image
    @Patch("/image")
    @UseInterceptors(FileInterceptor('file'))
    @UseGuards(AuthGuard("jwt"))
    editProfileImage(
    @UploadedFile(
        new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .build({ errorHttpStatusCode: 422 })
    )
    file: Express.Multer.File,
    @GetUser() user: jwtUser
    ) {
        return this.userService.editProfileImage(file, user.userId);
    }
}