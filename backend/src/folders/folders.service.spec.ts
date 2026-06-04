import { Test, TestingModule } from '@nestjs/testing';
import { FoldersService } from './folders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

const mockPrisma = {
  folder: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  document: { updateMany: jest.fn() },
  accountantClient: { findFirst: jest.fn() },
  accountantCollaborator: { findFirst: jest.fn() },
};

describe('FoldersService', () => {
  let service: FoldersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FoldersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<FoldersService>(FoldersService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('creates a folder for CLIENT in their own space', async () => {
      mockPrisma.folder.create.mockResolvedValue({ id: 'f1', name: 'Test', clientId: 'client-1' });
      const result = await service.create('Test', 'client-1', Role.CLIENT);
      expect(result.id).toBe('f1');
    });

    it('throws ForbiddenException for COMPTABLE with no client link', async () => {
      mockPrisma.accountantClient.findFirst.mockResolvedValue(null);
      await expect(service.create('Test', 'acc-1', Role.COMPTABLE, undefined, 'other-client')).rejects.toThrow(ForbiddenException);
    });

    it('creates a folder for COMPTABLE linked to their client', async () => {
      mockPrisma.accountantClient.findFirst.mockResolvedValue({ accountantId: 'acc-1', clientId: 'client-1' });
      mockPrisma.folder.create.mockResolvedValue({ id: 'f1', clientId: 'client-1' });
      const result = await service.create('Test', 'acc-1', Role.COMPTABLE, undefined, 'client-1');
      expect(result.clientId).toBe('client-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if folder not found', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1', Role.CLIENT)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if CLIENT accesses another users folder', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue({ id: 'f1', clientId: 'other-client', documents: [], subFolders: [] });
      await expect(service.findOne('f1', 'client-1', Role.CLIENT)).rejects.toThrow(ForbiddenException);
    });

    it('allows CLIENT to access own folder', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue({ id: 'f1', clientId: 'client-1', documents: [], subFolders: [] });
      const result = await service.findOne('f1', 'client-1', Role.CLIENT);
      expect(result.id).toBe('f1');
    });
  });

  describe('updateName', () => {
    it('throws NotFoundException if folder not found', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue(null);
      await expect(service.updateName('bad-id', 'user-1', Role.CLIENT, 'New Name')).rejects.toThrow(NotFoundException);
    });

    it('updates folder name for CLIENT', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue({ id: 'f1', clientId: 'client-1' });
      mockPrisma.folder.update.mockResolvedValue({ id: 'f1', name: 'New Name' });
      const result = await service.updateName('f1', 'client-1', Role.CLIENT, 'New Name');
      expect(result.name).toBe('New Name');
    });
  });
});
