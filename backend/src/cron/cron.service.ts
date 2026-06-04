import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { Status } from '@prisma/client';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  // Run every 15 minutes to find upcoming meetings
  @Cron('*/15 * * * *')
  async handleMeetingReminders() {
    this.logger.log('Vérification des réunions à venir...');
    const now = new Date();
    
    // Look for meetings exactly 24h or 1h from now
    // We check meetings that start within the next 15 minutes window of our targets
    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: Status.ACTIVE, // only active meetings should trigger reminders
      },
      include: {
        client: true,
        accountant: true,
      }
    });

    for (const meeting of meetings) {
      const meetingDateTime = meeting.scheduledAt;
      const diffMs = meetingDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // We trigger if it's strictly between what we expect and the interval limit.
      // E.g. approx 24 hours (23.75 to 24.0)
      if (diffHours > 23.75 && diffHours <= 24.0) {
        await this.notifyMeeting(meeting, '24 heures');
      } else if (diffHours > 0.75 && diffHours <= 1.0) {
        await this.notifyMeeting(meeting, '1 heure');
      }
    }
  }

  private async notifyMeeting(meeting: any, timeRemaining: string) {
    const message = `Rappel : Vous avez une réunion prévue dans ${timeRemaining}.`;
    const details = meeting.meetingLink ? `Lien Visio : ${meeting.meetingLink}` : '';

    const payload = {
      type: 'MEETING_REMINDER',
      title: 'Rappel de Réunion',
      message: `${message} ${details}`,
      linkedId: meeting.id,
      linkedType: 'Meeting',
    };

    if (meeting.accountantId) {
      await this.notificationsService.createForUser(meeting.accountantId, payload);
    }
    if (meeting.clientId) {
      await this.notificationsService.createForUser(meeting.clientId, payload);
    }
  }

  // Daily summary at 18:00
  @Cron('0 18 * * *')
  async handleDailySummary() {
    this.logger.log('Envoi des résumés quotidiens (18:00)...');
    
    // Find all users who have daily summary ON
    const preferences = await (this.prisma as any).notificationPreference.findMany({
      where: { emailDailySummary: true },
      include: { user: true }
    });

    for (const pref of preferences) {
      // Find unread notifications for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unreadCount = await this.prisma.notification.count({
        where: {
          userId: pref.userId,
          read: false,
          createdAt: { gte: today }
        }
      });

      if (unreadCount > 0) {
        const text = `Bonjour ${pref.user.firstName},\n\nVoici votre résumé quotidien : vous avez ${unreadCount} nouvelle(s) notification(s) non lue(s) sur Comptabli.\n\nConnectez-vous pour les consulter.`;
        await this.mailService.sendMail(pref.user.email, 'Comptabli - Résumé de la journée', text);
      }
    }
  }

  // Check request deadlines every morning at 09:00
  @Cron('0 9 * * *')
  async handleRequestReminders() {
    this.logger.log('Vérification des échéances des demandes...');
    const now = new Date();

    const requests = await this.prisma.request.findMany({
      where: {
        status: { in: [Status.PENDING, Status.ACTIVE] },
        dueDate: { not: null },
      },
    });

    for (const req of requests) {
      const dueDate = req.dueDate as Date;
      const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 2.5 && diffDays <= 3.5) {
        // 3 days before
        if (req.accountantId) {
          await this.notificationsService.createForUser(req.accountantId, {
            type: 'REQUEST_REMINDER',
            title: 'Échéance proche (3 jours)',
            message: `La demande "${req.subject || req.type}" arrive à échéance dans 3 jours.`,
            linkedId: req.id,
            linkedType: 'Request',
          });
        }
      } else if (diffDays < 0) {
        // Late
        if (req.accountantId) {
          await this.notificationsService.createForUser(req.accountantId, {
            type: 'REQUEST_LATE',
            title: 'Demande en retard !',
            message: `La demande "${req.subject || req.type}" a dépassé son échéance !`,
            linkedId: req.id,
            linkedType: 'Request',
          });
        }
      }
    }
  }
}
