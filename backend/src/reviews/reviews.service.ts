import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Status } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAllAdmin(status?: Status) {
    return this.prisma.review.findMany({
      where: status ? { status } : {},
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        accountant: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approuve un avis et met à jour les stats du profil comptable
   */
  async approveReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable');

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: { status: Status.ACTIVE },
    });

    // Mettre à jour les stats du profil comptable
    await this.updateAccountantProfileStats(review.accountantId);

    // Notifier le comptable que son avis a été approuvé
    await this.notificationsService.sendReviewNotification(
      review.accountantId,
      review.rating,
      review.comment ?? undefined,
    );

    return updatedReview;
  }

  async updateStatus(id: string, status: Status) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable');

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: { status },
    });

    // Si changement de statut, mettre à jour les stats
    if (status === Status.ACTIVE || status === Status.REJECTED) {
      await this.updateAccountantProfileStats(review.accountantId);
    }

    return updatedReview;
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable');

    await this.prisma.review.delete({ where: { id } });

    // Mettre à jour les stats après suppression
    await this.updateAccountantProfileStats(review.accountantId);
  }

  /**
   * Crée un nouvel avis (uniquement si relation existe et pas de doublon)
   */
  async createReview(
    clientId: string,
    accountantId: string,
    rating: number,
    comment?: string,
  ) {
    // Valider que la relation client/comptable existe
    const link = await this.prisma.accountantClient.findUnique({
      where: { accountantId_clientId: { accountantId, clientId } },
    });

    if (!link) {
      throw new ForbiddenException(
        'Vous devez avoir une relation active avec ce comptable pour laisser un avis',
      );
    }

    // Vérifier qu'il n'y a pas déjà un avis du même client pour ce comptable
    const existingReview = await this.prisma.review.findUnique({
      where: { clientId_accountantId: { clientId, accountantId } },
    });

    if (existingReview) {
      throw new ConflictException('Vous avez déjà laissé un avis pour ce comptable');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('La note doit être entre 1 et 5');
    }

    const review = await this.prisma.review.create({
      data: {
        clientId,
        accountantId,
        rating,
        comment,
        status: Status.ACTIVE,
      },
    });

    // Mettre à jour les stats du profil comptable immédiatement
    await this.updateAccountantProfileStats(accountantId);

    return review;
  }

  async findAccountantReviews(accountantId: string) {
    return this.prisma.review.findMany({
      where: { accountantId, status: Status.ACTIVE }, // Seulement les avis validés
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findClientReviews(clientId: string) {
    return this.prisma.review.findMany({
      where: { clientId },
      include: {
        accountant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Recalcule les stats (moyenne, total) du profil comptable
   */
  private async updateAccountantProfileStats(accountantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { accountantId, status: Status.ACTIVE },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    // Check if the accountant profile exists before updating
    const profile = await this.prisma.accountantProfile.findUnique({
        where: { accountantId }
    });

    if (profile) {
        // Mettre à jour le profil
        await this.prisma.accountantProfile.update({
        where: { accountantId },
        data: {
            totalReviews,
            averageRating,
        },
        });
    }
  }
}
