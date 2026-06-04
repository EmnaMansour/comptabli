import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async createConversation(userIds: string[], type: string = 'PRIVATE', name?: string) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length < 2) {
      throw new ForbiddenException('Au moins deux participants requis');
    }
    return this.prisma.conversation.create({
      data: {
        type,
        name,
        participants: {
          create: unique.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });
  }

  async findAllConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const p = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!p) throw new ForbiddenException('Accès à la conversation refusé');
  }

  async findConversation(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { 
            sender: true,
            linkedDocument: true,
            linkedRequest: true,
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation non trouvée');
    await this.assertParticipant(id, userId);
    return conversation;
  }

  async sendMessage(
    conversationId: string, 
    senderId: string, 
    content: string, 
    type: string = 'TEXT',
    linkedId?: string,
    linkedType?: 'Document' | 'Request'
  ) {
    await this.assertParticipant(conversationId, senderId);
    const data: any = {
      conversationId,
      senderId,
      content,
      type,
    };

    if (linkedType === 'Document') data.linkedDocumentId = linkedId;
    if (linkedType === 'Request') data.linkedRequestId = linkedId;

    const msg = await this.prisma.message.create({
      data,
      include: {
        sender: true,
        linkedDocument: true,
        linkedRequest: true,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify other participants
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
      },
      include: { user: true },
    });

    const senderName =
      msg.sender.firstName && msg.sender.lastName
        ? `${msg.sender.firstName} ${msg.sender.lastName}`
        : msg.sender.companyName || 'Un utilisateur';

    for (const p of participants) {
      await this.notifications.createForUser(p.userId, {
        type: 'NEW_MESSAGE',
        title: `Nouveau message de ${senderName}`,
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        linkedId: conversationId,
        linkedType: 'Conversation',
      });
    }

    return msg;
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message introuvable');
    await this.assertParticipant(message.conversationId, userId);
    return this.prisma.messageRead.upsert({
      where: {
        messageId_userId: { messageId, userId },
      },
      create: {
        messageId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
    });
  }

  async updateMessage(id: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message introuvable');
    if (message.senderId !== userId) {
      throw new ForbiddenException('Seul l\'expéditeur peut modifier ce message');
    }
    return this.prisma.message.update({
      where: { id },
      data: { content, updatedAt: new Date() },
    });
  }

  async deleteMessage(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message introuvable');
    if (message.senderId !== userId) {
      throw new ForbiddenException('Seul l\'expéditeur peut supprimer ce message');
    }
    return this.prisma.message.delete({ where: { id } });
  }
}
