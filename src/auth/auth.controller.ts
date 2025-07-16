import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/nonce")
  getNonce() {

  }

  @Post("/signup")
  signup() {

  }

  @Post("/login")
  login() {

  }

  @Get("/me")
  me() {

  }
}
