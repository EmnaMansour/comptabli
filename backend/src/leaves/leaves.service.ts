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

  async remove(id: string, accountantId: string) {
    const leave = await this.prisma.accountantLeave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Congé introuvable');
    if (leave.accountantId !== accountantId) throw new NotFoundException('Accès refusé');

    return this.prisma.accountantLeave.delete({
      where: { id },
    });
  }
}
