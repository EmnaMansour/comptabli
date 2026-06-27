import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly mailService: MailService,
  ) {}

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async markRead(id: string, userId: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Utilisé par d'autres modules (demandes, messagerie, etc.) */
  async createForUser(
    userId: string,
    payload: {
      type: string;
      title: string;
      message: string;
      linkedId?: string;
      linkedType?: string;
      clientName?: string;
      clientMessage?: string;
      contactFormId?: string;
    },
  ) {
    const prefs = await this.getPreferences(userId);
    
    // Create in DB
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        linkedId: payload.linkedId ?? null,
        linkedType: payload.linkedType ?? null,
        clientName: payload.clientName ?? null,
        clientMessage: payload.clientMessage ?? null,
        contactFormId: payload.contactFormId ?? null,
      },
    });

    // 1. WebSocket Push
    if (prefs.inAppNotifications) {
      this.gateway.emitToUser(userId, notification);
    }

    // 2. Immediate Email Push
    // We only send immediate emails for certain types if allowed
    const isMeeting = payload.type === 'MEETING_REMINDER' || payload.type.startsWith('MEETING_');
    const isTask = payload.type.startsWith('TASK_');
    const isDoc = payload.type === 'NEW_DOCUMENT';
    const isContact = payload.type === 'CONTACT_RECEIVED';
    
    let shouldSendEmail = false;
    if (isMeeting && prefs.emailMeetingReminders) shouldSendEmail = true;
    if (isTask && prefs.emailTaskUpdates) shouldSendEmail = true;
    if (isDoc && prefs.emailNewDocuments) shouldSendEmail = true;
    if (isContact) shouldSendEmail = true; // Always email for new contacts
    // For other important generic ones, we might send email directly
    if (payload.type === 'ACCOUNT_CREATED' || payload.type === 'INVITATION') shouldSendEmail = true;

    if (shouldSendEmail) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await this.mailService.sendMail(user.email, payload.title, payload.message);
      }
    }

    return notification;
  }

  // --- Preferences ---
  async getPreferences(userId: string) {
    let prefs = await (this.prisma as any).notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await (this.prisma as any).notificationPreference.create({
        data: { userId },
      });
    }
    return prefs;
  }

  async updatePreferences(userId: string, data: any) {
    // Ensure it exists first
    await this.getPreferences(userId);
    return (this.prisma as any).notificationPreference.update({
      where: { userId },
      data: {
        emailDailySummary: data.emailDailySummary,
        emailMeetingReminders: data.emailMeetingReminders,
        emailTaskUpdates: data.emailTaskUpdates,
        emailNewDocuments: data.emailNewDocuments,
        inAppNotifications: data.inAppNotifications,
      },
    });
  }

  /**
   * Envoie une notification de contact reçu d'un client ou visiteur
   */
  async sendContactNotification(
    accountantId: string,
    clientId?: string,
    message?: string,
    contactFormId?: string,
    visitorName?: string,
  ) {
    const accountant = await this.prisma.user.findUnique({ where: { id: accountantId } });
    if (!accountant) return;

    let contactName = visitorName || 'Visiteur';
    
    if (clientId) {
      const client = await this.prisma.user.findUnique({ where: { id: clientId } });
      if (client) {
        contactName = client.companyName?.trim() || `${client.firstName} ${client.lastName}`.trim();
      }
    }

    const notification = await this.createForUser(accountantId, {
      type: 'CONTACT_RECEIVED',
      title: `Nouveau contact de ${contactName}`,
      message: message || '',
      linkedId: clientId,
      linkedType: clientId ? 'CLIENT_CONTACT' : 'VISITOR_CONTACT',
      clientName: contactName,
      clientMessage: message,
      contactFormId: contactFormId,
    });

    return notification;
  }

  /**
   * Envoie une notification quand un avis a été approuvé
   */
  async sendReviewNotification(accountantId: string, rating: number, comment?: string) {
    return this.createForUser(accountantId, {
      type: 'REVIEW_APPROVED',
      title: 'Un nouvel avis a été publié sur votre profil',
      message: `${rating}⭐ - ${comment?.substring(0, 80) || ''}`,
      linkedType: 'REVIEW',
    });
  }
}
