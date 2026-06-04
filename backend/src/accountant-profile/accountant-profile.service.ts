import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AccountantProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Crée automatiquement un profil networking quand un comptable se connecte
   * ou lors du premier accès à son profil
   */
  async ensureProfileExists(accountantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: accountantId },
    });

    if (!user || user.role !== Role.COMPTABLE) {
      throw new BadRequestException('Utilisateur invalide ou non comptable');
    }

    const existingProfile = await this.prisma.accountantProfile.findUnique({
      where: { accountantId },
      include: {
        accountant: {
          select: { 
            id: true, firstName: true, lastName: true, email: true, phone: true,
            whatsapp: true, location: true, mapsLink: true, companyName: true,
            activitySector: true, legalType: true, headquarters: true,
            rcNumber: true, patenteUrl: true, rneUrl: true, website: true
          },
        },
        reviews: {
          where: { status: 'ACTIVE' },
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (existingProfile) {
      return existingProfile;
    }

    // Créer le profil avec les données du user
    return this.prisma.accountantProfile.create({
      data: {
        accountantId,
        companyName: user.companyName,
        phone: user.phone,
        email: user.email,
        location: user.location,
        mapsLink: user.mapsLink,
      },
      include: {
        accountant: {
          select: { 
            id: true, firstName: true, lastName: true, email: true, phone: true,
            whatsapp: true, location: true, mapsLink: true, companyName: true,
            activitySector: true, legalType: true, headquarters: true,
            rcNumber: true, patenteUrl: true, rneUrl: true, website: true
          },
        },
      },
    });
  }

  /**
   * Récupère le profil networking du comptable avec ses reviews
   */
  async getProfile(accountantId: string) {
    const profile = await this.prisma.accountantProfile.findUnique({
      where: { accountantId },
      include: {
        accountant: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true,
            whatsapp: true, location: true, mapsLink: true, companyName: true,
            activitySector: true, legalType: true, headquarters: true,
            rcNumber: true, patenteUrl: true, rneUrl: true, website: true
          },
        },
        reviews: {
          where: { status: 'ACTIVE' },
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profil networking introuvable');
    }

    return profile;
  }

  /**
   * Vérifie si un client a une relation active avec un comptable
   */
  async checkClientRelationship(accountantId: string, clientId: string) {
    const link = await this.prisma.accountantClient.findUnique({
      where: { accountantId_clientId: { accountantId, clientId } },
    });

    // Also check if a review already exists
    const existingReview = await this.prisma.review.findUnique({
      where: { clientId_accountantId: { clientId, accountantId } },
    });

    return {
      hasRelationship: !!link,
      hasExistingReview: !!existingReview,
    };
  }

  /**
   * Met à jour le profil networking (synchronisation bidirectionnelle)
   * Les modifications du profil comptable se reflètent automatiquement en networking
   */
  async updateProfile(accountantId: string, updateData: any) {
    const profile = await this.prisma.accountantProfile.findUnique({
      where: { accountantId },
    });

    if (!profile) {
      throw new NotFoundException('Profil networking introuvable');
    }

    // Filter safe fields
    const safeData: any = {};
    const allowedFields = [
      'companyName', 'specialties', 'phone', 'email', 'location',
      'mapsLink', 'bio', 'yearsExperience', 'isListed', 'profileImageUrl',
      'coverImageUrl', 'website'
    ];
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        safeData[key] = updateData[key];
      }
    }
    safeData.lastSyncedAt = new Date();

    // Mettre à jour le profil
    const updatedProfile = await this.prisma.accountantProfile.update({
      where: { accountantId },
      data: safeData,
      include: {
        accountant: {
          select: { 
            id: true, firstName: true, lastName: true, email: true, phone: true,
            whatsapp: true, location: true, mapsLink: true, companyName: true,
            activitySector: true, legalType: true, headquarters: true,
            rcNumber: true, patenteUrl: true, rneUrl: true, website: true
          },
        },
      },
    });

    // Synchronisation bidirectionnelle: mettre à jour aussi le User
    const userUpdateData: any = {};
    if (updateData.companyName !== undefined) userUpdateData.companyName = updateData.companyName;
    if (updateData.phone !== undefined) userUpdateData.phone = updateData.phone;
    if (updateData.location !== undefined) userUpdateData.location = updateData.location;
    if (updateData.mapsLink !== undefined) userUpdateData.mapsLink = updateData.mapsLink;
    if (updateData.whatsapp !== undefined) userUpdateData.whatsapp = updateData.whatsapp;
    if (updateData.activitySector !== undefined) userUpdateData.activitySector = updateData.activitySector;
    if (updateData.legalType !== undefined) userUpdateData.legalType = updateData.legalType;
    if (updateData.headquarters !== undefined) userUpdateData.headquarters = updateData.headquarters;
    if (updateData.rcNumber !== undefined) userUpdateData.rcNumber = updateData.rcNumber;
    if (updateData.patenteUrl !== undefined) userUpdateData.patenteUrl = updateData.patenteUrl;
    if (updateData.rneUrl !== undefined) userUpdateData.rneUrl = updateData.rneUrl;
    if (updateData.website !== undefined) userUpdateData.website = updateData.website;
    if (updateData.firstName !== undefined) userUpdateData.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) userUpdateData.lastName = updateData.lastName;

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: accountantId },
        data: userUpdateData,
      });
    }

    return updatedProfile;
  }

  /**
   * Récupère les avis (reviews) d'un comptable
   */
  async getReviews(accountantId: string) {
    return this.prisma.review.findMany({
      where: { accountantId, status: 'ACTIVE' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récalcule les stats d'avis (moyenne, total)
   */
  async updateReviewStats(accountantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { accountantId, status: 'ACTIVE' },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    return this.prisma.accountantProfile.update({
      where: { accountantId },
      data: {
        totalReviews,
        averageRating,
      },
    });
  }

  /**
   * Répertorie tous les comptables avec leurs fiches networking
   */
  async listAllProfiles(filters?: { specialty?: string; location?: string }) {
    const whereClause: any = { isListed: true };

    if (filters?.specialty) {
      whereClause.specialties = { has: filters.specialty };
    }

    if (filters?.location) {
      whereClause.location = { contains: filters.location, mode: 'insensitive' };
    }

    return this.prisma.accountantProfile.findMany({
      where: whereClause,
      include: {
        accountant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        reviews: {
          where: { status: 'ACTIVE' },
          select: { id: true, rating: true },
        },
      },
      orderBy: { averageRating: 'desc' },
    });
  }

  /**
   * Reçoit une demande de contact d'un client et crée une notification
   */
  async receiveContact(accountantId: string, clientId: string, message: string) {
    // Vérifier que le comptable existe
    const profile = await this.prisma.accountantProfile.findUnique({
      where: { accountantId },
    });

    if (!profile) {
      throw new NotFoundException('Profil du comptable introuvable');
    }

    // Check for existing contact (upsert)
    const existing = await this.prisma.accountantContact.findUnique({
      where: { accountantId_clientId: { accountantId, clientId } },
    });

    let contact;
    if (existing) {
      contact = await this.prisma.accountantContact.update({
        where: { id: existing.id },
        data: { message, status: 'UNREAD' },
      });
    } else {
      contact = await this.prisma.accountantContact.create({
        data: {
          accountantId,
          clientId,
          message,
          status: 'UNREAD',
        },
      });
    }

    // Notifier le comptable en temps réel
    const notification = await this.notificationsService.sendContactNotification(
      accountantId,
      clientId,
      message,
      contact.id,
    );

    // Mark notification as sent and link to notification
    if (notification) {
      await this.prisma.accountantContact.update({
        where: { id: contact.id },
        data: {
          notificationSent: true,
          notificationId: notification.id,
        },
      });
    }

    return contact;
  }

  /**
   * Reçoit une demande de contact d'un visiteur (non connecté) et crée une notification
   */
  async receiveVisitorContact(
    accountantId: string,
    data: {
      name: string;
      email: string;
      phone: string;
      company: string;
      subject: string;
      message: string;
    },
  ) {
    // Vérifier que le comptable existe
    const profile = await this.prisma.accountantProfile.findUnique({
      where: { accountantId },
    });

    if (!profile) {
      throw new NotFoundException('Profil du comptable introuvable');
    }

    const contact = await this.prisma.accountantContact.create({
      data: {
        accountantId,
        message: data.message,
        visitorName: data.name,
        visitorEmail: data.email,
        visitorPhone: data.phone,
        visitorCompany: data.company,
        visitorSubject: data.subject,
        status: 'UNREAD',
      },
    });

    // Notifier le comptable en temps réel
    // On construit un message au format attendu par le parser du frontend
    const summary = `[NOUVEAU CONTACT]
Nom: ${data.name}
Entreprise: ${data.company}
Tel: ${data.phone}
Email: ${data.email}
Sujet: ${data.subject}

Message:
${data.message}`;

    const notification = await this.notificationsService.sendContactNotification(
      accountantId,
      undefined, // Pas de clientId
      summary,
      contact.id,
      data.name,
    );

    // Mark notification as sent and link to notification
    if (notification) {
      await this.prisma.accountantContact.update({
        where: { id: contact.id },
        data: {
          notificationSent: true,
          notificationId: notification.id,
        },
      });
    }

    return contact;
  }

  /**
   * Récupère tous les contacts reçus par un comptable
   */
  async getReceivedContacts(accountantId: string) {
    return this.prisma.accountantContact.findMany({
      where: { accountantId },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Marque un contact comme lu
   */
  async markContactAsRead(contactId: string) {
    return this.prisma.accountantContact.update({
      where: { id: contactId },
      data: { status: 'READ' },
    });
  }

  /**
   * Récupère les comptables liés à un client
   */
  async getMyAccountants(clientId: string) {
    if (!clientId) return [];
    const links = await this.prisma.accountantClient.findMany({
      where: { clientId },
      select: { accountantId: true },
    });

    const accountantIds = links.map(l => l.accountantId);

    return this.prisma.accountantProfile.findMany({
      where: {
        accountantId: { in: accountantIds },
      },
      include: {
        accountant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        reviews: {
          where: { status: 'ACTIVE' },
          select: { id: true, rating: true },
        },
      },
    });
  }
  /**
   * Récupère le modèle de dossiers personnalisé d'un utilisateur
   */
  async getFolderTemplate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { folderTemplate: true },
    });
    return { template: user?.folderTemplate };
  }

  /**
   * Met à jour le modèle de dossiers personnalisé d'un utilisateur
   */
  async updateFolderTemplate(userId: string, template: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { folderTemplate: template },
    });
  }
}
