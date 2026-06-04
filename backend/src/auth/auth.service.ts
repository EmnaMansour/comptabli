import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Role, Status, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<User | null> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (user && (await bcrypt.compare(loginDto.password, user.password))) {
      return user;
    }
    return null;
  }

  private accessTokenTtlSeconds(): number {
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

  private signAccess(user: User) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenTtlSeconds(),
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const days = parseInt(process.env.REFRESH_TOKEN_DAYS || '14', 10);
    const expiresAt = new Date(Date.now() + (Number.isNaN(days) ? 14 : days) * 24 * 3600 * 1000);
    await this.prisma.refreshToken.create({
      data: { token: raw, userId, expiresAt },
    });
    return raw;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Veuillez vérifier votre adresse e-mail avant de vous connecter.');
    }

    if (user.status === Status.PENDING) {
      throw new UnauthorizedException('Votre compte est en attente de validation par un administrateur.');
    }

    if (user.status === Status.INACTIVE) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const access_token = this.signAccess(user);
    const refresh_token = await this.issueRefreshToken(user.id);
    return {
      access_token,
      refresh_token,
      expires_in: this.accessTokenTtlSeconds(),
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: Boolean(user.emailVerifiedAt),
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedException('Refresh token manquant');
    }
    const row = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken.trim() },
      include: { user: true },
    });
    if (!row || row.expiresAt < new Date()) {
      if (row) {
        await this.prisma.refreshToken.delete({ where: { id: row.id } }).catch(() => undefined);
      }
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }
    const user = row.user;
    if (user.status === Status.INACTIVE) {
      throw new UnauthorizedException('Compte désactivé');
    }
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    const access_token = this.signAccess(user);
    const refresh_token = await this.issueRefreshToken(user.id);
    return {
      access_token,
      refresh_token,
      expires_in: this.accessTokenTtlSeconds(),
      token_type: 'Bearer',
    };
  }

  async revokeRefreshToken(refreshToken?: string) {
    if (!refreshToken?.trim()) return { ok: true };
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken.trim() },
    });
    return { ok: true };
  }

  async verifyEmail(plainToken: string) {
    if (!plainToken?.trim()) {
      throw new BadRequestException('Token manquant');
    }
    const hash = createHash('sha256').update(plainToken.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: hash,
        emailVerificationExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
        status: user.role === Role.CLIENT ? Status.ACTIVE : user.status,
      },
    });

    const message = updatedUser.status === Status.ACTIVE 
      ? 'Adresse e-mail confirmée. Votre compte est maintenant actif.' 
      : 'Adresse e-mail confirmée. Votre compte est en attente de validation par un administrateur.';

    return { ok: true, message };
  }

  async forgotPassword(email: string) {
    if (!email?.trim()) {
      throw new BadRequestException('E-mail requis');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Always return OK to prevent email enumeration
    if (!user) {
      return { ok: true, message: 'Si cette adresse existe, un lien de réinitialisation a été envoyé.' };
    }
    const plain = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plain).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 1 * 3600 * 1000); // 1 hour
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: tokenHash, passwordResetExpires },
    });
    await this.mailService.sendPasswordResetEmail(user.email, plain);
    return { ok: true, message: 'Si cette adresse existe, un lien de réinitialisation a été envoyé.' };
  }

  async resetPassword(plainToken: string, newPassword: string) {
    if (!plainToken?.trim()) {
      throw new BadRequestException('Token manquant');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }
    const hash = createHash('sha256').update(plainToken.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Lien invalide ou expiré. Veuillez refaire une demande.');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });
    return { ok: true, message: 'Mot de passe réinitialisé avec succès.' };
  }

  async registerComptable(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto, Role.COMPTABLE, Status.PENDING, undefined, {
      selfServeRegistration: true,
    });
  }

  async registerClientSelf(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto, Role.CLIENT, Status.PENDING, undefined, {
      selfServeRegistration: true,
    });
  }

  async checkEmail(email: string) {
    return this.usersService.findByEmail(email);
  }
}
