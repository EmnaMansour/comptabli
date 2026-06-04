import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class BanksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    bankName: string;
    agency?: string;
    rib?: string;
    accountType?: string;
    pack?: string;
    login?: string;
    password?: string;
    balance?: number;
    currency?: string;
  }, userId: string) {
    return this.prisma.bankAccount.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      include: {
        transactions: {
          take: 100,
          orderBy: { date: 'desc' },
        },
        statements: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        statements: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!account) throw new NotFoundException('Compte bancaire non trouvé');
    if (account.userId !== userId) throw new ForbiddenException('Accès refusé');

    return account;
  }

  async update(id: string, data: Partial<{
    bankName: string;
    agency: string;
    rib: string;
    accountType: string;
    pack: string;
    login: string;
    password: string;
    balance: number;
    currency: string;
  }>, userId: string) {
    const account = await this.findOne(id, userId);
    return this.prisma.bankAccount.update({
      where: { id: account.id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    const account = await this.findOne(id, userId);
    return this.prisma.bankAccount.delete({
      where: { id: account.id },
    });
  }

  async addTransaction(bankAccountId: string, data: {
    operation: string;
    details?: string;
    reference?: string;
    amount: number;
    currency?: string;
  }, userId: string) {
    const account = await this.findOne(bankAccountId, userId);
    
    // In a real app, we would update the balance here
    await this.prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        balance: { increment: data.amount }
      }
    });

    return this.prisma.bankTransaction.create({
      data: {
        ...data,
        bankAccountId,
      },
    });
  }
}
