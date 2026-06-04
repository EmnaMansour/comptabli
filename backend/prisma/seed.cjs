/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed the database with initial data.
 * Usage : cd backend && npx prisma db seed
 */
require('dotenv').config();

const { PrismaClient, Prisma, Role, Status } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const bcrypt = require('bcrypt');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL manquant dans .env');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL manquant dans .env');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  // Hash password function
  const hashPassword = async (plain) => await bcrypt.hash(plain, 10);

  // 1. Create Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existingAdmins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  });
  if (existingAdmins.some((adminUser) => adminUser.email !== adminEmail)) {
    throw new Error(
      `Un seul compte ADMIN est autorisé. Comptes ADMIN existants: ${existingAdmins
        .map((adminUser) => adminUser.email)
        .join(', ')}`,
    );
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      password: await hashPassword(adminPassword),
      firstName: 'Admin',
      lastName: 'Comptabli',
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
    update: {
      password: await hashPassword(adminPassword),
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  });

  console.log('Admin created:', admin.email);

  // 2. Create 2 Comptables
  const comptables = [
    { email: 'comptable1@comptabli.com', firstName: 'Jean', lastName: 'Dupont', password: 'Comptable123!' },
    { email: 'comptable2@comptabli.com', firstName: 'Marie', lastName: 'Martin', password: 'Comptable123!' },
  ];

  const createdComptables = [];
  for (const c of comptables) {
    const comptable = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        password: await hashPassword(c.password),
        firstName: c.firstName,
        lastName: c.lastName,
        role: Role.COMPTABLE,
        status: Status.ACTIVE,
      },
      update: {
        password: await hashPassword(c.password),
        role: Role.COMPTABLE,
        status: Status.ACTIVE,
      },
    });
    createdComptables.push(comptable);
    console.log('Comptable created:', comptable.email);
  }

  // 3. Create Organizations for Comptables
  const organizations = [];
  for (const comptable of createdComptables) {
    const org = await prisma.organization.upsert({
      where: { name: `Cabinet ${comptable.lastName}` },
      create: {
        name: `Cabinet ${comptable.lastName}`,
        ownerId: comptable.id,
      },
      update: {},
    });
    organizations.push(org);
    console.log('Organization created:', org.name);
  }

  // 4. Create 3 Clients
  const clients = [
    { email: 'client1@comptabli.com', firstName: 'Alice', lastName: 'Client', companyName: 'Entreprise A', password: 'Client123!' },
    { email: 'client2@comptabli.com', firstName: 'Bob', lastName: 'Client', companyName: 'Entreprise B', password: 'Client123!' },
    { email: 'client3@comptabli.com', firstName: 'Charlie', lastName: 'Client', companyName: 'Entreprise C', password: 'Client123!' },
  ];

  const createdClients = [];
  for (const c of clients) {
    const client = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        password: await hashPassword(c.password),
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        role: Role.CLIENT,
        status: Status.ACTIVE,
      },
      update: {
        password: await hashPassword(c.password),
        role: Role.CLIENT,
        status: Status.ACTIVE,
      },
    });
    createdClients.push(client);
    console.log('Client created:', client.email);
  }

  // 5. Assign clients to comptables
  // Client 1 and 2 to Comptable 1, Client 3 to Comptable 2
  await prisma.accountantClient.createMany({
    data: [
      { accountantId: createdComptables[0].id, clientId: createdClients[0].id },
      { accountantId: createdComptables[0].id, clientId: createdClients[1].id },
      { accountantId: createdComptables[1].id, clientId: createdClients[2].id },
    ],
    skipDuplicates: true,
  });

  // 6. Create 2 Collaborateurs
  const collaborateurs = [
    { email: 'collab1@comptabli.com', firstName: 'Pierre', lastName: 'Collaborateur', password: 'Collab123!' },
    { email: 'collab2@comptabli.com', firstName: 'Sophie', lastName: 'Collaborateur', password: 'Collab123!' },
  ];

  const createdCollabs = [];
  for (const c of collaborateurs) {
    const collab = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        password: await hashPassword(c.password),
        firstName: c.firstName,
        lastName: c.lastName,
        role: Role.COLLABORATEUR,
        status: Status.ACTIVE,
      },
      update: {
        password: await hashPassword(c.password),
        role: Role.COLLABORATEUR,
        status: Status.ACTIVE,
      },
    });
    createdCollabs.push(collab);
    console.log('Collaborateur created:', collab.email);
  }

  // 7. Assign collaborateurs to comptables
  // Both to Comptable 1
  await prisma.accountantCollaborator.createMany({
    data: [
      { accountantId: createdComptables[0].id, collaboratorId: createdCollabs[0].id },
      { accountantId: createdComptables[0].id, collaboratorId: createdCollabs[1].id },
    ],
    skipDuplicates: true,
  });

  // 8. Add members to organizations
  for (const org of organizations) {
    const comptable = createdComptables[organizations.indexOf(org)];
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: comptable.id } },
      create: {
        organizationId: org.id,
        userId: comptable.id,
        role: 'OWNER',
      },
      update: {},
    });

    // Add clients and collabs to org
    const relatedClients = await prisma.accountantClient.findMany({
      where: { accountantId: comptable.id },
      select: { clientId: true },
    });
    for (const rc of relatedClients) {
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: rc.clientId } },
        create: {
          organizationId: org.id,
          userId: rc.clientId,
          role: 'MEMBER',
        },
        update: {},
      });
    }

    const relatedCollabs = await prisma.accountantCollaborator.findMany({
      where: { accountantId: comptable.id },
      select: { collaboratorId: true },
    });
    for (const rc of relatedCollabs) {
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: rc.collaboratorId } },
        create: {
          organizationId: org.id,
          userId: rc.collaboratorId,
          role: 'MEMBER',
        },
        update: {},
      });
    }
  }

  // 9. Create Bank Accounts for Client 1
  const client1 = createdClients[0];
  const bankAccounts = [
    { 
      bankName: 'Flouci', 
      agency: 'Ennasr', 
      accountType: 'Courant', 
      pack: 'Gold', 
      rib: '12345678901234567890', 
      balance: 12309, 
      userId: client1.id 
    },
    { 
      bankName: 'e-Dinar Jeune', 
      agency: 'La Poste', 
      accountType: 'Epargne', 
      pack: 'Standard', 
      rib: '98765432109876543210', 
      balance: 1450, 
      userId: client1.id 
    },
    { 
      bankName: 'Attijari Bank', 
      agency: 'Manar 1', 
      accountType: 'Courant', 
      pack: 'Silver', 
      rib: '11223344556677889900', 
      balance: 8700, 
      userId: client1.id 
    },
    { 
      bankName: 'Banque Zitouna', 
      agency: 'Aouina', 
      accountType: 'Courant', 
      pack: 'Technologique', 
      rib: '55443322110099887766', 
      balance: 2100, 
      userId: client1.id 
    },
  ];

  for (const ba of bankAccounts) {
    const account = await prisma.bankAccount.create({ data: ba });
    console.log('Bank account created:', account.bankName);

    // Add some transactions
    await prisma.bankTransaction.createMany({
      data: [
        { 
          operation: 'Retrait DAB', 
          details: `DAB ${account.bankName} ${account.agency}`, 
          reference: '#5454585', 
          amount: -1250, 
          bankAccountId: account.id 
        },
        { 
          operation: 'Virement Reçu', 
          details: 'Paiement Client XYZ', 
          reference: '#998877', 
          amount: 3250, 
          bankAccountId: account.id 
        },
        { 
          operation: 'Paiement Boutique', 
          details: 'Natilait Aouina', 
          reference: '#442211', 
          amount: -120, 
          bankAccountId: account.id 
        },
      ]
    });
  }

  console.log('Seed completed successfully!');
  console.log('Admin:', adminEmail, adminPassword);
  console.log('Comptables:', comptables.map(c => `${c.email}: ${c.password}`));
  console.log('Clients:', clients.map(c => `${c.email}: ${c.password}`));
  console.log('Collaborateurs:', collaborateurs.map(c => `${c.email}: ${c.password}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
