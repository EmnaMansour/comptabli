import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

const mockPrisma = {
  document: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  invoice: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockHttp = {
  post: jest.fn(),
};

describe('OcrService', () => {
  let service: OcrService;

  beforeAll(() => {
    // Suppress NestJS logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();
    service = module.get<OcrService>(OcrService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('extraireEtSauvegarder', () => {
    it('throws NotFoundException if document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.extraireEtSauvegarder('doc-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('skips OCR if category is not FACTURATION or FACTURE', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', category: 'DEVIS', url: 'test.pdf' });
      await service.extraireEtSauvegarder('doc-1', 'user-1');
      expect(mockPrisma.document.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if file does not exist locally', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', category: 'FACTURE', url: 'test.pdf' });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      await expect(service.extraireEtSauvegarder('doc-1', 'user-1')).rejects.toThrow(NotFoundException);
      (fs.existsSync as jest.Mock).mockRestore();
    });
  });

  describe('obtenirResultat', () => {
    it('returns PAS_ENCORE_EXTRAIT if no extractedData', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ extractedData: null });
      const result = await service.obtenirResultat('doc-1');
      expect(result.statut).toBe('PAS_ENCORE_EXTRAIT');
    });

    it('returns parsed JSON data', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ extractedData: '{"statut":"TERMINE"}' });
      const result = await service.obtenirResultat('doc-1');
      expect(result.statut).toBe('TERMINE');
    });

    it('returns ERREUR if JSON is corrupted', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ extractedData: 'invalid json' });
      const result = await service.obtenirResultat('doc-1');
      expect(result.statut).toBe('ERREUR');
    });
  });
});
