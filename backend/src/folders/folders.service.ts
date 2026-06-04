import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, userId: string, userRole: Role, parentId?: string, clientId?: string) {
    let targetClientId = userId;

    if (clientId && clientId.trim() !== '' && clientId !== userId) {
      if (userRole === Role.ADMIN) {
        targetClientId = clientId;
      } else if (userRole === Role.COMPTABLE) {
        const link = await this.prisma.accountantClient.findFirst({
          where: { accountantId: userId, clientId },
        });
        if (!link) throw new ForbiddenException('Access to this client folders is denied');
        targetClientId = clientId;
      } else if (userRole === Role.COLLABORATEUR) {
        const collab = await this.prisma.accountantCollaborator.findFirst({
          where: { collaboratorId: userId },
        });
        if (collab) {
          const link = await this.prisma.accountantClient.findFirst({
            where: { accountantId: collab.accountantId, clientId },
          });
          if (!link) throw new ForbiddenException('Access to this client folders is denied');
          targetClientId = clientId;
        } else {
           throw new ForbiddenException('No associated accountant for this collaborator');
        }
      }
    }

    return this.prisma.folder.create({
      data: {
        name,
        clientId: targetClientId,
        parentId: parentId || null,
      },
    });
  }

  async findAll(userId: string, userRole: Role, parentId?: string, clientId?: string, archived = false) {
    let targetClientId = userId;

    if (clientId && clientId.trim() !== '' && clientId !== userId) {
      if (userRole === Role.ADMIN) {
        targetClientId = clientId;
      } else if (userRole === Role.COMPTABLE) {
        const link = await this.prisma.accountantClient.findFirst({
          where: { accountantId: userId, clientId },
        });
        if (!link) throw new ForbiddenException('Access to this client folders is denied');
        targetClientId = clientId;
      } else if (userRole === Role.COLLABORATEUR) {
        const collab = await this.prisma.accountantCollaborator.findFirst({
          where: { collaboratorId: userId },
        });
        if (collab) {
          const link = await this.prisma.accountantClient.findFirst({
            where: { accountantId: collab.accountantId, clientId },
          });
          if (!link) throw new ForbiddenException('Access to this client folders is denied');
          targetClientId = clientId;
        } else {
           throw new ForbiddenException('No associated accountant for this collaborator');
        }
      }
    }

    return this.prisma.folder.findMany({
      where: {
        clientId: targetClientId,
        parentId: parentId === 'root' ? null : parentId || undefined,
        archived,
      },
      include: {
        _count: {
          select: { documents: true, subFolders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        documents: true,
        subFolders: {
          include: {
            _count: { select: { documents: true } },
          },
        },
      },
    });

    if (!folder) throw new NotFoundException('Folder not found');

    if (userRole === Role.CLIENT && folder.clientId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Add logic for COMPTABLE if needed later

    return folder;
  }

  async remove(id: string, userId: string, userRole: Role) {
    const folder = await this.findOne(id, userId, userRole);
    return this.prisma.folder.delete({ where: { id: folder.id } });
  }

  async updateName(id: string, userId: string, userRole: Role, name: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
    });
    if (!folder) throw new NotFoundException('Dossier introuvable');

    // Permission check
    if (userRole === Role.CLIENT && folder.clientId !== userId) {
      throw new ForbiddenException('Access denied');
    } else if (userRole === Role.COMPTABLE) {
      const link = await this.prisma.accountantClient.findFirst({
        where: { accountantId: userId, clientId: folder.clientId },
      });
      if (!link) throw new ForbiddenException('Access to this client folder is denied');
    } else if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
      });
      if (!collab) throw new ForbiddenException('No associated accountant');
      const link = await this.prisma.accountantClient.findFirst({
        where: { accountantId: collab.accountantId, clientId: folder.clientId },
      });
      if (!link) throw new ForbiddenException('Access to this client folder is denied');
    }

    return this.prisma.folder.update({
      where: { id },
      data: { name: name.trim() },
      include: {
        _count: { select: { documents: true, subFolders: true } },
      },
    });
  }

  private async collectDescendantFolderIds(rootId: string, clientId: string): Promise<string[]> {
    const ids: string[] = [rootId];
    const children = await this.prisma.folder.findMany({
      where: { parentId: rootId, clientId },
      select: { id: true },
    });
    for (const c of children) {
      ids.push(...(await this.collectDescendantFolderIds(c.id, clientId)));
    }
    return ids;
  }

  /** 
   * Archive/Désarchive un dossier et récursivement tous ses documents et sous-dossiers.
   */
  async updateArchivedRecursive(id: string, userId: string, userRole: Role, archived: boolean) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
    });
    if (!folder) throw new NotFoundException('Dossier introuvable');

    // Permission check
    if (userRole === Role.CLIENT && folder.clientId !== userId) {
      throw new ForbiddenException('Access denied');
    } else if (userRole === Role.COMPTABLE) {
      const link = await this.prisma.accountantClient.findFirst({
        where: { accountantId: userId, clientId: folder.clientId },
      });
      if (!link) throw new ForbiddenException('Access to this client folder is denied');
    } else if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
      });
      if (!collab) throw new ForbiddenException('No associated accountant');
      const link = await this.prisma.accountantClient.findFirst({
        where: { accountantId: collab.accountantId, clientId: folder.clientId },
      });
      if (!link) throw new ForbiddenException('Access to this client folder is denied');
    }

    const folderIds = await this.collectDescendantFolderIds(id, folder.clientId);

    // 1. Update all folders
    await this.prisma.folder.updateMany({
      where: { id: { in: folderIds } },
      data: { archived },
    });

    // 2. Update all documents in these folders
    const res = await this.prisma.document.updateMany({
      where: { folderId: { in: folderIds } },
      data: { archived },
    });

    return { folderIds, documentCount: res.count };
  }

  /** Archive tous les documents du dossier et de ses sous-dossiers (reste visible dans Archives). */
  async archiveAllDocumentsInFolder(folderId: string, userId: string, userRole: Role) {
    return this.updateArchivedRecursive(folderId, userId, userRole, true);
  }
}
