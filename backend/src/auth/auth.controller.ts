import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Express } from 'express';
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
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          const baseName = safeName.replace(new RegExp(`\\${ext}$`), '');
          callback(null, `${timestamp}-${baseName}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    }),
  )
  async uploadPublic(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return { url: `/uploads/${file.filename}` };
  }
}
