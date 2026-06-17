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

  // ─────────────────────────────────────────────────────────────────────────────
  // SEED STANDARD
  // ─────────────────────────────────────────────────────────────────────────────
  @Get('seed')
  async seed() {
    const hash = await bcrypt.hash('password123', 12);

    const comptable = await this.prisma.user.upsert({
      where: { email: 'comptable@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'COMPTABLE' },
      create: {
        email: 'comptable@comptabli.com', password: hash,
        firstName: 'Jean', lastName: 'Comptable',
        role: 'COMPTABLE', status: 'VALIDATED',
        companyName: 'Cabinet Jean Audit', phone: '+216 22 11 22 33', location: 'Tunis',
      },
    });

    await this.prisma.accountantProfile.upsert({
      where: { accountantId: comptable.id },
      update: { isListed: true },
      create: {
        accountantId: comptable.id, companyName: 'Cabinet Jean Audit',
        specialties: ['Fiscalité', 'Audit'], bio: "Expert comptable avec 15 ans d'expérience.",
        location: 'Tunis', email: comptable.email, phone: comptable.phone, isListed: true,
      },
    });

    const client = await this.prisma.user.upsert({
      where: { email: 'client@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'CLIENT' },
      create: {
        email: 'client@comptabli.com', password: hash,
        firstName: 'Amine', lastName: 'Client',
        role: 'CLIENT', status: 'VALIDATED', companyName: 'Ma Boutique SARL',
      },
    });

    await this.prisma.accountantClient.upsert({
      where: { accountantId_clientId: { accountantId: comptable.id, clientId: client.id } },
      update: {},
      create: { accountantId: comptable.id, clientId: client.id },
    });

    await this.prisma.user.upsert({
      where: { email: 'admin@comptabli.com' },
      update: { password: hash, status: 'VALIDATED', role: 'ADMIN' },
      create: {
        email: 'admin@comptabli.com', password: hash,
        firstName: 'Admin', lastName: 'System',
        role: 'ADMIN', status: 'VALIDATED',
      },
    });

    return {
      message: 'Seed réussi !',
      accounts: [
        { email: 'comptable@comptabli.com', pass: 'password123', role: 'COMPTABLE' },
        { email: 'client@comptabli.com', pass: 'password123', role: 'CLIENT' },
        { email: 'admin@comptabli.com', pass: 'password123', role: 'ADMIN' },
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEED DÉMO TUNISIE — Données réalistes pour présentation jury
  // ─────────────────────────────────────────────────────────────────────────────
  @Get('seed-demo')
  async seedDemo() {
    const hash = await bcrypt.hash('Comptabli2026!', 10);
    const past = (d: number) => new Date(Date.now() - d * 86_400_000);
    const future = (d: number) => new Date(Date.now() + d * 86_400_000);

    // ── 1. COMPTABLE ──────────────────────────────────────────────────────────
    const comptable = await this.prisma.user.upsert({
      where: { email: 'sana.belhaj@comptabli.tn' },
      update: { status: 'VALIDATED' },
      create: {
        email: 'sana.belhaj@comptabli.tn', password: hash,
        firstName: 'Sana', lastName: 'Belhaj',
        role: 'COMPTABLE', status: 'VALIDATED',
        companyName: 'Cabinet Belhaj & Associés',
        phone: '+216 71 234 567', location: 'Tunis',
        activitySector: 'Expertise Comptable', website: 'https://belhaj-audit.tn',
      },
    });

    await this.prisma.accountantProfile.upsert({
      where: { accountantId: comptable.id },
      update: { averageRating: 4.7, totalReviews: 3, isListed: true },
      create: {
        accountantId: comptable.id,
        companyName: 'Cabinet Belhaj & Associés',
        specialties: ['Fiscalité', 'Audit', 'TVA', 'Paie'],
        bio: "Expert-comptable diplômée avec 12 ans d'expérience en fiscalité tunisienne et audit des PME. Accompagnement personnalisé pour les entreprises en forte croissance.",
        location: 'Tunis', email: 'sana.belhaj@comptabli.tn', phone: '+216 71 234 567',
        yearsExperience: 12, averageRating: 4.7, totalReviews: 3, isListed: true,
        website: 'https://belhaj-audit.tn',
      },
    });

    // ── ORGANISATION ─────────────────────────────────────────────────────────
    const org = await this.prisma.organization.upsert({
      where: { id: 'org-demo-belhaj' },
      update: {},
      create: { id: 'org-demo-belhaj', name: 'Cabinet Belhaj & Associés', ownerId: comptable.id },
    });

    await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: comptable.id } },
      update: {},
      create: { organizationId: org.id, userId: comptable.id, role: 'OWNER' },
    });

    // ── 2. COLLABORATEUR ─────────────────────────────────────────────────────
    const collab = await this.prisma.user.upsert({
      where: { email: 'youssef.ayedi@comptabli.tn' },
      update: { status: 'VALIDATED' },
      create: {
        email: 'youssef.ayedi@comptabli.tn', password: hash,
        firstName: 'Youssef', lastName: 'Ayedi',
        role: 'COLLABORATEUR', status: 'VALIDATED',
        companyName: 'Cabinet Belhaj & Associés', phone: '+216 52 345 678', location: 'Tunis',
      },
    });

    await this.prisma.accountantCollaborator.upsert({
      where: { accountantId_collaboratorId: { accountantId: comptable.id, collaboratorId: collab.id } },
      update: {},
      create: { accountantId: comptable.id, collaboratorId: collab.id },
    });

    await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: collab.id } },
      update: {},
      create: { organizationId: org.id, userId: collab.id, role: 'MEMBER' },
    });

    // ── 3. CLIENTS ────────────────────────────────────────────────────────────
    const clientsRaw = [
      {
        email: 'amine.trabelsi@gmail.com', firstName: 'Amine', lastName: 'Trabelsi',
        companyName: 'Trabelsi Import-Export SARL', phone: '+216 20 111 222',
        location: 'Sfax', activitySector: 'Commerce International',
        legalType: 'SARL', rcNumber: '2019B12345',
      },
      {
        email: 'nadia.bensalem@gmail.com', firstName: 'Nadia', lastName: 'Ben Salem',
        companyName: 'NBS Beauté & Cosmétiques', phone: '+216 55 222 333',
        location: 'Sousse', activitySector: 'Commerce de détail',
        legalType: 'SUARL', rcNumber: '2021S45678',
      },
      {
        email: 'contact@techvision.tn', firstName: 'Maher', lastName: 'Khalil',
        companyName: 'TechVision Solutions', phone: '+216 71 456 789',
        location: 'Tunis', activitySector: 'Informatique et Digital',
        legalType: 'SA', rcNumber: '2018T98765',
      },
    ];

    const clients: any[] = [];
    for (const cd of clientsRaw) {
      const c = await this.prisma.user.upsert({
        where: { email: cd.email },
        update: { status: 'VALIDATED' },
        create: { ...cd, password: hash, role: 'CLIENT', status: 'VALIDATED' },
      });
      clients.push(c);
      await this.prisma.accountantClient.upsert({
        where: { accountantId_clientId: { accountantId: comptable.id, clientId: c.id } },
        update: {},
        create: { accountantId: comptable.id, clientId: c.id },
      });
      const existingFolders = await this.prisma.folder.count({ where: { clientId: c.id } });
      if (existingFolders === 0) {
        for (const name of ['Achat', 'Vente', 'Banque', 'Caisse', 'Op.diverses']) {
          await this.prisma.folder.create({ data: { name, clientId: c.id } });
        }
      }
    }

    const [clientAmine, clientNadia, clientMaher] = clients;

    // ── 4. DOCUMENTS & FACTURES ───────────────────────────────────────────────
    const docsSpec = [
      // Client Amine
      { client: clientAmine, name: 'Facture_F2025-001_Carthage.pdf', cat: 'Facturation', status: 'VALIDATED', amount: 4800, tax: 912, vendor: 'Trabelsi Import-Export SARL', invNum: 'F2025-001', daysAgo: 28 },
      { client: clientAmine, name: 'Facture_F2025-002_Elyes.pdf', cat: 'Facturation', status: 'VALIDATED', amount: 2350, tax: 446.5, vendor: 'Trabelsi Import-Export SARL', invNum: 'F2025-002', daysAgo: 15 },
      { client: clientAmine, name: 'Bilan_2024_Trabelsi.pdf', cat: 'Bilan', status: 'VALIDATED', amount: 0, tax: 0, vendor: '', invNum: '', daysAgo: 60 },
      // Client Nadia
      { client: clientNadia, name: 'Facture_Fournisseur_Mars2025.pdf', cat: 'Facturation', status: 'VALIDATED', amount: 1560, tax: 296.4, vendor: 'NBS Beauté & Cosmétiques', invNum: 'F-NADIA-001', daysAgo: 18 },
      { client: clientNadia, name: 'Contrat_Location_Sousse.pdf', cat: 'Contrat', status: 'PENDING', amount: 0, tax: 0, vendor: '', invNum: '', daysAgo: 7 },
      // Client Maher
      { client: clientMaher, name: 'Facture_Serveur_Cloud_2025.pdf', cat: 'Facturation', status: 'VALIDATED', amount: 8900, tax: 1691, vendor: 'TechVision Solutions', invNum: 'TV-2025-009', daysAgo: 10 },
      { client: clientMaher, name: 'Declaration_TVA_T1_2025.pdf', cat: 'Fiscalité', status: 'VALIDATED', amount: 0, tax: 0, vendor: '', invNum: '', daysAgo: 45 },
      { client: clientMaher, name: 'Bilan_Previsionnel_2025.pdf', cat: 'Bilan', status: 'VALIDATED', amount: 0, tax: 0, vendor: '', invNum: '', daysAgo: 5 },
    ];

    for (const d of docsSpec) {
      const doc = await this.prisma.document.create({
        data: {
          name: d.name, type: 'application/pdf', size: 240_000,
          url: `/uploads/${d.name}`,
          status: d.status as any,
          clientId: d.client.id, accountantId: comptable.id, category: d.cat,
          createdAt: past(d.daysAgo),
        },
      });
      if (d.cat === 'Facturation' && d.amount > 0) {
        await this.prisma.invoice.create({
          data: {
            documentId: doc.id, vendorName: d.vendor, invoiceNumber: d.invNum,
            invoiceDate: past(d.daysAgo + 2), totalAmount: d.amount, taxAmount: d.tax,
            currency: 'TND', status: 'VALIDATED',
          },
        });
      }
    }

    // ── 5. RENDEZ-VOUS ────────────────────────────────────────────────────────
    await this.prisma.meeting.createMany({
      data: [
        {
          title: 'Revue bilan annuel 2024', type: 'PHYSIQUE', status: 'ACTIVE',
          scheduledAt: future(3), duration: 60,
          clientId: clientAmine.id, accountantId: comptable.id,
          description: 'Présentation et validation du bilan comptable annuel.',
        },
        {
          title: 'Déclaration TVA Juin 2025', type: 'VISIO', status: 'ACTIVE',
          scheduledAt: future(7), duration: 45,
          clientId: clientNadia.id, accountantId: comptable.id,
          description: 'Vérification et signature de la déclaration TVA du mois de juin.',
          meetingLink: 'https://meet.google.com/abc-def-ghi',
        },
        {
          title: 'Audit interne TechVision Q2', type: 'PHYSIQUE', status: 'PENDING',
          scheduledAt: future(14), duration: 120,
          clientId: clientMaher.id, accountantId: comptable.id,
          description: "Audit préparatoire avant contrôle fiscal.",
        },
      ],
    });

    // ── 6. DEMANDES ───────────────────────────────────────────────────────────
    await this.prisma.request.createMany({
      data: [
        {
          clientId: clientAmine.id, accountantId: comptable.id,
          type: 'DOCUMENT', subject: 'Attestation fiscale 2024',
          description: "J'ai besoin d'une attestation fiscale pour le renouvellement de ma patente.",
          urgency: 'HIGH', status: 'PENDING', createdAt: past(2),
        },
        {
          clientId: clientNadia.id, accountantId: comptable.id,
          type: 'CONSEIL', subject: 'Optimisation TVA - Nouveau produit',
          description: "Je lance une nouvelle gamme de cosmétiques. Comment optimiser la TVA collectée ?",
          urgency: 'NORMAL', status: 'PENDING', createdAt: past(5),
        },
        {
          clientId: clientMaher.id, accountantId: comptable.id,
          type: 'DOCUMENT', subject: 'Liasse fiscale IS 2024',
          description: "Préparer et transmettre la liasse fiscale complète pour l'IS 2024.",
          urgency: 'NORMAL', status: 'DONE', createdAt: past(20),
        },
      ],
    });

    // ── 7. TÂCHES ─────────────────────────────────────────────────────────────
    const tasksSpec = [
      { title: 'Préparer déclaration TVA mai 2025 — Trabelsi', description: "Calculer et préparer la déclaration TVA du mois de mai 2025.", priority: 'HIGH', status: 'ACTIVE', deadline: future(5), clientId: clientAmine.id },
      { title: 'Clôturer exercice fiscal NBS 2024', description: "Effectuer les écritures de clôture et préparer le bilan définitif.", priority: 'HIGH', status: 'PENDING', deadline: future(10), clientId: clientNadia.id },
      { title: 'Vérification charges TechVision Q1', description: "Revoir les justificatifs de charges du 1er trimestre.", priority: 'MEDIUM', status: 'DONE', deadline: past(3), clientId: clientMaher.id },
      { title: 'Mise à jour modèle dossier clients (OECT)', description: "Adapter la structure de dossiers au nouveau format recommandé par l'OECT.", priority: 'LOW', status: 'PENDING', deadline: future(20), clientId: null },
    ];

    for (const t of tasksSpec) {
      await this.prisma.task.create({
        data: {
          title: t.title, description: t.description, priority: t.priority,
          status: t.status as any, deadline: t.deadline,
          createdBy: comptable.id, organizationId: org.id,
          ...(t.clientId ? { clientId: t.clientId } : {}),
          assignees: { connect: [{ id: comptable.id }] },
        },
      });
    }

    // ── 8. AVIS ───────────────────────────────────────────────────────────────
    const reviewsSpec = [
      { client: clientAmine, rating: 5, comment: "Service impeccable, très réactif et professionnel. Je recommande vivement Cabinet Belhaj !" },
      { client: clientNadia, rating: 4, comment: "Très bonne expertise, explications claires. Quelques délais sur les retours de documents." },
      { client: clientMaher, rating: 5, comment: "Excellente maîtrise de la fiscalité IT en Tunisie. Un vrai partenaire pour notre croissance." },
    ];

    for (const r of reviewsSpec) {
      await this.prisma.review.upsert({
        where: { clientId_accountantId: { clientId: r.client.id, accountantId: comptable.id } },
        update: { rating: r.rating, comment: r.comment, status: 'ACTIVE', hasRelationship: true },
        create: {
          clientId: r.client.id, accountantId: comptable.id,
          accountantId_profile: comptable.id,
          rating: r.rating, comment: r.comment, status: 'ACTIVE', hasRelationship: true,
        },
      });
    }

    const avgRating = reviewsSpec.reduce((s, r) => s + r.rating, 0) / reviewsSpec.length;
    await this.prisma.accountantProfile.update({
      where: { accountantId: comptable.id },
      data: { averageRating: avgRating, totalReviews: reviewsSpec.length },
    });

    return {
      ok: true,
      message: '✅ Données de démo tunisiennes créées avec succès !',
      comptable: { email: 'sana.belhaj@comptabli.tn', motDePasse: 'Comptabli2026!' },
      collaborateur: { email: 'youssef.ayedi@comptabli.tn', motDePasse: 'Comptabli2026!' },
      clients: clientsRaw.map(c => ({ email: c.email, motDePasse: 'Comptabli2026!', société: c.companyName })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────────────────────────────────────
  @Get('restore')
  async restore() {
    const hash = await bcrypt.hash('password123', 10);
    let message = 'Restauration effectuée: ';
    let comptable1 = await this.prisma.user.findUnique({ where: { email: 'comptable1@comptabli.com' } });
    if (comptable1) {
      await this.prisma.user.update({ where: { id: comptable1.id }, data: { password: hash, status: 'VALIDATED' } });
      message += ' mot de passe de comptable1@comptabli.com réinitialisé à "password123".';
    } else {
      comptable1 = await this.prisma.user.create({
        data: { email: 'comptable1@comptabli.com', password: hash, firstName: 'Cabinet', lastName: 'One', role: 'COMPTABLE', status: 'VALIDATED', companyName: 'Cabinet 1' },
      });
    }
    const comptables = await this.prisma.user.findMany({ where: { role: 'COMPTABLE' } });
    let created = 0;
    for (const c of comptables) {
      const profile = await this.prisma.accountantProfile.findUnique({ where: { accountantId: c.id } });
      if (!profile) {
        await this.prisma.accountantProfile.create({ data: { accountantId: c.id, companyName: c.companyName || 'Cabinet Comptable', specialties: ['Général'], location: c.location || 'Tunisie', phone: c.phone, email: c.email, isListed: true } });
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
    const clients = await this.prisma.user.findMany({ where: { role: 'CLIENT' } });
    let updatedCount = 0;
    const defaultFolders = ['Achat', 'Op.diverses', 'Caisse', 'Vente', 'Banque'];
    for (const client of clients) {
      const folderCount = await this.prisma.folder.count({ where: { clientId: client.id } });
      if (folderCount === 0) {
        for (const name of defaultFolders) {
          await this.prisma.folder.create({ data: { name, clientId: client.id } });
        }
        updatedCount++;
      }
    }
    return { ok: true, patchedClients: updatedCount };
  }

  @Get('fix-reviews')
  async fixReviews() {
    const reviews = await this.prisma.review.updateMany({ where: { status: 'PENDING' }, data: { status: 'ACTIVE' } });
    const accountants = await this.prisma.review.findMany({ distinct: ['accountantId'], select: { accountantId: true } });
    for (const a of accountants) {
      const allReviews = await this.prisma.review.findMany({ where: { accountantId: a.accountantId, status: 'ACTIVE' } });
      const total = allReviews.length;
      const avg = total > 0 ? allReviews.reduce((s, r) => s + r.rating, 0) / total : 0;
      await this.prisma.accountantProfile.update({ where: { accountantId: a.accountantId }, data: { totalReviews: total, averageRating: avg } }).catch(() => {});
    }
    return { message: `${reviews.count} avis activés et statistiques mises à jour.` };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
