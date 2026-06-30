import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, Status } from '@prisma/client';

// const mockPrisma = {
//   user: {
//     findMany: jest.fn(),
//     findFirst: jest.fn(),
//     findUnique: jest.fn(),
//     count: jest.fn(),
//     groupBy: jest.fn(),
//     update: jest.fn(),
//     delete: jest.fn(),
//   },
//   organization: {
//     aggregate: jest.fn(),
//     findMany: jest.fn(),
//     update: jest.fn(),
//     findUnique: jest.fn(),
//   },
//   review: { count: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
//   request: { count: jest.fn() },
//   auditLog: { findMany: jest.fn() },
//   refreshToken: { deleteMany: jest.fn() },
// };

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organization: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  review: { count: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  request: { count: jest.fn() },
  document: { count: jest.fn() },
  task: { count: jest.fn() },
  message: { count: jest.fn() },
  meeting: { count: jest.fn() },
  notification: { deleteMany: jest.fn() },
  meetingAvailability: { deleteMany: jest.fn() },
  organizationMember: { deleteMany: jest.fn() },
  folder: { deleteMany: jest.fn() },
  accountantClient: { deleteMany: jest.fn() },
  accountantCollaborator: { deleteMany: jest.fn() },
  accountantProfile: { deleteMany: jest.fn() },
  accountantContact: { deleteMany: jest.fn() },
  auditLog: { findMany: jest.fn(), updateMany: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
const mockAuditLog = { create: jest.fn(), findAll: jest.fn() };
const mockMail = { sendActivationEmail: jest.fn() };
const mockUsers = { create: jest.fn() };

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: MailService, useValue: mockMail },
        { provide: UsersService, useValue: mockUsers },
      ],
    }).compile();
    service = module.get<AdminService>(AdminService);
  });

  const actor = { userId: 'admin-1', email: 'admin@test.com', role: Role.ADMIN };

  it('should be defined', () => expect(service).toBeDefined());

  describe('createUser', () => {
    it('throws BadRequestException if role is ADMIN', async () => {
      await expect(service.createUser(actor, {
        email: 'newadmin@test.com', firstName: 'A', lastName: 'A', role: Role.ADMIN
      })).rejects.toThrow(BadRequestException);
    });

    it('creates a user and logs action', async () => {
      const mockCreated = { id: 'user-1', email: 'test@test.com', role: Role.COMPTABLE, status: Status.ACTIVE };
      mockUsers.create.mockResolvedValue(mockCreated);
      const result = await service.createUser(actor, {
        email: 'test@test.com', firstName: 'T', lastName: 'T', role: Role.COMPTABLE
      });
      expect(result.id).toBe('user-1');
      expect(mockAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_USER_CREATE' }));
    });
  });

  describe('updateUserStatus', () => {
    it('throws NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserStatus(actor, 'bad-id', Status.ACTIVE)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if trying to deactivate ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: Role.ADMIN });
      await expect(service.updateUserStatus(actor, 'admin-1', Status.INACTIVE)).rejects.toThrow(BadRequestException);
    });

    it('updates status and revokes tokens if INACTIVE', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.CLIENT });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: Status.INACTIVE });
      
      const result = await service.updateUserStatus(actor, 'user-1', Status.INACTIVE);
      expect(result.status).toBe(Status.INACTIVE);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('deleteUser', () => {
    it('throws BadRequestException if user is ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: Role.ADMIN });
      await expect(service.deleteUser(actor, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    // it('deletes user and logs action', async () => {
    //   mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.CLIENT });
    //   mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });
    //   const result = await service.deleteUser(actor, 'user-1');
    //   expect(result.success).toBe(true);
    //   expect(mockAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_USER_DELETE' }));
    // });
  it('deletes user and logs action', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.CLIENT });
  mockPrisma.document.count.mockResolvedValue(0);
  mockPrisma.request.count.mockResolvedValue(0);
  mockPrisma.task.count.mockResolvedValue(0);
  mockPrisma.message.count.mockResolvedValue(0);
  mockPrisma.meeting.count.mockResolvedValue(0);
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });

  const result = await service.deleteUser(actor, 'user-1');
  expect(result.success).toBe(true);
  expect(mockAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_USER_DELETE' }));
});
  
  });

  describe('updateStorageQuota', () => {
    it('throws BadRequestException if quota is invalid', async () => {
      await expect(service.updateStorageQuota(actor, 'org-1', -100)).rejects.toThrow(BadRequestException);
    });

    it('updates storage limit', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1', storageLimit: 100 });
      mockPrisma.organization.update.mockResolvedValue({ id: 'org-1', storageLimit: 1024 });
      const result = await service.updateStorageQuota(actor, 'org-1', 1024);
      expect(result.storageLimit).toBe(1024);
    });
  });
});
