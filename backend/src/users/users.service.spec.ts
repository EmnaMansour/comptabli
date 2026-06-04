import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, Status } from '@prisma/client';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrismaService;
  let mailService: jest.Mocked<Partial<MailService>>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    mailService = {
      sendRegistrationVerificationEmail: jest.fn().mockResolvedValue({ sent: true, devPreviewUrl: 'url' }),
      sendActivationEmail: jest.fn().mockResolvedValue({ sent: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if email is already in use', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' } as any);
      
      await expect(
        service.create({ email: 'test@test.com', password: 'pw', firstName: 'John', lastName: 'Doe' }, Role.CLIENT, Status.PENDING)
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      
      const mockCreatedUser = { id: 'user-id', email: 'test@test.com', role: Role.CLIENT };
      prisma.user.create.mockResolvedValue(mockCreatedUser as any);
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockCreatedUser as any);

      const result = await service.create(
        { email: 'test@test.com', password: 'pw', firstName: 'John', lastName: 'Doe' },
        Role.CLIENT,
        Status.PENDING
      );

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.id).toBe('user-id');
      expect(mailService.sendActivationEmail).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = { id: '1', email: 'test@test.com' } as any;
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      const result = await service.findByEmail('test@test.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should return user if found', async () => {
      const mockUser = { id: '1', email: 'test@test.com' } as any;
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      const result = await service.findById('1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('removeSafe', () => {
    beforeEach(() => {
      prisma.accountantClient.count.mockResolvedValue(0);
      prisma.accountantCollaborator.count.mockResolvedValue(0);
      prisma.document.count.mockResolvedValue(0);
      prisma.folder.count.mockResolvedValue(0);
      prisma.meeting.count.mockResolvedValue(0);
      prisma.request.count.mockResolvedValue(0);
      prisma.task.count.mockResolvedValue(0);
    });

    it('should throw ForbiddenException if user has relations', async () => {
      prisma.accountantClient.findFirst.mockResolvedValue({ id: 'link-id' } as any);
      prisma.document.count.mockResolvedValue(5); 

      await expect(service.removeSafe('user-id', 'acc-id')).rejects.toThrow(ForbiddenException);
    });

    it('should delete user if no relations exist', async () => {
      prisma.accountantClient.findFirst.mockResolvedValue({ id: 'link-id' } as any);
      prisma.user.delete.mockResolvedValue({ id: 'user-id' } as any);

      const result = await service.removeSafe('user-id', 'acc-id');
      expect(result.id).toBe('user-id');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-id' } });
    });
  });
});
