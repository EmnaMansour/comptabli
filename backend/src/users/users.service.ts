import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role, Status } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    role: Role,
    status: Status,
    accountantId?: string,
    opts?: { selfServeRegistration?: boolean; sendCredentials?: boolean },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const generatedPassword =
      createUserDto.password || `Temp${Math.random().toString(36).slice(2, 8)}!`;
    createUserDto.password = generatedPassword;

    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);

    const birthDate = createUserDto.birthDate && createUserDto.birthDate.trim() !== '' ? new Date(createUserDto.birthDate) : undefined;
    const hireDate = createUserDto.hireDate && createUserDto.hireDate.trim() !== '' ? new Date(createUserDto.hireDate) : undefined;

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        companyName: createUserDto.companyName,
        phone: createUserDto.phone,
        birthDate: birthDate && !isNaN(birthDate.getTime()) ? birthDate : undefined,
        experienceLevel: createUserDto.experienceLevel,
        hireDate: hireDate && !isNaN(hireDate.getTime()) ? hireDate : undefined,
        cinUrl: createUserDto.cinUrl,
        diplomaUrl: createUserDto.diplomaUrl,
        role,
        status,
        emailVerifiedAt: opts?.selfServeRegistration ? undefined : new Date(),
        activitySector: createUserDto.activitySector,
        patenteUrl: createUserDto.patenteUrl,
        rneUrl: createUserDto.rneUrl,
        mustChangePassword: role === Role.CLIENT || role === Role.COLLABORATEUR,
      },
    });

    // Automatically create AccountantProfile for COMPTABLE role to ensure visibility in Networking
    if (role === Role.COMPTABLE) {
      await this.prisma.accountantProfile.create({
        data: {
          accountantId: user.id,
          companyName: user.companyName,
          phone: user.phone,
          email: user.email,
          location: user.location,
          isListed: true,
        },
      }).catch((e) => console.error('Error creating accountant profile during registration:', e));
    }

    if (accountantId && role === Role.CLIENT) {
      await this.prisma.accountantClient.create({
        data: {
          accountantId,
          clientId: user.id,
        },
      });
    } else if (accountantId && role === Role.COLLABORATEUR) {
      await this.prisma.accountantCollaborator.create({
        data: {
          accountantId,
          collaboratorId: user.id,
        },
      });
    }

    if (role === Role.CLIENT) {
      // Create folder model for the new client (unconditionally)
      await this.createBaseAccountingModel(user.id, accountantId);
    }

    let mailSent = false;
    let devVerificationUrl: string | undefined;

    if (opts?.selfServeRegistration) {
      const plain = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(plain).digest('hex');
      const emailVerificationExpires = new Date(Date.now() + 48 * 3600 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires,
        },
      });
      const mail = await this.mailService.sendRegistrationVerificationEmail(
        user.email,
        plain,
        String(role),
      );
      mailSent = mail.sent;
      devVerificationUrl = mail.devPreviewUrl;
    } else {
      const mail = await this.mailService.sendActivationEmail(
        user.email,
        String(role),
        opts?.sendCredentials
          ? {
              email: user.email,
              temporaryPassword: generatedPassword,
            }
          : undefined,
      );
      mailSent = mail.sent;
    }

    const { password, emailVerificationTokenHash: _h, emailVerificationExpires: _e, ...result } =
      await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      ...result,
      mailSent,
      devVerificationUrl,
      temporaryPassword: opts?.sendCredentials ? generatedPassword : undefined,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ 
      where: { id },
      include: {
        clientAccountants: { select: { accountant: { select: { id: true, firstName: true, lastName: true } } } },
        collaboratorAccountants: { select: { accountant: { select: { id: true, firstName: true, lastName: true } } } },
      }
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private userCardSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      role: true,
    } as const;
  }

  /** Contacts pour démarrer ou afficher la messagerie selon le rôle. */
  async messagingDirectory(userId: string, role: Role) {
    const sel = this.userCardSelect();

    if (role === Role.CLIENT) {
      const links = await this.prisma.accountantClient.findMany({
        where: { clientId: userId },
        include: { accountant: { select: sel } },
      });
      return { accountants: links.map((l) => l.accountant), clients: [], collaborators: [] };
    }

    if (role === Role.COMPTABLE) {
      const clientLinks = await this.prisma.accountantClient.findMany({
        where: { accountantId: userId },
        include: { client: { select: sel } },
      });
      const collabLinks = await this.prisma.accountantCollaborator.findMany({
        where: { accountantId: userId },
        include: { collaborator: { select: sel } },
      });
      return {
        accountants: [],
        clients: clientLinks.map((l) => l.client),
        collaborators: collabLinks.map((l) => l.collaborator),
      };
    }

    if (role === Role.COLLABORATEUR) {
      const link = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        include: { accountant: { select: sel } },
      });
      if (!link) {
        return { accountants: [], clients: [], collaborators: [] };
      }

      // Find clients where the collaborator is actively involved
      const [mtgs, reqs, tsks] = await Promise.all([
        this.prisma.meeting.findMany({ where: { accountantId: userId }, select: { clientId: true } }),
        this.prisma.request.findMany({ where: { accountantId: userId }, select: { clientId: true } }),
        this.prisma.task.findMany({ where: { assignees: { some: { id: userId } }, clientId: { not: null } }, select: { clientId: true } }),
      ]);

      const relevantClientIds = Array.from(
        new Set([
          ...mtgs.map((m) => m.clientId),
          ...reqs.map((r) => r.clientId),
          ...tsks.map((t) => t.clientId as string),
        ]),
      );

      const clients = await this.prisma.user.findMany({
        where: { id: { in: relevantClientIds } },
        select: sel,
      });

      const collabLinks = await this.prisma.accountantCollaborator.findMany({
        where: { accountantId: link.accountantId },
        include: { collaborator: { select: sel } },
      });

      const otherCollabs = collabLinks
        .map((l) => l.collaborator)
        .filter((c) => c.id !== userId);

      return {
        accountants: [link.accountant],
        clients,
        collaborators: otherCollabs,
      };
    }

    if (role === Role.ADMIN) {
      const users = await this.prisma.user.findMany({
        where: { id: { not: userId }, status: Status.ACTIVE },
        select: sel,
        take: 200,
        orderBy: { lastName: 'asc' },
      });
      return {
        accountants: users.filter((u) => u.role === Role.COMPTABLE),
        clients: users.filter((u) => u.role === Role.CLIENT),
        collaborators: users.filter((u) => u.role === Role.COLLABORATEUR),
      };
    }

    return { accountants: [], clients: [], collaborators: [] };
  }

  async getCollaboratorsWithStats(accountantId: string) {
    try {
      const collabs = await this.prisma.accountantCollaborator.findMany({
        where: { accountantId },
        include: {
          collaborator: {
            include: {
              assignedTasks: true,
            },
          },
        },
      });

      return collabs.map((c) => {
        const user = c.collaborator;
        const tasks = user.assignedTasks || [];
        const total = tasks.length;
        
        const inProgressCount = tasks.filter((t) => t.status === Status.ACTIVE).length; 
        const doneCount = tasks.filter((t) => t.status === Status.DONE || t.status === Status.VALIDATED).length;
        const rejectsCount = tasks.filter((t) => t.status === Status.REJECTED).length;
        
        const overallPerformance = total === 0 ? 0 : Math.round((doneCount / total) * 100);

        const { password, ...safeUser } = user;
        return {
          ...safeUser,
          performance: overallPerformance,
          stats: {
            total,
            inProgress: inProgressCount,
            done: doneCount,
            rejects: rejectsCount,
          },
        };
      });
    } catch (error: any) {
      console.error('Error fetching collaborator stats:', error);
      throw new Error(`Prisma/Data Error: ${error.message}`);
    }
  }

  async getClientsWithStats(accountantId: string) {
    const links = await this.prisma.accountantClient.findMany({
      where: { accountantId },
      include: {
        client: {
          include: {
            ownedDocuments: {
              where: { archived: false },
            },
          },
        },
      },
    });

    return links.map((l) => {
      const user = l.client;
      const docs = user.ownedDocuments;
      // In the document model, VALIDATED or DONE means processed
      const processed = docs.filter((d) => d.status === Status.DONE || d.status === Status.VALIDATED).length;
      const pending = docs.filter((d) => d.status === Status.PENDING || d.status === Status.ACTIVE).length;

      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        stats: {
          processed,
          pending,
        },
      };
    });
  }

  async findAccountantDetails(id: string) {
    const accountant = await this.prisma.user.findUnique({
      where: { id, role: Role.COMPTABLE },
      include: {
        accountantClients: { include: { client: true } },
        accountantCollaborators: { include: { collaborator: true } },
        ownedOrganizations: true,
        accountantReviews: true,
      },
    });
    if (!accountant) throw new NotFoundException('Comptable introuvable');
    
    const { password, ...rest } = accountant;
    return {
      ...rest,
      stats: {
        clients: accountant.accountantClients.length,
        collaborators: accountant.accountantCollaborators.length,
        organizations: accountant.ownedOrganizations.length,
      },
    };
  }

  // --- ADMIN METHODS ---

  async findAllAdmin(query: { role?: Role; status?: Status; search?: string }) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        companyName: true,
        createdAt: true,
        clientAccountants: { select: { accountant: { select: { id: true, firstName: true, lastName: true } } } },
        collaboratorAccountants: { select: { accountant: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async updateStatus(id: string, status: Status) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    if (user.role === Role.COMPTABLE && status === Status.ACTIVE) {
      await this.mailService.sendActivationEmail(user.email, 'Expert Comptable');
    }

    return user;
  }

  private cleanUserData(data: any) {
    const allowedFields = [
      'email', 'firstName', 'lastName', 'companyName', 'phone', 
      'birthDate', 'cinUrl', 'diplomaUrl', 'experienceLevel', 'hireDate',
      'activitySector', 'headquarters', 'legalType', 'location', 'mapsLink',
      'rcNumber', 'whatsapp', 'status', 'role'
    ];
    
    const clean: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        clean[field] = data[field];
      }
    }
    return clean;
  }

  async updateRole(id: string, role: Role) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async updateAdminInfo(id: string, data: any) {
    const cleanData = this.cleanUserData(data);
    // password stays separate for hashing logic if needed, but normally admin avoids it here
    const updated = await this.prisma.user.update({
      where: { id },
      data: cleanData,
    });

    if (data.accountantId !== undefined) {
      if (updated.role === Role.CLIENT) {
        await this.prisma.accountantClient.deleteMany({ where: { clientId: id } });
        if (data.accountantId) {
          await this.prisma.accountantClient.create({ data: { clientId: id, accountantId: data.accountantId } });
        }
      } else if (updated.role === Role.COLLABORATEUR) {
        await this.prisma.accountantCollaborator.deleteMany({ where: { collaboratorId: id } });
        if (data.accountantId) {
          await this.prisma.accountantCollaborator.create({ data: { collaboratorId: id, accountantId: data.accountantId } });
        }
      }
    }

    return updated;
  }

  async updateOwnAdminProfile(id: string, data: any) {
    const allowed = ['email', 'firstName', 'lastName'];
    const clean: any = {};
    for (const field of allowed) {
      if (data[field] !== undefined) clean[field] = data[field];
    }
    return this.prisma.user.update({
      where: { id },
      data: clean,
    });
  }

  async resetPassword(id: string, newPassword?: string) {
    const pwd = newPassword || Math.random().toString(36).substring(2, 10) + '!';
    const hashedPassword = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
    
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { success: true, temporaryPassword: pwd };
  }


  async update(id: string, data: any) {
    const cleanData = this.cleanUserData(data);
    
    // Hash password if updating
    if (data.password) {
      cleanData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    // Convert dates if present
    if (cleanData.birthDate === '') cleanData.birthDate = null;
    else if (cleanData.birthDate) {
      const d = new Date(cleanData.birthDate);
      cleanData.birthDate = isNaN(d.getTime()) ? null : d;
    }

    if (cleanData.hireDate === '') cleanData.hireDate = null;
    else if (cleanData.hireDate) {
      const d = new Date(cleanData.hireDate);
      cleanData.hireDate = isNaN(d.getTime()) ? null : d;
    }

    return this.prisma.user.update({
      where: { id },
      data: cleanData,
    });
  }

  async removeSafe(id: string, accountantId: string) {
    // Verify ownership/link before deleting
    const clientLink = await this.prisma.accountantClient.findFirst({
      where: { accountantId, clientId: id },
    });
    const collabLink = await this.prisma.accountantCollaborator.findFirst({
      where: { accountantId, collaboratorId: id },
    });

    if (!clientLink && !collabLink) {
      throw new ForbiddenException('Vous n\'avez pas la permission de gérer cet utilisateur.');
    }

    // Check for other relations before physical delete
    await this.checkUserRelations(id);

    return this.prisma.user.delete({ where: { id } });
  }

  async remove(id: string) {
    // Check for relations before physical delete
    await this.checkUserRelations(id);
    return this.prisma.user.delete({ where: { id } });
  }

  /**
   * Vérifie si l'utilisateur possède des relations avec d'autres entités.
   * Si oui, la suppression est interdite.
   */
  private async checkUserRelations(id: string) {
    const [
      clients,
      collaborators,
      docsAsClient,
      docsAsAccountant,
      folders,
      meetingsAcc,
      meetingsCli,
      requestsAcc,
      requestsCli,
      requestsCreator,
      tasksAssigned,
      tasksCli,
      tasksCreator,
    ] = await Promise.all([
      this.prisma.accountantClient.count({ where: { accountantId: id } }),
      this.prisma.accountantCollaborator.count({ where: { accountantId: id } }),
      this.prisma.document.count({ where: { clientId: id } }),
      this.prisma.document.count({ where: { accountantId: id } }),
      this.prisma.folder.count({ where: { clientId: id } }),
      this.prisma.meeting.count({ where: { accountantId: id } }),
      this.prisma.meeting.count({ where: { clientId: id } }),
      this.prisma.request.count({ where: { accountantId: id } }),
      this.prisma.request.count({ where: { clientId: id } }),
      this.prisma.request.count({ where: { creatorId: id } }),
      this.prisma.task.count({ where: { assignees: { some: { id } } } }),
      this.prisma.task.count({ where: { clientId: id } }),
      this.prisma.task.count({ where: { createdBy: id } }),
    ]);

    const totalRelations = 
      clients + collaborators + docsAsClient + docsAsAccountant + folders + 
      meetingsAcc + meetingsCli + requestsAcc + requestsCli + requestsCreator + 
      tasksAssigned + tasksCli + tasksCreator;

    if (totalRelations > 0) {
      throw new ForbiddenException(
        'Impossible de supprimer cet utilisateur car il est lié à des données existantes',
      );
    }
  }
  /**
   * Crée l'arborescence comptable pour un client.
   * Utilise le modèle personnalisé de l'expert-comptable si présent, sinon le modèle pro par défaut.
   */
  async createBaseAccountingModel(clientId: string, accountantId?: string) {
    let model = [
      { name: 'Achat', children: [] },
      { name: 'Op.diverses', children: [] },
      { name: 'Caisse', children: [] },
      { name: 'Vente', children: [] },
      { name: 'Banque', children: [] },
    ];

    if (accountantId) {
      const accountant = await this.prisma.user.findUnique({
        where: { id: accountantId },
        select: { folderTemplate: true },
      });

      if (accountant?.folderTemplate) {
        try {
          model = JSON.parse(accountant.folderTemplate);
        } catch (e) {
          console.error('Erreur lors du parsing du modèle de dossiers:', e);
        }
      }
    }

    for (const folder of model) {
      const root = await this.prisma.folder.create({
        data: {
          name: folder.name,
          clientId,
          parentId: null,
        },
      });

      if (folder.children.length > 0) {
        await this.prisma.folder.createMany({
          data: folder.children.map((childName) => ({
            name: childName,
            clientId,
            parentId: root.id,
          })),
        });
      }
    }
  }

  async patchClientFolders() {
    const clients = await this.prisma.user.findMany({
      where: { role: Role.CLIENT },
    });
    const defaultFolders = ['Achat', 'Op.diverses', 'Caisse', 'Vente', 'Banque'];
    let patchedClients = 0;
    for (const client of clients) {
      const folderCount = await this.prisma.folder.count({ where: { clientId: client.id } });
      if (folderCount === 0) {
        for (const name of defaultFolders) {
          await this.prisma.folder.create({ data: { name, clientId: client.id } });
        }
        patchedClients++;
      }
    }
    return { ok: true, patchedClients };
  }

  async changePassword(userId: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });
    return { success: true };
  }
}
