import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';

function jwtDefaultExpiresSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN || '15m';
  if (raw.endsWith('m')) {
    const n = parseInt(raw.slice(0, -1), 10);
    return Number.isNaN(n) ? 900 : n * 60;
  }
  if (raw.endsWith('h')) {
    const n = parseInt(raw.slice(0, -1), 10);
    return Number.isNaN(n) ? 900 : n * 3600;
  }
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 900 : n;
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_comptabli_key',
      signOptions: { expiresIn: jwtDefaultExpiresSeconds() },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
