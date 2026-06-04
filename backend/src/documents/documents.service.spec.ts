import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { OcrService } from '../ocr/ocr.service';
import { Role } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaServiceMock: any;
  let notificationsServiceMock: any;
  let aiServiceMock: any;
  let ocrServiceMock: any;

  beforeEach(async () => {
    prismaServiceMock = {
      document: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      accountantClient: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      }
    };

    notificationsServiceMock = {
      createForUser: jest.fn(),
    };

    aiServiceMock = {
      extractData: jest.fn(),
    };

    ocrServiceMock = {
      extractInvoiceData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: AiService, useValue: aiServiceMock },
        { provide: OcrService, useValue: ocrServiceMock },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return documents for admin', async () => {
      const mockDocs = [{ id: 'doc1' }];
      prismaServiceMock.document.findMany.mockResolvedValue(mockDocs);

      const result = await service.findAll('adminId', Role.ADMIN);
      
      expect(prismaServiceMock.document.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockDocs);
    });

    it('should return documents for client', async () => {
      const mockDocs = [{ id: 'doc1', clientId: 'clientId' }];
      prismaServiceMock.document.findMany.mockResolvedValue(mockDocs);

      const result = await service.findAll('clientId', Role.CLIENT);
      
      expect(prismaServiceMock.document.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ clientId: 'clientId', archived: false })
      }));
      expect(result).toEqual(mockDocs);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if document does not exist', async () => {
      prismaServiceMock.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalidId', 'userId', Role.CLIENT)).rejects.toThrow(NotFoundException);
    });

    it('should return document if user is the client owner', async () => {
      const mockDoc = { id: 'doc1', clientId: 'userId' };
      prismaServiceMock.document.findUnique.mockResolvedValue(mockDoc);

      const result = await service.findOne('doc1', 'userId', Role.CLIENT);
      expect(result).toEqual(mockDoc);
    });

    it('should throw ForbiddenException if client is not the owner', async () => {
      const mockDoc = { id: 'doc1', clientId: 'otherId' };
      prismaServiceMock.document.findUnique.mockResolvedValue(mockDoc);

      await expect(service.findOne('doc1', 'userId', Role.CLIENT)).rejects.toThrow(ForbiddenException);
    });
  });
});
