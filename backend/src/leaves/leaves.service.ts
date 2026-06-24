import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async create(data: { accountantId: string; startDate: Date; endDate: Date; reason?: string }) {
    return this.prisma.accountantLeave.create({
      data,
    });
  }

  async findAllByAccountant(accountantId: string) {
    return this.prisma.accountantLeave.findMany({
      where: { accountantId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findAllForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.accountantLeave.findMany({ orderBy: { startDate: 'desc' } });
    }
    if (role === 'COMPTABLE') {
      return this.findAllByAccountant(userId);
    }
    if (role === 'CLIENT') {
      const accClients = await this.prisma.accountantClient.findMany({
        where: { clientId: userId },
        select: { accountantId: true }
      });
      const accIds = accClients.map(ac => ac.accountantId);
      return this.prisma.accountantLeave.findMany({
        where: { accountantId: { in: accIds } },
        orderBy: { startDate: 'desc' },
      });
    }
    if (role === 'COLLABORATEUR') {
      const accCollabs = await this.prisma.accountantCollaborator.findMany({
        where: { collaboratorId: userId },
        select: { accountantId: true }
      });
      const accIds = accCollabs.map(ac => ac.accountantId);
      return this.prisma.accountantLeave.findMany({
        where: { accountantId: { in: accIds } },
        orderBy: { startDate: 'desc' },
      });
    }
    return [];
  }

  async remove(id: string, accountantId: string) {
    const leave = await this.prisma.accountantLeave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Congé introuvable');
    if (leave.accountantId !== accountantId) throw new NotFoundException('Accès refusé');

    return this.prisma.accountantLeave.delete({
      where: { id },
    });
  }
}
