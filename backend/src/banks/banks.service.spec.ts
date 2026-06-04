import { Test, TestingModule } from '@nestjs/testing';
import { BanksService } from './banks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  bankAccount: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  bankTransaction: {
    create: jest.fn(),
  },
};

describe('BanksService', () => {
  let service: BanksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BanksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<BanksService>(BanksService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('creates a bank account', async () => {
      mockPrisma.bankAccount.create.mockResolvedValue({ id: 'bank-1', bankName: 'Test Bank' });
      const result = await service.create({ bankName: 'Test Bank' }, 'user-1');
      expect(result.id).toBe('bank-1');
      expect(mockPrisma.bankAccount.create).toHaveBeenCalledWith({
        data: { bankName: 'Test Bank', userId: 'user-1' },
      });
    });
  });

  describe('findAll', () => {
    it('returns all bank accounts for a user', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([{ id: 'bank-1' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if account not found', async () => {
      mockPrisma.bankAccount.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user does not own account', async () => {
      mockPrisma.bankAccount.findUnique.mockResolvedValue({ id: 'bank-1', userId: 'other-user' });
      await expect(service.findOne('bank-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns account if user owns it', async () => {
      mockPrisma.bankAccount.findUnique.mockResolvedValue({ id: 'bank-1', userId: 'user-1' });
      const result = await service.findOne('bank-1', 'user-1');
      expect(result.id).toBe('bank-1');
    });
  });

  describe('addTransaction', () => {
    it('adds a transaction and updates balance', async () => {
      mockPrisma.bankAccount.findUnique.mockResolvedValue({ id: 'bank-1', userId: 'user-1' });
      mockPrisma.bankAccount.update.mockResolvedValue({ id: 'bank-1' });
      mockPrisma.bankTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.addTransaction('bank-1', { operation: 'DEPOSIT', amount: 100 }, 'user-1');
      expect(result.id).toBe('tx-1');
      expect(mockPrisma.bankAccount.update).toHaveBeenCalledWith({
        where: { id: 'bank-1' },
        data: { balance: { increment: 100 } },
      });
    });
  });
});
