import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, Status } from '@prisma/client';
import { Express } from 'express';

const requestIncludeFull = {
  client: {
    select: { id: true, firstName: true, lastName: true, companyName: true, role: true },
  },
  accountant: {
    select: { id: true, firstName: true, lastName: true, companyName: true, role: true },
  },
  attachments: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      uploader: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, companyName: true, role: true } },
    },
  },
} as const;

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(data: {
    clientId: string;
    type: string;
    subject?: string | null;
    description: string;
    urgency: string;
    accountantId?: string | null;
    creatorId?: string | null;
    dueDate?: Date | null;
    desiredResponseAt?: Date | null;
  }) {
    const created = await this.prisma.request.create({
      data: {
        clientId: data.clientId,
        type: data.type,
        subject: data.subject ?? null,
        description: data.description,
        urgency: data.urgency,
        accountantId: data.accountantId ?? null,
        creatorId: data.creatorId ?? null,
        dueDate: data.dueDate ?? null,
        desiredResponseAt: data.desiredResponseAt ?? null,
        status: Status.PENDING,
      },
      include: {
        accountant: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
    });

    if (data.accountantId) {
      const clientName =
        created.client.companyName?.trim() ||
        `${created.client.firstName} ${created.client.lastName}`.trim();
      await this.notificationsService.createForUser(data.accountantId, {
        type: 'REQUEST',
        title: 'Nouvelle demande assignée',
        message: `Vous avez été assigné à la demande de ${clientName} : "${created.subject || created.type}"`,
        linkedId: created.id,
        linkedType: 'Request',
      });
      
      // Auto-create task if assigned to a collaborator
      await this.createTaskFromRequest(created.id, data.accountantId, data.creatorId || data.accountantId);
    }

    return created;
  }

  private async createTaskFromRequest(requestId: string, assigneeId: string, creatorId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: { client: true },
    });
    if (!request) return;

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { role: true },
    });

    if (assignee?.role !== Role.COLLABORATEUR) return;

    // Check if task already exists
    const existingTask = await this.prisma.task.findFirst({
      where: { requestId },
    });

    if (existingTask) {
      // Update existing task assignment
      await this.prisma.task.update({
        where: { id: existingTask.id },
        data: {
          assignees: {
            set: [{ id: assigneeId }]
          }
        }
      });
      return;
    }

    // Find organization
    let org = await this.prisma.organization.findFirst({
      where: { ownerId: creatorId },
    });
    if (!org) {
      org = await this.prisma.organization.findFirst();
    }
    if (!org) return;

    await this.prisma.task.create({
      data: {
        title: `Demande: ${request.subject || request.type}`,
        description: request.description,
        priority: request.urgency || 'NORMAL',
        status: Status.PENDING,
        requestId: request.id,
        clientId: request.clientId,
        organizationId: org.id,
        createdBy: creatorId,
        assignees: { connect: { id: assigneeId } },
      },
    });
  }

  private async clientIdsForAccountant(accountantId: string): Promise<string[]> {
    const links = await this.prisma.accountantClient.findMany({
      where: { accountantId },
      select: { clientId: true },
    });
    return links.map((l) => l.clientId);
  }

  private readonly listIncludeClient = {
    accountant: {
      select: { id: true, firstName: true, lastName: true, companyName: true },
    },
    creator: {
      select: { id: true, firstName: true, lastName: true, role: true },
    },
    _count: { select: { attachments: true, comments: true } },
  };

  private readonly listIncludeStaff = {
    client: {
      select: { id: true, firstName: true, lastName: true, companyName: true },
    },
    accountant: {
      select: { id: true, firstName: true, lastName: true, companyName: true },
    },
    creator: {
      select: { id: true, firstName: true, lastName: true, role: true },
    },
    _count: { select: { attachments: true, comments: true } },
  };

  async findAll(userId: string, role: Role, clientId?: string) {
    if (role === Role.CLIENT) {
      return this.prisma.request.findMany({
        where: { clientId: userId },
        include: this.listIncludeClient,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === Role.COMPTABLE) {
      // Le comptable voit ses propres demandes ET celles de ses collaborateurs
      const collaborators = await this.prisma.accountantCollaborator.findMany({
        where: { accountantId: userId },
        select: { collaboratorId: true },
      });
      const collaboratorIds = collaborators.map((c) => c.collaboratorId);
      const allStaffIds = [userId, ...collaboratorIds];

      return this.prisma.request.findMany({
        where: {
          OR: [
            { accountantId: { in: allStaffIds } },
            { creatorId: { in: allStaffIds } },
          ],
        },
        include: this.listIncludeStaff,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === Role.COLLABORATEUR) {
      // Les collaborateurs ne voient que les demandes qui leur sont assignées
      // OU celles qu'ils ont créées
      return this.prisma.request.findMany({
        where: {
          OR: [
            { accountantId: userId },
            { creatorId: userId }
          ]
        },
        include: this.listIncludeStaff,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === Role.ADMIN) {
      return this.prisma.request.findMany({
        include: this.listIncludeStaff,
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  private async assertRequestAccess(
    request: { clientId: string },
    userId: string,
    role: Role,
  ) {
    if (role === Role.CLIENT) {
      if (request.clientId !== userId) throw new ForbiddenException();
      return;
    }
    if (role === Role.COMPTABLE) {
      const clientIds = await this.clientIdsForAccountant(userId);
      if (!clientIds.includes(request.clientId)) throw new ForbiddenException();
      return;
    }
    if (role === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        select: { accountantId: true },
      });
      if (!collab) throw new ForbiddenException();
      const clientIds = await this.clientIdsForAccountant(collab.accountantId);
      if (!clientIds.includes(request.clientId)) throw new ForbiddenException();
      return;
    }
    if (role === Role.ADMIN) return;
    throw new ForbiddenException();
  }

  async findOne(id: string, userId: string, role: Role) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: requestIncludeFull,
    });
    if (!request) throw new NotFoundException('Demande non trouvée');
    await this.assertRequestAccess(request, userId, role);
    return request;
  }

  async updateOwn(
    id: string,
    clientId: string,
    data: {
      type?: string;
      subject?: string | null;
      description?: string;
      urgency?: string;
      dueDate?: Date | null;
      desiredResponseAt?: Date | null;
      accountantId?: string | null;
    },
  ) {
    const existing = await this.prisma.request.findFirst({
      where: { id, clientId },
    });
    if (!existing) throw new NotFoundException('Demande non trouvée');
    if (existing.status !== Status.PENDING) {
      throw new ForbiddenException('Seules les demandes en attente sont modifiables');
    }
    if (data.accountantId !== undefined && data.accountantId !== null) {
      const link = await this.prisma.accountantClient.findFirst({
        where: { clientId, accountantId: data.accountantId },
      });
      if (!link) throw new ForbiddenException('Ce comptable ne vous est pas assigné');
    }
    return this.prisma.request.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.urgency !== undefined ? { urgency: data.urgency } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.desiredResponseAt !== undefined ? { desiredResponseAt: data.desiredResponseAt } : {}),
        ...(data.accountantId !== undefined ? { accountantId: data.accountantId } : {}),
      },
      include: requestIncludeFull,
    });
  }

  async updateManagement(
    id: string,
    userId: string,
    role: Role,
    data: {
      accountantId?: string | null;
      respondedAt?: Date | null;
      subject?: string | null;
      type?: string;
      description?: string;
      dueDate?: Date | null;
    },
  ) {
    if (role !== Role.COMPTABLE && role !== Role.COLLABORATEUR && role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande non trouvée');
    await this.assertRequestAccess(request, userId, role);
    
    if (data.accountantId !== undefined && role === Role.COLLABORATEUR) {
      throw new ForbiddenException("Seul le comptable peut modifier l'assignation");
    }

    // Accountants are only allowed to manage assignment and response, not modify the client's request details
    const updateData: any = {};
    if (data.accountantId !== undefined) updateData.accountantId = data.accountantId;
    if (data.respondedAt !== undefined) updateData.respondedAt = data.respondedAt;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    
    // Admins can still modify everything
    if (role === Role.ADMIN) {
      if (data.subject !== undefined) updateData.subject = data.subject;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.description !== undefined) updateData.description = data.description;
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: updateData,
      include: requestIncludeFull,
    });

    if (data.accountantId) {
      await this.createTaskFromRequest(updated.id, data.accountantId, userId);
      
      const clientName = updated.client.companyName?.trim() || 
        `${updated.client.firstName} ${updated.client.lastName}`.trim();

      await this.notificationsService.createForUser(data.accountantId, {
        type: 'REQUEST_ASSIGNED',
        title: 'Nouvelle demande assignée',
        message: `Vous avez été assigné à la demande de ${clientName} : "${updated.subject || updated.type}"`,
        linkedId: updated.id,
        linkedType: 'Request',
      });
    }

    return updated;
  }

  async updateStatus(id: string, userId: string, role: Role, status: Status) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande non trouvée');

    if (role === Role.COMPTABLE) {
      const clientIds = await this.clientIdsForAccountant(userId);
      if (!clientIds.includes(request.clientId)) throw new ForbiddenException();
    } else if (role === Role.COLLABORATEUR) {
      // collaborateur accesses through their accountant
      await this.assertRequestAccess(request, userId, role);
    } else if (role === Role.ADMIN) {
      /* ok */
    } else {
      throw new ForbiddenException();
    }

    const data: { status: Status; respondedAt?: Date; accountantId?: string } = { status };
    if (status === Status.INACTIVE && !request.respondedAt) {
      data.respondedAt = new Date();
    }
    if (role === Role.COMPTABLE && status === Status.ACTIVE) {
      data.accountantId = userId;
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data,
      include: requestIncludeFull,
    });

    if (status === Status.INACTIVE) {
      await this.prisma.task.deleteMany({
        where: { requestId: id },
      });
    }

    return updated;
  }

  async addComment(id: string, userId: string, role: Role, content: string) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande non trouvée');
    await this.assertRequestAccess(request, userId, role);
    return this.prisma.requestComment.create({
      data: {
        requestId: id,
        authorId: userId,
        content,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      },
    });
  }

  async addAttachment(
    id: string,
    userId: string,
    role: Role,
    file: Express.Multer.File,
  ) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande non trouvée');
    await this.assertRequestAccess(request, userId, role);
    const url = file.filename;
    return this.prisma.requestAttachment.create({
      data: {
        requestId: id,
        url,
        name: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        uploadedBy: userId,
      },
    });
  }

  /** Réutilise un fichier déjà présent dans l’espace client (pas de re-upload). */
  async addAttachmentFromDocument(
    requestId: string,
    userId: string,
    role: Role,
    documentId: string,
  ) {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Demande non trouvée');
    await this.assertRequestAccess(request, userId, role);

    if (role !== Role.CLIENT || request.clientId !== userId) {
      throw new ForbiddenException('Seul le client peut lier ses documents');
    }
    if (request.status !== Status.PENDING) {
      throw new ForbiddenException('Seules les demandes en attente acceptent des pièces jointes');
    }

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, clientId: userId },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    return this.prisma.requestAttachment.create({
      data: {
        requestId,
        url: doc.url,
        name: doc.name,
        mimeType: doc.type || 'application/octet-stream',
        size: doc.size || 0,
        uploadedBy: userId,
      },
    });
  }

  async removeAttachment(requestId: string, attachmentId: string, userId: string, role: Role) {
    const att = await this.prisma.requestAttachment.findFirst({
      where: { id: attachmentId, requestId },
      include: { request: true },
    });
    if (!att) throw new NotFoundException('Pièce jointe introuvable');
    await this.assertRequestAccess(att.request, userId, role);
    if (role === Role.CLIENT) {
      if (att.request.status !== Status.PENDING) throw new ForbiddenException();
      if (att.uploadedBy !== userId && att.request.clientId !== userId) {
        throw new ForbiddenException();
      }
    }
    await this.prisma.requestAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  async remove(id: string, userId: string, role: Role) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande non trouvée');

    if (role === Role.CLIENT) {
      if (request.clientId !== userId) throw new ForbiddenException();
      if (request.status !== Status.PENDING) {
        throw new ForbiddenException('Seules les demandes en attente peuvent être supprimées');
      }
    } else if (role === Role.COMPTABLE) {
      throw new ForbiddenException('Les comptables ne peuvent pas supprimer de demandes');
    } else if (role === Role.ADMIN) {
      /* ok */
    } else {
      throw new ForbiddenException();
    }

    return this.prisma.request.delete({ where: { id } });
  }
}
