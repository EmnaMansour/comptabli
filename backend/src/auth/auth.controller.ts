import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token?: string }) {
    return this.authService.refreshTokens(body.refresh_token ?? '');
  }

  @Post('logout')
  async logout(@Body() body: { refresh_token?: string }) {
    return this.authService.revokeRefreshToken(body.refresh_token);
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { token?: string }) {
    return this.authService.verifyEmail(body.token ?? '');
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email?: string }) {
    return this.authService.forgotPassword(body.email ?? '');
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    return this.authService.resetPassword(body.token ?? '', body.password ?? '');
  }

  @Post('register/comptable')
  async registerComptable(@Body() createUserDto: CreateUserDto) {
    return this.authService.registerComptable(createUserDto);
  }

  @Post('register/client')
  async registerClient(@Body() createUserDto: CreateUserDto) {
    return this.authService.registerClientSelf(createUserDto);
  }

  @Post('check-email')
  async checkEmail(@Body() body: { email: string }) {
    const user = await this.authService.checkEmail(body.email);
    return { available: !user };
  }
}
