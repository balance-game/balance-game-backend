import { Controller, Get, Post, Body, UseGuards, UseInterceptors, Req, Delete, Patch, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetNonce } from './dto/get-nonce.dto';
import { HandleUserAuth } from './dto/handle-user-auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { jwtInterceptor } from 'src/auth/interceptor/jwt.interceptor';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { Request } from 'express';
import { EditUser } from './dto/edit-user.dto';
import { jwtUser } from 'src/common/interface/jwt-user';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

  @Post("/nonce")
  getNonce(@Body() dto: GetNonce) {
    return this.authService.getNonce(dto);
  }

  @Post("/login")
  @UseInterceptors(jwtInterceptor)
  handleUserAuth(@Body() dto: HandleUserAuth) {
    return this.authService.handleUserAuth(dto);
  }

  @Post("/access-token")
  refreshToken(@Req() req: Request) {
    const refreshTokenId = Number(req.cookies["refreshTokenId"]);
    return this.authService.newAccessToken(refreshTokenId);
  }

  @Get("/me")
  @UseGuards(AuthGuard("jwt"))
  me(@GetUser() user: jwtUser) {
    return this.authService.me(user.userId);
  }

  @Patch("/")
  @UseGuards(AuthGuard("jwt"))
  editUserName(@GetUser() user: jwtUser, @Body() dto: EditUser) {
    return this.authService.editUserName(user.userId, dto);
  }

  @Delete("/")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(204)
  deleteUser(@GetUser() user: jwtUser) {
    return this.authService.deleteUser(user.userId);
  }  
}
