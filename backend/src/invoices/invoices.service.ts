import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Status, Invoice } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    documentId: string;
    vendorName?: string;
    invoiceNumber?: string;
    invoiceDate?: Date;
    dueDate?: Date;
    totalAmount?: number;
    taxAmount?: number;
    currency?: string;
    extractedData?: string;
  }) {
    // Upsert logic for invoice to avoid duplicates
    const existing = await this.prisma.invoice.findFirst({
      where: { documentId: data.documentId }
    });

    // Update document status to VALIDATED and save user modifications
    await this.prisma.document.update({
      where: { id: data.documentId },
      data: {
        status: Status.VALIDATED,
        ...(data.extractedData ? { extractedData: data.extractedData } : {})
      }
    });

    if (existing) {
      return this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          vendorName: data.vendorName,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          totalAmount: data.totalAmount,
          taxAmount: data.taxAmount,
          currency: data.currency,
          extractedData: data.extractedData,
          status: Status.VALIDATED,
        }
      });
    }

    return this.prisma.invoice.create({
      data: {
        ...data,
        status: Status.VALIDATED,
      },
    });
  }

  async findAll(clientId?: string) {
    if (clientId) {
      return this.prisma.invoice.findMany({
        where: { document: { clientId } },
        include: { document: true, corrections: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.invoice.findMany({
      include: { document: true, corrections: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { document: true, corrections: true },
    });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    return invoice;
  }

  async update(id: string, data: Partial<Invoice>) {
    return this.prisma.invoice.update({
      where: { id },
      data,
    });
  }

  async addCorrection(invoiceId: string, correctedBy: string, field: string, oldValue: string | null, newValue: string) {
    if (!field || newValue === undefined) {
      throw new BadRequestException('field and newValue are required');
    }
    return this.prisma.invoiceCorrection.create({
      data: {
        invoiceId,
        correctedBy,
        field,
        oldValue,
        newValue,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.invoice.delete({
      where: { id },
    });
  }
}
