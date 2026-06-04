import { Test, TestingModule } from '@nestjs/testing';
import { LeavesService } from './leaves.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';

describe('LeavesService', () => {
  let service: LeavesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeavesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeavesService>(LeavesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a leave record', async () => {
      const leaveData = {
        accountantId: 'acc-1',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-15'),
        reason: 'Vacances d\'été',
      };
      const mockLeave = { id: 'leave-1', ...leaveData };
      prisma.accountantLeave.create.mockResolvedValue(mockLeave as any);

      const result = await service.create(leaveData);

      expect(result).toEqual(mockLeave);
      expect(prisma.accountantLeave.create).toHaveBeenCalledWith({ data: leaveData });
    });
  });

  describe('findAllByAccountant', () => {
    it('should return all leaves for the accountant', async () => {
      const mockLeaves = [
        { id: 'leave-1', accountantId: 'acc-1', startDate: new Date(), endDate: new Date() },
      ];
      prisma.accountantLeave.findMany.mockResolvedValue(mockLeaves as any);

      const result = await service.findAllByAccountant('acc-1');

      expect(result).toEqual(mockLeaves);
      expect(prisma.accountantLeave.findMany).toHaveBeenCalledWith({
        where: { accountantId: 'acc-1' },
        orderBy: { startDate: 'desc' },
      });
    });

    it('should return empty array if no leaves exist', async () => {
      prisma.accountantLeave.findMany.mockResolvedValue([]);
      const result = await service.findAllByAccountant('acc-1');
      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if leave does not exist', async () => {
      prisma.accountantLeave.findUnique.mockResolvedValue(null);
      await expect(service.remove('invalid-id', 'acc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if accountantId does not match', async () => {
      const mockLeave = { id: 'leave-1', accountantId: 'other-acc' };
      prisma.accountantLeave.findUnique.mockResolvedValue(mockLeave as any);
      await expect(service.remove('leave-1', 'acc-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete the leave if everything is valid', async () => {
      const mockLeave = { id: 'leave-1', accountantId: 'acc-1' };
      prisma.accountantLeave.findUnique.mockResolvedValue(mockLeave as any);
      prisma.accountantLeave.delete.mockResolvedValue(mockLeave as any);

      const result = await service.remove('leave-1', 'acc-1');

      expect(result).toEqual(mockLeave);
      expect(prisma.accountantLeave.delete).toHaveBeenCalledWith({ where: { id: 'leave-1' } });
    });
  });
});
