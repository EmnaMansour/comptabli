import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Status, Role } from '@prisma/client';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let prisma: MockPrismaService;
  let mailService: jest.Mocked<Partial<MailService>>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mailService = {
      sendPasswordResetEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if password matches', async () => {
      const user = { id: '1', email: 'test@test.com', password: 'hashedpassword' } as any;
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser({ email: 'test@test.com', password: 'password' });
      expect(result).toEqual(user);
    });

    it('should return null if password does not match', async () => {
      const user = { id: '1', email: 'test@test.com', password: 'hashedpassword' } as any;
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser({ email: 'test@test.com', password: 'wrongpassword' });
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      const result = await service.validateUser({ email: 'notfound@test.com', password: 'password' });
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found or bad password', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);
      await expect(service.login({ email: 'test@test.com', password: 'bad' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const user = { emailVerifiedAt: null } as any;
      jest.spyOn(service, 'validateUser').mockResolvedValue(user);
      await expect(service.login({ email: 'test@test.com', password: 'pw' })).rejects.toThrow(
        'Veuillez vérifier votre adresse e-mail avant de vous connecter.',
      );
    });

    it('should throw UnauthorizedException if status is PENDING', async () => {
      const user = { emailVerifiedAt: new Date(), status: Status.PENDING } as any;
      jest.spyOn(service, 'validateUser').mockResolvedValue(user);
      await expect(service.login({ email: 'test@test.com', password: 'pw' })).rejects.toThrow(
        'Votre compte est en attente de validation par un administrateur.',
      );
    });

    it('should successfully login and return tokens', async () => {
      const user = {
        id: '123',
        email: 'test@test.com',
        role: Role.CLIENT,
        firstName: 'John',
        lastName: 'Doe',
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
        status: Status.ACTIVE,
      } as any;

      jest.spyOn(service, 'validateUser').mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.login({ email: 'test@test.com', password: 'password' });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe('test@test.com');
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });
});
