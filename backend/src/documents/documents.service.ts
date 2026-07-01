import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { Express } from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import * as fs from 'fs';
import { join } from 'node:path';

import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { OcrService } from '../ocr/ocr.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly aiService: AiService,
    private readonly ocrService: OcrService,
  ) {}

  async findAll(userId: string, userRole: Role, folderId?: string, archivedOnly?: boolean, filterClientId?: string) {
    const archivedWhere = archivedOnly === true ? { archived: true } : { archived: false };

    if (userRole === Role.ADMIN) {
      return this.prisma.document.findMany({
        where: { 
          ...archivedWhere, 
          ...(filterClientId ? { clientId: filterClientId } : {}),
          folderId: folderId === 'root' ? null : folderId || undefined,
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          accountant: { select: { id: true, firstName: true, lastName: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (userRole === Role.COMPTABLE) {
      const accountantClients = await this.prisma.accountantClient.findMany({
        where: { accountantId: userId },
        select: { clientId: true },
      });
      let clientIds = accountantClients.map((ac) => ac.clientId);
      if (filterClientId) {
        clientIds = clientIds.filter(id => id === filterClientId);
      }

      return this.prisma.document.findMany({
        where: {
          archived: archivedOnly === true ? true : false,
          clientId: filterClientId ? filterClientId : { in: clientIds },
          folderId: folderId === 'root' ? null : folderId || undefined,
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          accountant: { select: { id: true, firstName: true, lastName: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        select: { accountantId: true },
      });
      if (!collab) throw new ForbiddenException('No associated accountant');

      const accountantClients = await this.prisma.accountantClient.findMany({
        where: { accountantId: collab.accountantId },
        select: { clientId: true },
      });
      let clientIds = accountantClients.map((ac) => ac.clientId);
      if (filterClientId) {
        clientIds = clientIds.filter(id => id === filterClientId);
      }

      return this.prisma.document.findMany({
        where: { 
          clientId: { in: clientIds }, 
          ...archivedWhere,
          folderId: folderId === 'root' ? null : folderId || undefined,
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          accountant: { select: { id: true, firstName: true, lastName: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (userRole === Role.CLIENT) {
      if (archivedOnly === true) {
        return this.prisma.document.findMany({
          where: {
            clientId: userId,
            archived: true,
            ...(folderId && folderId !== 'root' ? { folderId } : {}),
          },
          include: {
            accountant: { select: { id: true, firstName: true, lastName: true } },
            folder: { select: { id: true, name: true, parentId: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      return this.prisma.document.findMany({
        where: {
          clientId: userId,
          archived: false,
          folderId: folderId === 'root' ? null : folderId || undefined,
        },
        include: {
          accountant: { select: { id: true, firstName: true, lastName: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        accountant: { select: { id: true, firstName: true, lastName: true } },
        annotations: true,
        versions: true,
        invoices: true,
        comments: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!document) throw new NotFoundException('Document not found');

    // Check permissions
    if (userRole === Role.ADMIN) return document;

    if (userRole === Role.COMPTABLE) {
      const isClient = await this.prisma.accountantClient.findFirst({
        where: { accountantId: userId, clientId: document.clientId },
      });
      if (isClient || document.accountantId === userId) return document;
    }

    if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
        select: { accountantId: true },
      });
      if (collab) {
        const isClient = await this.prisma.accountantClient.findFirst({
          where: { accountantId: collab.accountantId, clientId: document.clientId },
        });
        if (isClient) return document;
      }
    }

    if (userRole === Role.CLIENT && document.clientId === userId) return document;

    throw new ForbiddenException('Access denied');
  }

  async upload(file: Express.Multer.File, clientId: string, accountantId: string, userRole: Role, folderId?: string, customName?: string, category?: string) {
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }

    const uploadsDir = join(process.cwd(), 'backend', 'uploads');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const url = `/uploads/${file.filename}`;

    const doc = await this.prisma.document.create({
      data: {
        name: customName && customName.trim().length > 0 ? customName.trim() : file.originalname,
        type: file.mimetype,
        size: file.size,
        url,
        clientId,
        folderId: folderId || null,
        category: category || null,
        status: (category === 'Devis' || category === 'Bilan') ? 'VALIDATED' : 'PENDING',
        accountantId: userRole === Role.COMPTABLE ? accountantId : null,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        folder: { select: { id: true, name: true } },
      },
    });
    
    // --- Extraction intelligente (OCR) ---
    if (category === 'Facturation') {
      console.log(`DocumentsService: Lancement OCR pour doc ${doc.id}`);
      const ocrTargetUserId = userRole === Role.COMPTABLE ? accountantId : clientId;
      
      this.ocrService.extraireEtSauvegarder(doc.id, ocrTargetUserId).catch((err) => {
        console.error("DocumentsService: Erreur lors de l'extraction OCR", err);
      });
    }

    // Notify recipient
    const targetUserId = userRole === Role.CLIENT ? accountantId : clientId;
    if (targetUserId) {
      // Find actor name
      const actor = await this.prisma.user.findUnique({
        where: { id: userRole === Role.CLIENT ? clientId : accountantId },
        select: { firstName: true, lastName: true, companyName: true },
      });
      const actorName = (actor?.companyName || `${actor?.firstName} ${actor?.lastName}`).trim();

      await this.notificationsService.createForUser(targetUserId, {
        type: 'DOCUMENT_NEW',
        title: 'Nouveau document',
        message: `${actorName} a ajouté un nouveau document : "${doc.name}".`,
        linkedId: doc.id,
        linkedType: 'Document',
      });
    }

    return doc;
  }

  async annotate(documentId: string, content: string, page: number, position: string, userId: string) {
    return this.prisma.documentAnnotation.create({
      data: {
        documentId,
        content,
        authorId: userId,
        page,
        position,
      },
    });
  }

  async patchDocument(
    documentId: string,
    userId: string,
    userRole: Role,
    data: { archived?: boolean; name?: string; folderId?: string | null },
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    // Permissions check
    let allowed = false;
    if (userRole === Role.ADMIN) allowed = true;
    else if (userRole === Role.CLIENT && doc.clientId === userId) allowed = true;
    else if (userRole === Role.COMPTABLE) {
      const isClient = await this.prisma.accountantClient.findFirst({
        where: { accountantId: userId, clientId: doc.clientId },
      });
      if (isClient || doc.accountantId === userId) allowed = true;
    } else if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
      });
      if (collab) {
        const isClient = await this.prisma.accountantClient.findFirst({
          where: { accountantId: collab.accountantId, clientId: doc.clientId },
        });
        if (isClient) allowed = true;
      }
    }

    if (!allowed) {
      throw new ForbiddenException('Vous n’avez pas l’autorisation de modifier ce document');
    }

    const update: { archived?: boolean; name?: string; folderId?: string | null } = {};
    if (data.archived !== undefined) update.archived = data.archived;
    if (data.name !== undefined) update.name = data.name;
    if (data.folderId !== undefined) update.folderId = data.folderId;

    return this.prisma.document.update({
      where: { id: documentId },
      data: update,
      include: {
        folder: { select: { id: true, name: true, parentId: true } },
        accountant: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(documentId: string, userId: string, userRole: Role) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    // Permissions check
    let allowed = false;
    if (userRole === Role.ADMIN) allowed = true;
    else if (userRole === Role.CLIENT && doc.clientId === userId) allowed = true;
    else if (userRole === Role.COMPTABLE) {
      const isClient = await this.prisma.accountantClient.findFirst({
        where: { accountantId: userId, clientId: doc.clientId },
      });
      if (isClient || doc.accountantId === userId) allowed = true;
    } else if (userRole === Role.COLLABORATEUR) {
      const collab = await this.prisma.accountantCollaborator.findFirst({
        where: { collaboratorId: userId },
      });
      if (collab) {
        const isClient = await this.prisma.accountantClient.findFirst({
          where: { accountantId: collab.accountantId, clientId: doc.clientId },
        });
        if (isClient) allowed = true;
      }
    }

    if (!allowed) {
      throw new ForbiddenException('Vous n’avez pas l’autorisation de supprimer ce document');
    }

    // Effacer le fichier physique s'il existe dans le dossier uploads
    if (doc.url && doc.url.startsWith('/uploads/')) {
      const filename = doc.url.replace('/uploads/', '');
      const filePath = join(process.cwd(), 'backend', 'uploads', filename);
      try {
        if (existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Erreur lors de la suppression du fichier ${filePath}:`, err);
      }
    }

    await this.prisma.document.delete({ where: { id: documentId } });
    return { ok: true };
  }

  async addComment(documentId: string, authorId: string, content: string) {
    // 1. Create the comment
    const comment = await this.prisma.documentComment.create({
      data: {
        documentId,
        authorId,
        content,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      },
    });

    // 2. Get the document to know client & accountant
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        name: true,
        clientId: true,
        accountantId: true,
      },
    });

    if (doc) {
      const authorName = (
        comment.author.companyName ||
        `${comment.author.firstName} ${comment.author.lastName}`
      ).trim();

      // 3. Determine who to notify (the other party)
      // If author is the client → notify the accountant
      // If author is accountant/collab → notify the client
      const recipientIds: string[] = [];

      if (authorId === doc.clientId) {
        // Author is the client → notify the accountant (if set)
        if (doc.accountantId) recipientIds.push(doc.accountantId);
      } else {
        // Author is accountant or collaborator → notify the client
        if (doc.clientId && doc.clientId !== authorId) recipientIds.push(doc.clientId);
      }

      for (const recipientId of recipientIds) {
        await this.notificationsService.createForUser(recipientId, {
          type: 'DOCUMENT_COMMENT',
          title: `Nouvel échange sur "${doc.name}"`,
          message: `${authorName} a laissé un commentaire : "${content.length > 80 ? content.slice(0, 80) + '…' : content}"`,
          linkedId: documentId,
          linkedType: 'Document',
        });
      }
    }

    return comment;
  }
}