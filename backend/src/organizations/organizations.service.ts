import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAdmin() {
    return this.prisma.organization.findMany({
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: { storageUsed: 'desc' },
    });
  }

  async updateQuota(id: string, storageLimit: number) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organisation introuvable');

    return this.prisma.organization.update({
      where: { id },
      data: { storageLimit },
    });
  }
}
