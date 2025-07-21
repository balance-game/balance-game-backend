import { Controller, Get, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetNonce } from './dto/get-nonce.dto';
import { HandleUserAuth } from './dto/handle-user-auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { jwtInterceptor } from 'src/interceptors/jwt.interceptor';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { JwtPayload } from 'src/common/interface/jwt-payload';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

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

  @Post("/nonce")
  getNonce(@Body() dto: GetNonce) {
    return this.authService.getNonce(dto);
  }

  @Get("/me")
  @UseGuards(AuthGuard("jwt"))
  me(@GetUser() user: JwtPayload) {
    return this.authService.me(user.userId);
  }
}
