import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: MockPrismaService;
  let notificationsServiceMock: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    notificationsServiceMock = {
      createForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    it('should throw ForbiddenException if less than 2 participants', async () => {
      await expect(service.createConversation(['user-1'])).rejects.toThrow(ForbiddenException);
    });

    it('should create conversation with valid participants', async () => {
      const mockConvo = { id: 'conv-1', type: 'PRIVATE' };
      prisma.conversation.create.mockResolvedValue(mockConvo as any);

      const result = await service.createConversation(['user-1', 'user-2']);
      expect(result).toEqual(mockConvo);
      expect(prisma.conversation.create).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException if sender is not participant', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage('conv-1', 'invalid-sender', 'Hello')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should send message and notify other participants', async () => {
      const mockParticipant = { id: 'part-1', userId: 'sender-id', conversationId: 'conv-1' };
      prisma.conversationParticipant.findFirst.mockResolvedValue(mockParticipant as any);
      
      const mockMessage = {
        id: 'msg-1',
        content: 'Hello',
        sender: { firstName: 'John', lastName: 'Doe' }
      };
      prisma.message.create.mockResolvedValue(mockMessage as any);
      
      prisma.conversationParticipant.findMany.mockResolvedValue([
        { userId: 'other-user' }
      ] as any);

      await service.sendMessage('conv-1', 'sender-id', 'Hello');
      
      expect(prisma.message.create).toHaveBeenCalled();
      expect(notificationsServiceMock.createForUser).toHaveBeenCalledWith(
        'other-user',
        expect.objectContaining({ type: 'NEW_MESSAGE' })
      );
    });
  });
});
