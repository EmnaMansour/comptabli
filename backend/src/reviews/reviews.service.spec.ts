import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';

const mockPrisma = {
  review: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  accountantClient: { findUnique: jest.fn() },
  accountantProfile: { findUnique: jest.fn(), update: jest.fn() },
};

const mockNotifications = {
  sendReviewNotification: jest.fn().mockResolvedValue({}),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('createReview', () => {
    it('throws ForbiddenException if no relation exists', async () => {
      mockPrisma.accountantClient.findUnique.mockResolvedValue(null);
      await expect(service.createReview('client-1', 'acc-1', 5)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if review already exists', async () => {
      mockPrisma.accountantClient.findUnique.mockResolvedValue({ id: 'link-1' });
      mockPrisma.review.findUnique.mockResolvedValue({ id: 'rev-1' });
      await expect(service.createReview('client-1', 'acc-1', 5)).rejects.toThrow(ConflictException);
    });

    it('creates review and updates profile stats', async () => {
      mockPrisma.accountantClient.findUnique.mockResolvedValue({ id: 'link-1' });
      mockPrisma.review.findUnique.mockResolvedValue(null); // No existing review
      mockPrisma.review.create.mockResolvedValue({ id: 'rev-1', rating: 4, accountantId: 'acc-1' });
      mockPrisma.review.findMany.mockResolvedValue([{ rating: 4 }, { rating: 5 }]); // for stats calc
      mockPrisma.accountantProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      
      const result = await service.createReview('client-1', 'acc-1', 4);
      expect(result.id).toBe('rev-1');
      expect(mockPrisma.accountantProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalReviews: 2, averageRating: 4.5 },
        })
      );
    });
  });

  describe('approveReview', () => {
    it('approves a review and sends notification', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({ id: 'rev-1', accountantId: 'acc-1', rating: 5 });
      mockPrisma.review.update.mockResolvedValue({ id: 'rev-1', status: Status.ACTIVE });
      mockPrisma.review.findMany.mockResolvedValue([{ rating: 5 }]);
      mockPrisma.accountantProfile.findUnique.mockResolvedValue({ id: 'prof-1' });

      await service.approveReview('rev-1');
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { status: Status.ACTIVE },
      });
      expect(mockNotifications.sendReviewNotification).toHaveBeenCalledWith('acc-1', 5, undefined);
    });
  });
});
