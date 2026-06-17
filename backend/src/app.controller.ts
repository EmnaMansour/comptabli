import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('seed')
  async seed() {
    const hash = await bcrypt.hash('password123', 12);
    
    // 1. Comptable
    const comptable = await this.prisma.user.upsert({
      where: { email: 'comptable@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'COMPTABLE' },
      create: {
        email: 'comptable@comptabli.com',
        password: hash,
        firstName: 'Jean',
        lastName: 'Comptable',
        role: 'COMPTABLE',
        status: 'VALIDATED',
        companyName: 'Cabinet Jean Audit',
        phone: '+216 22 11 22 33',
        location: 'Tunis',
      }
    });

    // Ensure profile exists for networking
    await this.prisma.accountantProfile.upsert({
      where: { accountantId: comptable.id },
      update: { isListed: true },
      create: {
        accountantId: comptable.id,
        companyName: 'Cabinet Jean Audit',
        specialties: ['Fiscalité', 'Audit'],
        bio: 'Expert comptable avec 15 ans d\'expérience.',
        location: 'Tunis',
        email: comptable.email,
        phone: comptable.phone,
        isListed: true,
      }
    });

    // 2. Client
    const client = await this.prisma.user.upsert({
      where: { email: 'client@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'CLIENT' },
      create: {
        email: 'client@comptabli.com',
        password: hash,
        firstName: 'Amine',
        lastName: 'Client',
        role: 'CLIENT',
        status: 'VALIDATED',
        companyName: 'Ma Boutique SARL',
      }
    });

    // Realistic Bank Account for Client
    const flouciAccount = await this.prisma.bankAccount.upsert({
      where: { id: 'seed-flouci-acc' },
      update: { balance: 0 },
      create: {
        id: 'seed-flouci-acc',
        bankName: 'Flouci',
        rib: '3455',
        accountType: 'Courant',
        pack: 'Premium',
        balance: 0,
        currency: 'TND',
        userId: client.id
      }
    });

    // Realistic Transactions
    const txData = [
      { id: 'tx-1', operation: 'Achat Matériel', amount: -450.00, details: 'Paiement fournisseur', reference: 'REF-8822' },
      { id: 'tx-2', operation: 'Virement Reçu', amount: 1200.00, details: 'Facture #441', reference: 'REF-9900' },
      { id: 'tx-3', operation: 'Frais Bancaires', amount: -15.50, details: 'Commission mensuelle', reference: 'REF-0012' }
    ];

    for (const tx of txData) {
      await this.prisma.bankTransaction.upsert({
        where: { id: tx.id },
        update: {
          operation: tx.operation,
          amount: tx.amount,
          date: new Date()
        },
        create: {
          ...tx,
          bankAccountId: flouciAccount.id,
          date: new Date()
        }
      });
    }

    // Realistic Bank Statements
    const statementsData = [
      { id: 'stmt-june', name: 'ExtraitJuin.pdf' },
      { id: 'stmt-july', name: 'ExtraitJuillet.pdf' },
      { id: 'stmt-aug', name: 'ExtraitAoût.pdf' }
    ];

    for (const stmt of statementsData) {
      await this.prisma.bankStatement.upsert({
        where: { id: stmt.id },
        update: {},
        create: {
          ...stmt,
          bankAccountId: flouciAccount.id
        }
      });
    }

    console.log(`Seed: Created/Updated ${txData.length} transactions and ${statementsData.length} statements for ${flouciAccount.bankName}`);

    // Link client to accountant for reviews testing
    await this.prisma.accountantClient.upsert({
      where: { accountantId_clientId: { accountantId: comptable.id, clientId: client.id } },
      update: {},
      create: {
        accountantId: comptable.id,
        clientId: client.id,
      }
    });

    // 3. Admin
    await this.prisma.user.upsert({
      where: { email: 'admin@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'ADMIN' },
      create: {
        email: 'admin@comptabli.com',
        password: hash,
        firstName: 'Admin',
        lastName: 'System',
        role: 'ADMIN',
        status: 'VALIDATED',
      }
    });

    return { 
      message: 'Seed réussi !',
      accounts: [
        { email: 'comptable@comptabli.com', pass: 'password123', role: 'COMPTABLE' },
        { email: 'client@comptabli.com', pass: 'password123', role: 'CLIENT' },
        { email: 'admin@comptabli.com', pass: 'password123', role: 'ADMIN' }
      ]
    };
  }

  @Get('restore')
  async restore() {
    let message = 'Restauration effectuée: ';
    const hash = await bcrypt.hash('password123', 10);
    
    // 1. Restaurer le compte complet comptable1@comptabli.com
    let comptable1 = await this.prisma.user.findUnique({ where: { email: 'comptable1@comptabli.com' } });
    if (comptable1) {
      await this.prisma.user.update({
        where: { id: comptable1.id },
        data: { password: hash, status: 'VALIDATED' }
      });
      message += ' mot de passe de comptable1@comptabli.com réinitialisé à "password123". ';
    } else {
      message += ' l\'utilisateur comptable1@comptabli.com n\'existe pas dans User, je le recrée. ';
      comptable1 = await this.prisma.user.create({
        data: {
          email: 'comptable1@comptabli.com',
          password: hash,
          firstName: 'Cabinet',
          lastName: 'One',
          role: 'COMPTABLE',
          status: 'VALIDATED',
          companyName: 'Cabinet 1',
        }
      });
    }

    // 2. Recréer toutes les fiches Networking manquantes pour les comptables
    const comptables = await this.prisma.user.findMany({ where: { role: 'COMPTABLE' } });
    let created = 0;
    for (const c of comptables) {
      const profile = await this.prisma.accountantProfile.findUnique({ where: { accountantId: c.id } });
      if (!profile) {
        await this.prisma.accountantProfile.create({
          data: {
            accountantId: c.id,
            companyName: c.companyName || 'Cabinet Comptable',
            specialties: ['Général'],
            location: c.location || 'Tunisie',
            phone: c.phone,
            email: c.email,
            isListed: true,
          }
        });
        created++;
      }
    }
    message += ` Rétabli ${created} fiches Networking manquantes.`;
    
    return { success: true, message };
  }

  @Get('health')
  getHealth(): string {
    return 'OK';
  }

  @Get('patch-folders')
  async patchFolders() {
    console.log('--- Début de la mise à jour des dossiers ---');
    const clients = await this.prisma.user.findMany({
      where: { role: 'CLIENT' }
    });
    
    let updatedCount = 0;
    const defaultFolders = ['Achat', 'Op.diverses', 'Caisse', 'Vente', 'Banque'];

    for (const client of clients) {
      const folderCount = await this.prisma.folder.count({
        where: { clientId: client.id }
      });
      if (folderCount === 0) {
        for (const name of defaultFolders) {
          await this.prisma.folder.create({
            data: { name, clientId: client.id }
          });
        }
        updatedCount++;
      }
    }
    return { ok: true, patchedClients: updatedCount };
  }

  @Get('fix-reviews')
  async fixReviews() {
    const reviews = await this.prisma.review.updateMany({
      where: { status: 'PENDING' },
      data: { status: 'ACTIVE' }
    });

    // Recalculate stats for all accountants who have reviews
    const accountants = await this.prisma.review.findMany({
      distinct: ['accountantId'],
      select: { accountantId: true }
    });

    for (const a of accountants) {
      const allReviews = await this.prisma.review.findMany({
        where: { accountantId: a.accountantId, status: 'ACTIVE' }
      });
      const total = allReviews.length;
      const avg = total > 0 ? allReviews.reduce((s, r) => s + r.rating, 0) / total : 0;

      await this.prisma.accountantProfile.update({
        where: { accountantId: a.accountantId },
        data: { totalReviews: total, averageRating: avg }
      }).catch(() => {}); // Ignore if profile doesn't exist
    }

    return { message: `${reviews.count} avis activés et statistiques mises à jour.` };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
