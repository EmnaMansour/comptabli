import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';
import { Status } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockData = {
      documentId: 'doc-1',
      vendorName: 'EDF',
      totalAmount: 100,
    };

    it('should update document status and create a new invoice if not exists', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.document.update.mockResolvedValue({} as any);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', ...mockData } as any);

      const result = await service.create(mockData);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: Status.VALIDATED },
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: { ...mockData, status: Status.VALIDATED },
      });
      expect(result.id).toBe('inv-1');
    });

    it('should update document and update existing invoice if it already exists', async () => {
      const existingInvoice = { id: 'inv-1', documentId: 'doc-1' } as any;
      prisma.invoice.findFirst.mockResolvedValue(existingInvoice);
      prisma.document.update.mockResolvedValue({} as any);
      prisma.invoice.update.mockResolvedValue({ ...existingInvoice, vendorName: 'EDF' } as any);

      const result = await service.create(mockData);

      expect(prisma.document.update).toHaveBeenCalled();
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          vendorName: 'EDF',
          status: Status.VALIDATED,
        }),
      });
      expect(result.id).toBe('inv-1');
    });
  });

  describe('findOne', () => {
    it('should return an invoice', async () => {
      const invoice = { id: 'inv-1' } as any;
      prisma.invoice.findUnique.mockResolvedValue(invoice);

      const result = await service.findOne('inv-1');
      expect(result).toEqual(invoice);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCorrection', () => {
    it('should create an invoice correction record', async () => {
      const correction = { id: 'corr-1', field: 'totalAmount' } as any;
      prisma.invoiceCorrection.create.mockResolvedValue(correction);

      const result = await service.addCorrection('inv-1', 'user-1', 'totalAmount', '100', '150');
      
      expect(prisma.invoiceCorrection.create).toHaveBeenCalledWith({
        data: {
          invoiceId: 'inv-1',
          correctedBy: 'user-1',
          field: 'totalAmount',
          oldValue: '100',
          newValue: '150',
        },
      });
      expect(result.id).toBe('corr-1');
    });
  });
});
