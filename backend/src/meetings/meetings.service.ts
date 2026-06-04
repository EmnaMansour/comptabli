import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, Status } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  async create(data: {
    title: string;
    type: string;
    scheduledAt: Date;
    duration: number;
    clientId: string;
    accountantId?: string | null;
    meetingLink?: string | null;
    subject?: string;
    description?: string;
    color?: string;
    locationDetail?: string;
    guests?: string;
    creatorId?: string;
  }) {
    // 0. Ensure meeting is in the future
    const meetingStart = new Date(data.scheduledAt);
    if (meetingStart < new Date()) {
      throw new ForbiddenException(
        'Impossible de planifier un rendez-vous dans le passé.',
      );
    }

    // Check for overlapping meetings (same accountant OR same client)
    const meetingEnd = new Date(meetingStart.getTime() + data.duration * 60 * 1000);

    const orConditions: any[] = [{ clientId: data.clientId }];
    if (data.accountantId) {
      orConditions.push({ accountantId: data.accountantId });
    }

    // 0.5 Ensure meeting is within working hours (if defined)
    if (data.accountantId) {
      const dayOfWeek = meetingStart.getDay();
      const availability = await this.prisma.meetingAvailability.findMany({
        where: { userId: data.accountantId, dayOfWeek, isActive: true },
      });

      if (availability.length > 0) {
        const h = meetingStart.getHours();
        const m = meetingStart.getMinutes();
        const startTotal = h * 60 + m;
        const endTotal = startTotal + data.duration;

        const isAuthorized = availability.some(slot => {
          const [sh, sm] = slot.startTime.split(':').map(Number);
          const [eh, em] = slot.endTime.split(':').map(Number);
          const slotStart = sh * 60 + sm;
          const slotEnd = eh * 60 + em;
          return startTotal >= slotStart && endTotal <= slotEnd;
        });

        if (!isAuthorized) {
          throw new ForbiddenException(
            'Ce créneau est en dehors des heures de travail configurées pour ce jour.',
          );
        }
      }

      // Check if accountant is on leave
      const leaves = await this.prisma.accountantLeave.findMany({
        where: {
          accountantId: data.accountantId,
          startDate: { lte: meetingEnd },
          endDate: { gte: meetingStart },
        },
      });

      if (leaves.length > 0) {
        throw new ForbiddenException(
          'Le comptable est en congé ou indisponible sur ce créneau.',
        );
      }
    }

    const overlapping = await this.prisma.meeting.findFirst({
      where: {
        OR: orConditions,
        status: { in: ['PENDING', 'VALIDATED', 'ACTIVE'] as any },
        scheduledAt: { lt: meetingEnd },
        // meeting that ends after the new one starts
        AND: {
          scheduledAt: {
            gte: new Date(meetingStart.getTime() - 24 * 60 * 60 * 1000), // reasonable range
          },
        },
      },
    });

    if (overlapping) {
      const overlapStart = new Date(overlapping.scheduledAt);
      const overlapEnd = new Date(overlapStart.getTime() + overlapping.duration * 60 * 1000);
      if (meetingStart < overlapEnd && meetingEnd > overlapStart) {
        throw new ForbiddenException(
          'Ce créneau est déjà réservé. Veuillez choisir un autre horaire.',
        );
      }
    }

    const createdMeeting = await this.prisma.meeting.create({
      data: {
        title: data.title,
        type: data.type,
        scheduledAt: data.scheduledAt,
        duration: data.duration,
        clientId: data.clientId,
        accountantId: data.accountantId ?? null,
        meetingLink: data.meetingLink ?? null,
        subject: data.subject ?? null,
        description: data.description ?? null,
        color: data.color ?? null,
        locationDetail: data.locationDetail ?? null,
        guests: data.guests ?? null,
        status: Status.PENDING,
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
    });

    if (data.creatorId) {
      const isAccountantAction = data.creatorId === createdMeeting.accountantId;
      const targetUserId = isAccountantAction ? createdMeeting.clientId : createdMeeting.accountantId;
      
      const actorName = isAccountantAction 
        ? (createdMeeting.accountant?.companyName || `${createdMeeting.accountant?.firstName} ${createdMeeting.accountant?.lastName}`)
        : `${createdMeeting.client?.firstName} ${createdMeeting.client?.lastName}`;

      if (targetUserId) {
        await this.notificationsService.createForUser(targetUserId, {
          type: 'MEETING_NEW',
          title: `Nouveau rendez-vous : ${createdMeeting.title}`,
          message: `${actorName} a planifié un nouveau rendez-vous avec vous pour le ${new Date(createdMeeting.scheduledAt).toLocaleDateString('fr-FR')}.`,
          linkedId: createdMeeting.id,
          linkedType: 'Meeting',
        });
      }
    }

    // Send invitation emails to guests
    if (data.guests) {
      try {
        const guestEmails: string[] = JSON.parse(data.guests);
        if (Array.isArray(guestEmails) && guestEmails.length > 0) {
          const scheduledDate = new Date(createdMeeting.scheduledAt);
          const organizerName = createdMeeting.accountant
            ? (createdMeeting.accountant.companyName || `${createdMeeting.accountant.firstName} ${createdMeeting.accountant.lastName}`)
            : (createdMeeting.client ? `${createdMeeting.client.firstName} ${createdMeeting.client.lastName}` : 'Comptabli');

          for (const email of guestEmails) {
            if (email && email.includes('@')) {
              await this.mailService.sendMeetingInviteEmail(email.trim(), {
                title: createdMeeting.title,
                date: scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                time: `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`,
                duration: createdMeeting.duration,
                type: createdMeeting.type,
                organizerName,
                locationDetail: createdMeeting.locationDetail ?? undefined,
                meetingLink: createdMeeting.meetingLink ?? undefined,
              });
            }
          }
        }
      } catch (e) {
        // Silently ignore parse errors for guests JSON
      }
    }

    return createdMeeting;
  }

  async findAll(userId: string, role: Role) {
    let where: any = {};
    if (role === Role.CLIENT) where = { clientId: userId };
    else if (role === Role.COMPTABLE) where = { accountantId: userId };
    else if (role === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        select: { accountantId: true },
      });
      if (!collab) return [];
      where = { accountantId: collab.accountantId };
    }
    // Else for ADMIN, where remains empty or we can add more logic

    return this.prisma.meeting.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        notes: { take: 20, orderBy: { createdAt: 'desc' } },
        actions: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  // --- Availability ---

  async getAvailability(userId: string) {
    return this.prisma.meetingAvailability.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async updateAvailability(userId: string, slots: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }[]) {
    await this.prisma.meetingAvailability.deleteMany({ where: { userId } });
    return this.prisma.meetingAvailability.createMany({
      data: slots.map(s => ({
        userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive ?? true,
      })),
    });
  }

  /**
   * Generate all available time slots for a given accountant for a given month.
   * Logic:
   * 1. Get weekly availability (recurring schedule)
   * 2. Generate 30-min slots for each day of the month based on the schedule
   * 3. Remove days/slots that fall within a leave period
   * 4. Remove slots that overlap with existing meetings (PENDING or VALIDATED)
   * Returns: { "2026-04-17": ["09:00","09:30","10:00",...], ... }
   */
  async getAvailableSlots(accountantId: string, year: number, month: number) {
    // 1. Weekly schedule
    const availability = await this.prisma.meetingAvailability.findMany({
      where: { userId: accountantId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (availability.length === 0) return {};

    // 2. Leaves for this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const leaves = await this.prisma.accountantLeave.findMany({
      where: {
        accountantId,
        OR: [
          { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
        ],
      },
    });

    // 3. Existing meetings for this month (PENDING or VALIDATED)
    const meetings = await this.prisma.meeting.findMany({
      where: {
        accountantId,
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { in: ['PENDING', 'VALIDATED', 'ACTIVE'] as any },
      },
      select: { scheduledAt: true, duration: true },
    });

    // 4. Build the calendar
    const result: Record<string, string[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      // Skip past dates
      if (date < today) continue;

      const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ...
      const daySlots = availability.filter(a => a.dayOfWeek === dayOfWeek);
      if (daySlots.length === 0) continue;

      // Check if day is within a leave period
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayStart = new Date(year, month - 1, day, 0, 0, 0);
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59);

      // A day is considered a full leave if any leave covers it entirely, or if the dayStart/dayEnd falls inside the leave.
      // To be safe, we'll just rely on the slot filtering below, but for UI optimization we can skip if dayStart is inside a leave.
      const isFullLeave = leaves.some(l => dayStart >= l.startDate && dayEnd <= l.endDate);
      if (isFullLeave) continue;

      // Generate 30-min time slots from the schedule
      const timeSlots: string[] = [];
      for (const slot of daySlots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        for (let m = startMin; m + 30 <= endMin; m += 30) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0');
          const mm = String(m % 60).padStart(2, '0');
          timeSlots.push(`${hh}:${mm}`);
        }
      }

      // Remove slots occupied by existing meetings
      const freeSlots = timeSlots.filter(ts => {
        const [h, m] = ts.split(':').map(Number);
        const slotStart = new Date(year, month - 1, day, h, m, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        // Check if any meeting overlaps with this slot
        return !meetings.some(mtg => {
          const mtgStart = new Date(mtg.scheduledAt);
          const mtgEnd = new Date(mtgStart.getTime() + mtg.duration * 60 * 1000);
          return slotStart < mtgEnd && slotEnd > mtgStart;
        });
      });

      // Also remove slots partially within leave
      const trulyFree = freeSlots.filter(ts => {
        const [h, m] = ts.split(':').map(Number);
        const slotTime = new Date(year, month - 1, day, h, m, 0);
        return !leaves.some(l => slotTime >= l.startDate && slotTime < l.endDate);
      });

      if (trulyFree.length > 0) {
        result[dateStr] = trulyFree;
      }
    }

    return result;
  }

  async setPV(id: string, userId: string, role: Role, pvUrl: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    // Only accountant or collab can upload PV
    if (role === Role.CLIENT) throw new ForbiddenException('Seul le cabinet peut ajouter un compte-rendu');
    return this.prisma.meeting.update({
      where: { id },
      data: { pvUrl },
    });
  }

  private async assertMeetingAccess(
    meeting: { id: string; clientId: string; accountantId: string | null },
    userId: string,
    role: Role,
  ) {
    if (role === Role.CLIENT && meeting.clientId === userId) return;
    if (role === Role.COMPTABLE && meeting.accountantId === userId) return;
    if (role === Role.ADMIN) return;
    if (role === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        select: { accountantId: true },
      });
      if (collab && meeting.accountantId === collab.accountantId) return;
    }
    throw new ForbiddenException();
  }

  async findOne(id: string, userId: string, role: Role) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        notes: { orderBy: { createdAt: 'asc' } },
        actions: true,
      },
    });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    await this.assertMeetingAccess(meeting, userId, role);
    return meeting;
  }

  async update(id: string, userId: string, role: Role, data: any) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    await this.assertMeetingAccess(meeting, userId, role);

    if (data.scheduledAt) {
      const newScheduledAt = new Date(data.scheduledAt);
      if (newScheduledAt < new Date()) {
        throw new ForbiddenException(
          'Impossible de déplacer un rendez-vous dans le passé.',
        );
      }
    }

    if (data.scheduledAt || data.duration) {
      const targetScheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date(meeting.scheduledAt);
      const targetDuration = data.duration ?? meeting.duration;
      const targetAccountantId = meeting.accountantId;

      if (targetAccountantId) {
        const dayOfWeek = targetScheduledAt.getDay();
        const availability = await this.prisma.meetingAvailability.findMany({
          where: { userId: targetAccountantId, dayOfWeek, isActive: true },
        });

        if (availability.length > 0) {
          const h = targetScheduledAt.getHours();
          const m = targetScheduledAt.getMinutes();
          const startTotal = h * 60 + m;
          const endTotal = startTotal + targetDuration;

          const isAuthorized = availability.some(slot => {
            const [sh, sm] = slot.startTime.split(':').map(Number);
            const [eh, em] = slot.endTime.split(':').map(Number);
            const slotStart = sh * 60 + sm;
            const slotEnd = eh * 60 + em;
            return startTotal >= slotStart && endTotal <= slotEnd;
          });

          if (!isAuthorized) {
            throw new ForbiddenException(
              'La modification placerait le rendez-vous en dehors des heures de travail configurées.',
            );
          }
        }

        // Check if accountant is on leave
        const leaves = await this.prisma.accountantLeave.findMany({
          where: {
            accountantId: targetAccountantId,
            startDate: { lte: new Date(targetScheduledAt.getTime() + targetDuration * 60 * 1000) },
            endDate: { gte: targetScheduledAt },
          },
        });

        if (leaves.length > 0) {
          throw new ForbiddenException(
            'Le comptable est en congé ou indisponible sur ce nouveau créneau.',
          );
        }
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.locationDetail !== undefined) updateData.locationDetail = data.locationDetail;
    if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink;
    if (data.guests !== undefined) updateData.guests = data.guests;

    const updatedMeeting = await this.prisma.meeting.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
      },
    });

    const isAccountantAction = userId === updatedMeeting.accountantId;
    const targetUserId = isAccountantAction ? updatedMeeting.clientId : updatedMeeting.accountantId;
    
    const actorName = isAccountantAction 
      ? (updatedMeeting.accountant?.companyName || `${updatedMeeting.accountant?.firstName} ${updatedMeeting.accountant?.lastName}`)
      : `${updatedMeeting.client?.firstName} ${updatedMeeting.client?.lastName}`;

    if (targetUserId) {
      await this.notificationsService.createForUser(targetUserId, {
        type: 'MEETING_MODIFIED',
        title: `Rendez-vous modifié : ${updatedMeeting.title}`,
        message: `${actorName} a modifié les détails de votre rendez-vous prévu pour le ${new Date(updatedMeeting.scheduledAt).toLocaleDateString('fr-FR')}.`,
        linkedId: updatedMeeting.id,
        linkedType: 'Meeting',
      });
    }

    return updatedMeeting;
  }

  async updateStatus(id: string, userId: string, role: Role, status: Status, reason?: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    await this.assertMeetingAccess(meeting, userId, role);
    const res = await this.prisma.meeting.update({
      where: { id },
      data: { 
        status
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
    });

    // Notify participants
    const isAccepted = status === Status.VALIDATED || status === Status.ACTIVE;
    const isRejected = status === Status.REJECTED || status === Status.INACTIVE;

    if (isAccepted || isRejected) {
      const isAccountantAction = userId === meeting.accountantId;
      const targetUserId = isAccountantAction ? meeting.clientId : (meeting.accountantId || '');
      const actionName = isAccepted ? 'acceptée' : 'rejetée';
      
      // Determine who acted
      const actorName = isAccountantAction 
        ? (res.accountant?.companyName || `${res.accountant?.firstName} ${res.accountant?.lastName}`)
        : `${res.client?.firstName} ${res.client?.lastName}`;

      if (targetUserId) {
        await this.notificationsService.createForUser(targetUserId, {
          type: 'MEETING_STATUS',
          title: `Réunion ${actionName}`,
          message: `${actorName} a ${actionName} votre réunion : "${meeting.title}".`,
          linkedId: meeting.id,
          linkedType: 'Meeting',
        });
      }
    }

    return res;
  }

  async addNote(meetingId: string, authorId: string, content: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    return this.prisma.meetingNote.create({
      data: {
        meetingId,
        authorId,
        content,
      },
    });
  }

  async addAction(
    meetingId: string,
    description: string,
    assignedTo: string,
    dueDate?: Date,
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    return this.prisma.meetingAction.create({
      data: {
        meetingId,
        description,
        assignedTo,
        dueDate,
      },
    });
  }

  async remove(id: string, userId: string, role: Role) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    await this.assertMeetingAccess(meeting, userId, role);
    return this.prisma.meeting.delete({ where: { id } });
  }
}
