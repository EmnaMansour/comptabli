import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  organization: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAllAdmin', () => {
    it('returns all organizations ordered by storage', async () => {
      const mockOrgs = [{ id: 'org-1', storageUsed: 500 }, { id: 'org-2', storageUsed: 100 }];
      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      const result = await service.findAllAdmin();
      expect(result).toHaveLength(2);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { storageUsed: 'desc' } })
      );
    });
  });

  describe('updateQuota', () => {
    it('throws NotFoundException if organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.updateQuota('bad-id', 1024)).rejects.toThrow(NotFoundException);
    });

    it('updates the storage limit', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1', storageLimit: 100 });
      mockPrisma.organization.update.mockResolvedValue({ id: 'org-1', storageLimit: 1024 });
      const result = await service.updateQuota('org-1', 1024);
      expect(result.storageLimit).toBe(1024);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { storageLimit: 1024 },
      });
    });
  });
});
