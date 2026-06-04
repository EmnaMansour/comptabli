import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, Status } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(userId: string, userRole: Role, page: number = 1, limit: number = 10, archived: boolean = false) {
    const skip = (page - 1) * limit;
    const commonInclude = {
      creator: { select: { id: true, firstName: true, lastName: true } },
      assignees: { select: { id: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      folder: { select: { id: true, name: true } },
      request: { select: { id: true, type: true, subject: true } },
      comments: { 
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' as const }
      },
      attachments: true,
    };

    let where: any = { archived };

    if (userRole === Role.ADMIN) {
      where = { ...where }; 
    } else if (userRole === Role.COMPTABLE || userRole === Role.COLLABORATEUR) {
      where = {
        ...where,
        OR: [
          { assignees: { some: { id: userId } } },
          { createdBy: userId }
        ]
      };
    } else if (userRole === Role.CLIENT) {
      where = { ...where, clientId: userId };
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: commonInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({
        where,
      }),
    ]);

    return {
      data: tasks,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async create(
    data: {
      title: string;
      description?: string;
      priority: string;
      status?: Status;
      deadline?: Date;
      clientDeadline?: Date;
      assignedTo?: string[]; // Multiple IDs
      clientId?: string;
      folderId?: string;
      requestId?: string;
      organizationId: string;
    },
    creatorId: string,
  ) {
    let orgId = data.organizationId;
    if (orgId === 'placeholder' || !orgId) {
      let org = await this.prisma.organization.findFirst({
        where: { ownerId: creatorId },
      });
      if (!org) {
        org = await this.prisma.organization.findFirst();
      }
      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: 'Mon Cabinet',
            ownerId: creatorId,
          },
        });
      }
      orgId = org.id;
    }

    const { assignedTo, ...rest } = data;

    const task = await this.prisma.task.create({
      data: {
        ...rest,
        organizationId: orgId,
        createdBy: creatorId,
        assignees: assignedTo && assignedTo.length > 0
          ? { connect: assignedTo.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        assignees: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify assignees (F-028)
    if (assignedTo && assignedTo.length > 0) {
      for (const assigneeId of assignedTo) {
        await this.notificationsService.createForUser(assigneeId, {
          type: 'TASK_ASSIGNMENT',
          title: 'Nouvelle tâche assignée',
          message: `Vous avez été assigné à la tâche : ${task.title}`,
          linkedId: task.id,
          linkedType: 'Task',
        });
      }
    }

    return task;
  }

  async updateStatus(id: string, status: Status, userId: string, userRole: Role, rejectionReason?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { assignees: true, creator: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    // Permission check
    const isAssignee = task.assignees.some((a) => a.id === userId);
    const isCreator = task.createdBy === userId;

    if (userRole !== Role.ADMIN && !isCreator && !isAssignee) {
      throw new ForbiddenException('Access denied');
    }

    if (status === Status.VALIDATED && userRole !== Role.ADMIN && userRole !== Role.COMPTABLE) {
      throw new ForbiddenException('Seul le comptable peut valider une tâche.');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { 
        status,
        rejectionReason: status === Status.NEEDS_REVIEW ? rejectionReason : null,
        archived: status === Status.VALIDATED ? true : false,
      },
      include: {
        assignees: { select: { id: true } },
        creator: { select: { id: true } },
      },
    });

    // Notifications for F-030 and F-031
    if (status === Status.DONE && isAssignee) {
      // Notify creator (Accountant)
      await this.notificationsService.createForUser(task.createdBy, {
        type: 'TASK_COMPLETED',
        title: 'Tâche terminée',
        message: `La tâche "${task.title}" a été marquée comme terminée par un collaborateur.`,
        linkedId: task.id,
        linkedType: 'Task',
      });
    }

    if (status === Status.NEEDS_REVIEW && isCreator) {
      // Notify all assignees
      for (const assignee of task.assignees) {
        await this.notificationsService.createForUser(assignee.id, {
          type: 'TASK_REJECTED',
          title: 'Tâche à revoir',
          message: `La tâche "${task.title}" a été renvoyée par le comptable : ${rejectionReason || 'Pas de motif'}`,
          linkedId: task.id,
          linkedType: 'Task',
        });
      }
    }

    if (status === Status.VALIDATED) {
      // Notify all assignees that the task was validated
      for (const assignee of task.assignees) {
        await this.notificationsService.createForUser(assignee.id, {
          type: 'TASK_VALIDATED',
          title: 'Tâche validée ✅',
          message: `La tâche "${task.title}" a été validée. Excellent travail !`,
          linkedId: task.id,
          linkedType: 'Task',
        });
      }

      // Automatically delete the associated request if it exists (User request)
      if (task.requestId) {
        try {
          await this.prisma.request.delete({
            where: { id: task.requestId },
          });
          console.log(`Auto-deleted associated request: ${task.requestId}`);
        } catch (error) {
          console.error(`Failed to auto-delete request ${task.requestId}:`, error);
        }
      }
    }

    return updated;
  }

  async addComment(taskId: string, content: string, authorId: string) {
    return this.prisma.taskComment.create({
      data: {
        taskId,
        content,
        authorId,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async addAttachment(taskId: string, fileData: { name: string, url: string }, uploaderId: string) {
    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedBy: uploaderId,
        name: fileData.name,
        url: fileData.url,
      }
    });
  }

  async deleteAttachment(attachmentId: string) {
    const att = await this.prisma.taskAttachment.findUnique({ where: { id: attachmentId }});
    if (!att) throw new NotFoundException('Fichier non trouvé');
    return this.prisma.taskAttachment.delete({ where: { id: attachmentId }});
  }
}