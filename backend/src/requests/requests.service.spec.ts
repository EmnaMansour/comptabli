import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, Status } from '@prisma/client';

const mockPrisma = {
  request: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  accountantClient: { findMany: jest.fn(), findFirst: jest.fn() },
  accountantCollaborator: { findMany: jest.fn(), findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  task: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  organization: { findFirst: jest.fn() },
  requestAttachment: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  requestComment: { create: jest.fn() },
};
const mockNotifications = { createForUser: jest.fn().mockResolvedValue({}) };

describe('RequestsService', () => {
  let service: RequestsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('should create a request with PENDING status', async () => {
      const mockRequest = {
        id: 'req-1', status: Status.PENDING, clientId: 'client-1', accountantId: null,
        subject: 'Test', type: 'DOCUMENT',
        client: { firstName: 'John', lastName: 'Doe', companyName: null },
        accountant: null,
      };
      mockPrisma.request.create.mockResolvedValue(mockRequest);
      const result = await service.create({
        clientId: 'client-1', type: 'DOCUMENT', description: 'Need help', urgency: 'NORMAL',
      });
      expect(result.status).toBe(Status.PENDING);
      expect(mockNotifications.createForUser).not.toHaveBeenCalled();
    });

    it('should notify accountant when accountantId is set', async () => {
      const mockRequest = {
        id: 'req-1', status: Status.PENDING, clientId: 'client-1', accountantId: 'acc-1',
        subject: 'Help', type: 'DOCUMENT',
        client: { firstName: 'John', lastName: 'Doe', companyName: null },
        accountant: { firstName: 'Alice', lastName: 'A', companyName: null },
      };
      mockPrisma.request.create.mockResolvedValue(mockRequest);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.COMPTABLE });
      await service.create({
        clientId: 'client-1', type: 'DOCUMENT', description: 'Help', urgency: 'NORMAL', accountantId: 'acc-1',
      });
      expect(mockNotifications.createForUser).toHaveBeenCalledWith('acc-1', expect.objectContaining({ type: 'REQUEST' }));
    });
  });

  describe('findAll', () => {
    it('returns only own requests for CLIENT', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      await service.findAll('client-1', Role.CLIENT);
      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-1' } })
      );
    });

    it('returns empty array for unknown role', async () => {
      const result = await service.findAll('user-1', 'UNKNOWN' as Role);
      expect(result).toEqual([]);
    });
  });

  describe('updateOwn', () => {
    it('throws NotFoundException if request not found', async () => {
      mockPrisma.request.findFirst.mockResolvedValue(null);
      await expect(service.updateOwn('bad-id', 'client-1', { type: 'DOC' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if status is not PENDING', async () => {
      mockPrisma.request.findFirst.mockResolvedValue({ id: 'r1', status: Status.ACTIVE, clientId: 'client-1' });
      await expect(service.updateOwn('r1', 'client-1', { type: 'DOC' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException for COMPTABLE', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'r1', clientId: 'c1', status: Status.PENDING });
      await expect(service.remove('r1', 'acc-1', Role.COMPTABLE)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if CLIENT tries to delete non-PENDING request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'r1', clientId: 'client-1', status: Status.ACTIVE });
      await expect(service.remove('r1', 'client-1', Role.CLIENT)).rejects.toThrow(ForbiddenException);
    });

    it('allows CLIENT to delete PENDING request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'r1', clientId: 'client-1', status: Status.PENDING });
      mockPrisma.request.delete.mockResolvedValue({ id: 'r1' });
      await service.remove('r1', 'client-1', Role.CLIENT);
      expect(mockPrisma.request.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });
});
