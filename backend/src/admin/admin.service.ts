import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { Role, Status } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

type AdminActor = {
  userId: string;
  email: string;
  role: Role;
  ip?: string | null;
};

type UserFilters = {
  role?: Role;
  status?: Status;
  search?: string;
};

type AuditFilters = {
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  private async logAction(
    actor: AdminActor,
    action: string,
    entity: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.auditLogService.create({
      userId: actor.userId,
      action,
      entity,
      entityId,
      oldValue: oldValue == null ? undefined : JSON.stringify(oldValue),
      newValue: newValue == null ? undefined : JSON.stringify(newValue),
      ip: actor.ip ?? undefined,
    });
  }

  private buildUserWhere(filters: UserFilters) {
    const where: Record<string, unknown> = {};

    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async getSingleAdminOrThrow() {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true, email: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!admins.length) {
      throw new NotFoundException('Aucun compte ADMIN trouvé. Exécutez le seed.');
    }

    return admins[0];
  }

  async getDashboard(actor: AdminActor) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      newUsersToday,
      usersByRole,
      pendingComptables,
      disabledUsers,
      storageAggregate,
      organizations,
      pendingReviews,
      pendingRequests,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
      this.prisma.user.count({
        where: { role: Role.COMPTABLE, status: Status.PENDING },
      }),
      this.prisma.user.count({
        where: { status: Status.INACTIVE },
      }),
      this.prisma.organization.aggregate({
        _sum: { storageUsed: true, storageLimit: true },
      }),
      this.prisma.organization.findMany({
        select: { storageUsed: true, storageLimit: true },
      }),
      this.prisma.review.count({ where: { status: Status.PENDING } }),
      this.prisma.request.count({ where: { status: Status.PENDING } }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    const monthlyGrowth = await this.getUserGrowthData(thirtyDaysAgo);
    const globalStats = {
      totalUsers,
      newUsersToday,
      disabledUsers,
      storageUsed: storageAggregate._sum.storageUsed ?? 0,
      storageLimit: storageAggregate._sum.storageLimit ?? 0,
      alerts:
        pendingComptables +
        organizations.filter((organization) => organization.storageUsed > organization.storageLimit).length +
        pendingReviews,
    };
    const storageOverages = organizations.filter(
      (organization) => organization.storageUsed > organization.storageLimit,
    ).length;

    await this.logAction(actor, 'ADMIN_DASHBOARD_VIEW', 'dashboard');

    return {
      usersByRole: usersByRole.reduce<Record<string, number>>((acc, row) => {
        acc[row.role] = row._count.role;
        return acc;
      }, {}),
      globalStats,
      systemAlerts: {
        pendingComptables,
        storageOverages,
        pendingReviews,
        pendingRequests,
      },
      growth: monthlyGrowth,
      recentAuditLogs,
    };
  }

  async listAccountants(actor: AdminActor, filters: Omit<UserFilters, 'role'>) {
    const accountants = await this.prisma.user.findMany({
      where: this.buildUserWhere({ ...filters, role: Role.COMPTABLE }),
      orderBy: { createdAt: 'desc' },
      include: {
        accountantClients: { select: { clientId: true } },
        accountantCollaborators: { select: { collaboratorId: true } },
        ownedOrganizations: {
          select: {
            id: true,
            name: true,
            storageUsed: true,
            storageLimit: true,
          },
        },
      },
    });

    await this.logAction(actor, 'ADMIN_ACCOUNTANTS_LIST', 'user');

    return accountants.map(({ password: _password, ...accountant }) => ({
      ...accountant,
      stats: {
        clients: accountant.accountantClients.length,
        collaborators: accountant.accountantCollaborators.length,
        organizations: accountant.ownedOrganizations.length,
      },
    }));
  }

  async getAccountant(actor: AdminActor, id: string) {
    const accountant = await this.prisma.user.findFirst({
      where: { id, role: Role.COMPTABLE },
      include: {
        accountantClients: {
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
              },
            },
          },
        },
        accountantCollaborators: {
          include: {
            collaborator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
              },
            },
          },
        },
        ownedOrganizations: {
          include: {
            storageQuota: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
        accountantReviews: {
          select: { id: true, rating: true, comment: true, status: true, createdAt: true },
        },
      },
    });

    if (!accountant) {
      throw new NotFoundException('Comptable introuvable');
    }

    await this.logAction(actor, 'ADMIN_ACCOUNTANT_VIEW', 'user', id);

    const { password: _password, ...safeAccountant } = accountant;
    return safeAccountant;
  }

  async listUsers(actor: AdminActor, filters: UserFilters) {
    const users = await this.prisma.user.findMany({
      where: this.buildUserWhere(filters),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        companyName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAction(actor, 'ADMIN_USERS_LIST', 'user');

    return users;
  }

  async createUser(
    actor: AdminActor,
    payload: CreateUserDto & { role: Role; status?: Status },
  ) {
    if (payload.role === Role.ADMIN) {
      throw new BadRequestException(
        'Le compte ADMIN unique ne peut pas etre cree depuis l interface.',
      );
    }

    const created = await this.usersService.create(
      payload,
      payload.role,
      payload.status ?? Status.ACTIVE,
      undefined,
      { sendCredentials: true },
    );

    await this.logAction(
      actor,
      'ADMIN_USER_CREATE',
      'user',
      created.id,
      undefined,
      {
        email: created.email,
        role: created.role,
        status: created.status,
      },
    );

    return created;
  }

  async getUser(actor: AdminActor, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                storageUsed: true,
                storageLimit: true,
              },
            },
          },
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    await this.logAction(actor, 'ADMIN_USER_VIEW', 'user', id);

    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  async updateUser(
    actor: AdminActor,
    id: string,
    payload: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      companyName?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const email = payload.email?.trim();
    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Cette adresse e-mail est deja utilisee');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: payload.firstName?.trim() || user.firstName,
        lastName: payload.lastName?.trim() || user.lastName,
        email: email || user.email,
        phone: payload.phone?.trim() || null,
        companyName: payload.companyName?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        companyName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAction(
      actor,
      'ADMIN_USER_UPDATE',
      'user',
      id,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        companyName: user.companyName,
      },
      updated,
    );

    return updated;
  }

  async updateUserStatus(actor: AdminActor, id: string, status: Status) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === Role.ADMIN && status !== Status.ACTIVE) {
      throw new BadRequestException('Le compte ADMIN unique ne peut pas être désactivé');
    }

    if (status === Status.INACTIVE && user.role === Role.COLLABORATEUR) {
      const activeTasksCount = await this.prisma.task.count({
        where: {
          assignees: { some: { id } },
          status: { in: [Status.PENDING, Status.ACTIVE] },
        },
      });
      if (activeTasksCount > 0) {
        throw new BadRequestException(
          'Impossible de désactiver ce collaborateur car il possède des tâches en cours.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    if (status === Status.INACTIVE) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    if (user.role === Role.COMPTABLE && status === Status.ACTIVE) {
      await this.mailService.sendActivationEmail(user.email, 'Expert Comptable');
    }

    await this.logAction(
      actor,
      'ADMIN_USER_STATUS_UPDATE',
      'user',
      id,
      { status: user.status },
      { status: updated.status },
    );

    return {
      id: updated.id,
      status: updated.status,
      refreshTokensRevoked: status === Status.INACTIVE,
    };
  }

  async updateUserRole(actor: AdminActor, id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const currentAdmin = await this.getSingleAdminOrThrow();

    if (role === Role.ADMIN && user.id !== currentAdmin.id) {
      throw new BadRequestException(
        'Un seul compte ADMIN est autorisé. Utilisez le seed pour le compte ADMIN unique.',
      );
    }

    if (user.role === Role.ADMIN && role !== Role.ADMIN) {
      throw new BadRequestException('Le compte ADMIN unique ne peut pas changer de rôle');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    await this.logAction(
      actor,
      'ADMIN_USER_ROLE_UPDATE',
      'user',
      id,
      { role: user.role },
      { role: updated.role },
    );

    return {
      id: updated.id,
      role: updated.role,
    };
  }

  async resetUserPassword(actor: AdminActor, id: string, newPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const generatedPassword =
      newPassword?.trim() || `${Math.random().toString(36).slice(2, 10)}A!`;
    const hashedPassword = await bcrypt.hash(generatedPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.logAction(actor, 'ADMIN_USER_PASSWORD_RESET', 'user', id);

    return {
      success: true,
      temporaryPassword: generatedPassword,
    };
  }

  async deleteUser(actor: AdminActor, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === Role.ADMIN) {
      throw new BadRequestException('Le compte ADMIN unique ne peut pas etre supprime');
    }

    await this.prisma.user.delete({ where: { id } });
    await this.logAction(actor, 'ADMIN_USER_DELETE', 'user', id, user);
    return { success: true };
  }

  async deleteAccountant(actor: AdminActor, id: string) {
    const accountant = await this.prisma.user.findFirst({
      where: { id, role: Role.COMPTABLE },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!accountant) {
      throw new NotFoundException('Comptable introuvable');
    }

    await this.prisma.user.delete({ where: { id } });

    await this.logAction(actor, 'ADMIN_ACCOUNTANT_DELETE', 'user', id, accountant);

    return { success: true };
  }

  async listReviews(actor: AdminActor, status?: Status) {
    const reviews = await this.prisma.review.findMany({
      where: status ? { status } : undefined,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        accountant: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.logAction(actor, 'ADMIN_REVIEWS_LIST', 'review');

    return reviews;
  }

  async updateReviewStatus(actor: AdminActor, id: string, status: Status) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable');

    const updated = await this.prisma.review.update({
      where: { id },
      data: { status },
    });

    await this.logAction(
      actor,
      'ADMIN_REVIEW_STATUS_UPDATE',
      'review',
      id,
      { status: review.status },
      { status: updated.status },
    );

    return updated;
  }

  async deleteReview(actor: AdminActor, id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable');

    await this.prisma.review.delete({ where: { id } });
    await this.logAction(actor, 'ADMIN_REVIEW_DELETE', 'review', id, review);

    return { success: true };
  }

  async listStorage(actor: AdminActor) {
    const organizations = await this.prisma.organization.findMany({
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        storageQuota: true,
        members: {
          select: { id: true },
        },
      },
      orderBy: { storageUsed: 'desc' },
    });

    await this.logAction(actor, 'ADMIN_STORAGE_LIST', 'organization');

    return organizations.map((organization) => {
      const limit = organization.storageQuota?.limit ?? organization.storageLimit;
      const used = organization.storageQuota?.used ?? organization.storageUsed;
      return {
        ...organization,
        effectiveStorageLimit: limit,
        effectiveStorageUsed: used,
        exceeded: used > limit,
      };
    });
  }

  async updateStorageQuota(actor: AdminActor, organizationId: string, limit: number) {
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new BadRequestException('Quota invalide');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { storageQuota: true },
    });

    if (!organization) {
      throw new NotFoundException('Organisation introuvable');
    }

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        storageLimit: Math.round(limit),
        storageQuota: {
          upsert: {
            create: {
              limit: Math.round(limit),
              used: organization.storageQuota?.used ?? organization.storageUsed,
            },
            update: {
              limit: Math.round(limit),
            },
          },
        },
      },
      include: {
        storageQuota: true,
      },
    });

    await this.logAction(
      actor,
      'ADMIN_STORAGE_QUOTA_UPDATE',
      'organization',
      organizationId,
      { storageLimit: organization.storageLimit },
      { storageLimit: updated.storageLimit },
    );

    return updated;
  }

  private async getUserGrowthData(fromDate: Date) {
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: fromDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, number>();
    for (const user of users) {
      const key = user.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return [...buckets.entries()].map(([date, count]) => ({ date, count }));
  }

  async getAnalytics(actor: AdminActor) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [userGrowth, featureUsage, retentionBase, retainedUsers] = await Promise.all([
      this.getUserGrowthData(thirtyDaysAgo),
      Promise.all([
        this.prisma.document.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.request.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.message.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.meeting.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.task.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ]),
      this.prisma.user.count({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          role: { not: Role.ADMIN },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          role: { not: Role.ADMIN },
          OR: [
            { notifications: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            { sentMessages: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            { clientRequests: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            { ownedDocuments: { some: { createdAt: { gte: thirtyDaysAgo } } } },
          ],
        },
      }),
    ]);

    await this.logAction(actor, 'ADMIN_ANALYTICS_VIEW', 'analytics');

    return {
      userGrowth,
      featureUsage: [
        { feature: 'Documents', count: featureUsage[0] },
        { feature: 'Demandes', count: featureUsage[1] },
        { feature: 'Messagerie', count: featureUsage[2] },
        { feature: 'Réunions', count: featureUsage[3] },
        { feature: 'Tâches', count: featureUsage[4] },
      ],
      retention: {
        eligibleUsers: retentionBase,
        retainedUsers,
        retentionRate: retentionBase === 0 ? 0 : Math.round((retainedUsers / retentionBase) * 100),
      },
    };
  }

  async listAuditLogs(actor: AdminActor, filters: AuditFilters) {
    const logs = await this.auditLogService.findAll(filters);
    await this.logAction(actor, 'ADMIN_AUDIT_LOGS_VIEW', 'audit_log');
    return logs;
  }

  async exportAuditLogsCsv(actor: AdminActor, filters: AuditFilters) {
    const logs = await this.auditLogService.findAll(filters);
    await this.logAction(actor, 'ADMIN_AUDIT_LOGS_EXPORT', 'audit_log');

    const header = [
      'id',
      'createdAt',
      'action',
      'entity',
      'entityId',
      'adminEmail',
      'ip',
      'oldValue',
      'newValue',
    ];

    const escape = (value: unknown) => {
      const str = String(value ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = logs.map((log) =>
      [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.entity,
        log.entityId ?? '',
        log.user?.email ?? '',
        log.ip ?? '',
        log.oldValue ?? '',
        log.newValue ?? '',
      ]
        .map(escape)
        .join(','),
    );

    return [header.join(','), ...rows].join('\n');
  }

  async getProfile(actor: AdminActor) {
    const admin = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Profil ADMIN introuvable');
    }

    await this.logAction(actor, 'ADMIN_PROFILE_VIEW', 'user', actor.userId);

    return admin;
  }

  async updateProfile(
    actor: AdminActor,
    payload: { firstName?: string; lastName?: string; email?: string; phone?: string; companyName?: string },
  ) {
    const admin = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!admin) throw new NotFoundException('Profil ADMIN introuvable');

    const email = payload.email?.trim();
    if (email && email !== admin.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== admin.id) {
        throw new BadRequestException('Cette adresse e-mail est déjà utilisée');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        firstName: payload.firstName?.trim() || admin.firstName,
        lastName: payload.lastName?.trim() || admin.lastName,
        email: email || admin.email,
        phone: payload.phone?.trim() || null,
        companyName: payload.companyName?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logAction(
      actor,
      'ADMIN_PROFILE_UPDATE',
      'user',
      actor.userId,
      {
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        companyName: admin.companyName,
      },
      updated,
    );

    return updated;
  }

  async changePassword(
    actor: AdminActor,
    payload: { currentPassword?: string; newPassword?: string },
  ) {
    if (!payload.currentPassword || !payload.newPassword) {
      throw new BadRequestException('Mot de passe actuel et nouveau mot de passe requis');
    }

    if (payload.newPassword.length < 8) {
      throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 8 caractères');
    }

    const admin = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!admin) throw new NotFoundException('Profil ADMIN introuvable');

    const isValid = await bcrypt.compare(payload.currentPassword, admin.password);
    if (!isValid) {
      throw new ForbiddenException('Mot de passe actuel invalide');
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: { password: hashedPassword },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId: actor.userId } });

    await this.logAction(actor, 'ADMIN_PROFILE_PASSWORD_CHANGE', 'user', actor.userId);

    return { success: true };
  }
}
