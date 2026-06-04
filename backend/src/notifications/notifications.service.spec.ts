import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from '../mail/mail.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};
const mockGateway = { emitToUser: jest.fn() };
const mockMail = { sendMail: jest.fn().mockResolvedValue({}) };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsGateway, useValue: mockGateway },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findForUser', () => {
    it('returns notifications for user', async () => {
      const mockNotifs = [{ id: 'n1' }, { id: 'n2' }];
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifs);
      const result = await service.findForUser('user-1');
      expect(result).toEqual(mockNotifs);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } })
      );
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException if notification not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markRead('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('marks notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      mockPrisma.notification.update.mockResolvedValue({ id: 'n1', read: true });
      const result = await service.markRead('n1', 'user-1');
      expect(result.read).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllRead('user-1');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });

  describe('createForUser', () => {
    it('creates a notification and emits via websocket when inApp pref is on', async () => {
      const mockPrefs = { inAppNotifications: true, emailMeetingReminders: false, emailTaskUpdates: false, emailNewDocuments: false };
      // Use (prisma as any).notificationPreference mock
      (mockPrisma as any).notificationPreference.findUnique.mockResolvedValue(mockPrefs);
      const mockNotif = { id: 'n1', type: 'TEST', title: 'T', message: 'M', userId: 'user-1' };
      mockPrisma.notification.create.mockResolvedValue(mockNotif);

      const result = await service.createForUser('user-1', { type: 'TEST', title: 'T', message: 'M' });
      expect(result.id).toBe('n1');
      expect(mockGateway.emitToUser).toHaveBeenCalledWith('user-1', mockNotif);
    });

    it('does not emit websocket when inApp pref is off', async () => {
      const mockPrefs = { inAppNotifications: false, emailMeetingReminders: false, emailTaskUpdates: false, emailNewDocuments: false };
      (mockPrisma as any).notificationPreference.findUnique.mockResolvedValue(mockPrefs);
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
      await service.createForUser('user-1', { type: 'OTHER', title: 'T', message: 'M' });
      expect(mockGateway.emitToUser).not.toHaveBeenCalled();
    });
  });
});
