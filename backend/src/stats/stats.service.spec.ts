import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { Status, Role } from '@prisma/client';

const mockPrisma = {
  document: { count: jest.fn() },
  folder: { count: jest.fn() },
  invoice: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  request: { count: jest.fn() },
  meeting: { findFirst: jest.fn(), count: jest.fn() },
  accountantClient: { count: jest.fn(), findMany: jest.fn() },
  task: { count: jest.fn(), findMany: jest.fn() },
  accountantCollaborator: { findMany: jest.fn() },
  messageRead: { count: jest.fn() },
  user: { count: jest.fn() },
  organization: { aggregate: jest.fn() },
  review: { count: jest.fn() },
  auditLog: { findMany: jest.fn() },
};

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [StatsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getClientStats', () => {
    it('returns structured stats for a client', async () => {
      mockPrisma.document.count.mockResolvedValue(5);
      mockPrisma.folder.count.mockResolvedValue(2);
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 }, _count: { id: 3 } });
      mockPrisma.request.count.mockResolvedValue(1);
      mockPrisma.meeting.findFirst.mockResolvedValue(null);

      const result = await service.getClientStats('client-1');
      expect(result.documents).toBe(5);
      expect(result.invoices.count).toBe(3);
      expect(result.invoices.totalAmount).toBe(1000);
      expect(result.pendingRequests).toBe(1);
      expect(result.nextMeeting).toBeNull();
    });
  });

  describe('getAccountantStats', () => {
    it('returns structured stats for an accountant', async () => {
      mockPrisma.accountantClient.count.mockResolvedValue(10);
      mockPrisma.invoice.count.mockResolvedValue(3);
      mockPrisma.request.count.mockResolvedValue(2);
      mockPrisma.meeting.count.mockResolvedValue(1);
      mockPrisma.accountantClient.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getAccountantStats('acc-1');
      expect(result.clients).toBe(10);
      expect(result.pendingInvoices).toBe(3);
      expect(result.pendingRequests).toBe(2);
      expect(result.todayMeetings).toBe(1);
      expect(Array.isArray(result.revenueData)).toBe(true);
      expect(Array.isArray(result.pieData)).toBe(true);
    });

    it('returns default pie data when no clients', async () => {
      mockPrisma.accountantClient.count.mockResolvedValue(0);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.request.count.mockResolvedValue(0);
      mockPrisma.meeting.count.mockResolvedValue(0);
      mockPrisma.accountantClient.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getAccountantStats('acc-1');
      expect(result.pieData[0].name).toBe('Aucun client');
    });
  });

  describe('getCollaboratorStats', () => {
    it('returns structured stats for a collaborator', async () => {
      mockPrisma.request.count.mockResolvedValue(4);
      mockPrisma.task.count.mockResolvedValue(6);
      mockPrisma.document.count.mockResolvedValue(8);
      mockPrisma.messageRead.count.mockResolvedValue(2);

      const result = await service.getCollaboratorStats('collab-1');
      expect(result.pendingRequests).toBe(4);
      expect(result.pendingTasks).toBe(6);
      expect(result.documents).toBe(8);
    });
  });

  describe('getAdminDashboardStats', () => {
    it('returns admin statistics structure', async () => {
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.organization.aggregate.mockResolvedValue({ _sum: { storageUsed: 512 } });
      mockPrisma.review.count.mockResolvedValue(5);
      mockPrisma.request.count.mockResolvedValue(3);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getAdminDashboardStats();
      expect(result).toHaveProperty('usersByRole');
      expect(result).toHaveProperty('globalStats');
      expect(result).toHaveProperty('systemAlerts');
      expect(result.globalStats.storageUsed).toBe(512);
    });
  });

  describe('getAdminAnalytics', () => {
    it('returns analytics data with userGrowth and storageUsage', async () => {
      const result = await service.getAdminAnalytics();
      expect(result).toHaveProperty('userGrowth');
      expect(result).toHaveProperty('storageUsage');
      expect(Array.isArray(result.userGrowth)).toBe(true);
    });
  });
});
