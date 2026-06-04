import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsService } from './meetings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, Status } from '@prisma/client';

const mockPrisma = {
  meeting: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  meetingAvailability: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  accountantLeave: { findMany: jest.fn() },
  meetingNote: { create: jest.fn() },
  meetingAction: { create: jest.fn() },
  accountantCollaborator: { findFirst: jest.fn() },
};

const mockNotifications = { createForUser: jest.fn().mockResolvedValue({}) };
const mockMail = { sendMeetingInviteEmail: jest.fn().mockResolvedValue({}) };

describe('MeetingsService', () => {
  let service: MeetingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();
    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('should throw ForbiddenException if scheduledAt is in the past', async () => {
      await expect(service.create({
        title: 'Test', type: 'VIDEO', duration: 30,
        scheduledAt: new Date('2020-01-01'),
        clientId: 'client-1',
      })).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if accountant is on leave', async () => {
      mockPrisma.meetingAvailability.findMany.mockResolvedValue([]);
      mockPrisma.accountantLeave.findMany.mockResolvedValue([{ id: 'leave-1' }]);

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await expect(service.create({
        title: 'Test', type: 'VIDEO', duration: 30,
        scheduledAt: future, clientId: 'client-1', accountantId: 'acc-1',
      })).rejects.toThrow(ForbiddenException);
    });

    it('should create a meeting when valid', async () => {
      mockPrisma.meetingAvailability.findMany.mockResolvedValue([]);
      mockPrisma.accountantLeave.findMany.mockResolvedValue([]);
      mockPrisma.meeting.findFirst.mockResolvedValue(null);
      const mockMeeting = {
        id: 'meet-1', title: 'Test', accountantId: 'acc-1', clientId: 'client-1',
        scheduledAt: new Date(), duration: 30,
        client: { firstName: 'John', lastName: 'Doe', companyName: null },
        accountant: { firstName: 'Alice', lastName: 'A', companyName: 'Comptabli' },
      };
      mockPrisma.meeting.create.mockResolvedValue(mockMeeting);

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await service.create({
        title: 'Test', type: 'VIDEO', duration: 30,
        scheduledAt: future, clientId: 'client-1', accountantId: 'acc-1',
      });
      expect(result.id).toBe('meet-1');
    });
  });

  describe('findAll', () => {
    it('returns meetings filtered by CLIENT role', async () => {
      mockPrisma.meeting.findMany.mockResolvedValue([{ id: 'm1' }]);
      const result = await service.findAll('client-1', Role.CLIENT);
      expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-1' } })
      );
      expect(result).toHaveLength(1);
    });

    it('returns meetings filtered by COMPTABLE role', async () => {
      mockPrisma.meeting.findMany.mockResolvedValue([]);
      await service.findAll('acc-1', Role.COMPTABLE);
      expect(mockPrisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountantId: 'acc-1' } })
      );
    });
  });

  describe('updateAvailability', () => {
    it('replaces slots', async () => {
      mockPrisma.meetingAvailability.deleteMany.mockResolvedValue({});
      mockPrisma.meetingAvailability.createMany.mockResolvedValue({ count: 2 });
      const slots = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      ];
      await service.updateAvailability('acc-1', slots);
      expect(mockPrisma.meetingAvailability.deleteMany).toHaveBeenCalledWith({ where: { userId: 'acc-1' } });
      expect(mockPrisma.meetingAvailability.createMany).toHaveBeenCalledWith({ data: expect.any(Array) });
    });
  });

  describe('setPV', () => {
    it('throws ForbiddenException if CLIENT tries to upload PV', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValue({ id: 'm1' });
      await expect(service.setPV('m1', 'client-1', Role.CLIENT, '/pv.pdf')).rejects.toThrow(ForbiddenException);
    });

    it('allows COMPTABLE to set PV', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValue({ id: 'm1' });
      mockPrisma.meeting.update.mockResolvedValue({ id: 'm1', pvUrl: '/pv.pdf' });
      const result = await service.setPV('m1', 'acc-1', Role.COMPTABLE, '/pv.pdf');
      expect(result.pvUrl).toBe('/pv.pdf');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException if meeting not found', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'acc-1', Role.COMPTABLE)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user has no access', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValue({ id: 'm1', clientId: 'other', accountantId: 'other' });
      await expect(service.remove('m1', 'user-1', Role.COLLABORATEUR)).rejects.toThrow(ForbiddenException);
    });
  });
});
