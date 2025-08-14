import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { jwtUser } from 'src/common/interface/jwt-user';

@Controller('user/profile')
export class UserController {
    constructor(
        private readonly userService: UserService
    ) {}

    @Get("/me")
    @UseGuards(AuthGuard("jwt"))
    myProfile(@GetUser() user: jwtUser) {
        return this.userService.myProfile(user);
    }

    @Get("/:id")
    getUserProfile(@Param("id") id: string) {
        return this.userService.getUserProfile(id);
    }
}
