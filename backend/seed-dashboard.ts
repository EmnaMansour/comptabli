import { PrismaClient, Status, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Pro Dashboard Data...');

  // 1. Find the accountant user (likely Emna, or simply the first COMPTABLE)
  const accountant = await prisma.user.findFirst({
    where: { role: Role.COMPTABLE },
  });

  if (!accountant) {
    console.error('No accountant found. Cannot run script.');
    return;
  }

  console.log(`Populating dashboard for Accountant: ${accountant.firstName} ${accountant.lastName}`);

  // 2. Make sure we have some clients connected to this accountant
  let clients = await prisma.accountantClient.findMany({
    where: { accountantId: accountant.id },
    include: { client: true },
  });

  if (clients.length === 0) {
    // Attempt to connect random clients to this accountant
    const randomClients = await prisma.user.findMany({
      where: { role: Role.CLIENT },
      take: 5
    });

    for (const c of randomClients) {
      await prisma.accountantClient.create({
        data: {
          accountantId: accountant.id,
          clientId: c.id
        }
      });
    }
    clients = await prisma.accountantClient.findMany({
      where: { accountantId: accountant.id },
      include: { client: true },
    });
  }

  if (clients.length === 0) {
     console.error('No clients found in the database. Please create a client from the interface first.');
     return;
  }

  const client1 = clients[0].client;

  // 3. Create Documents & Invoices (To generate Revenue + "Factures à traiter" = Pending Invoices)
  // Let's create 8 completed invoices to show beautiful revenue bar charts!
  const months = [1, 2, 3, 4, 5, 0]; // Recent months offset
  for (let i = 0; i < 15; i++) {
    const isPending = i < 7; // We will leave 7 invoices 'Pending' to show on dashboard "Factures à traiter"
    const randomAmount = Math.floor(Math.random() * 5000) + 500;
    
    let simulatedDate = new Date();
    simulatedDate.setMonth(simulatedDate.getMonth() - Math.floor(Math.random() * 5));

    await prisma.document.create({
      data: {
        name: `Facture_00${i}.pdf`,
        type: 'application/pdf',
        size: 250000,
        url: `https://dummy/facture_${i}.pdf`,
        status: isPending ? Status.PENDING : Status.VALIDATED,
        clientId: client1.id,
        accountantId: accountant.id,
        category: 'Facture Fournisseur',
        invoices: {
          create: {
            vendorName: `Fournisseur Pro ${i}`,
            invoiceNumber: `F2026-${100+i}`,
            totalAmount: randomAmount,
            status: isPending ? Status.PENDING : Status.VALIDATED,
            invoiceDate: simulatedDate,
          }
        }
      }
    });
  }
  
  // 4. Create "Demandes en attente" (Requests)
  for (let i = 0; i < 4; i++) {
    await prisma.request.create({
      data: {
        clientId: client1.id,
        accountantId: accountant.id,
        type: 'Conseil',
        description: `Besoin d'un accompagnement pour investissement ${i}`,
        status: Status.PENDING,
        urgency: i % 2 === 0 ? 'HIGH' : 'NORMAL',
      }
    });
  }

  // 5. Create "Rendez-vous aujourd'hui" (Meetings specific to TODAY)
  const today = new Date();
  today.setHours(14, 0, 0, 0); // At 14:00 today
  await prisma.meeting.create({
    data: {
      title: "Synthèse Mensuelle - Bilan Général",
      type: "VISIO",
      status: Status.ACTIVE,
      scheduledAt: today,
      duration: 60,
      clientId: client1.id,
      accountantId: accountant.id,
    }
  });

  today.setHours(16, 30, 0, 0); // At 16:30 today
  await prisma.meeting.create({
    data: {
      title: "Consultation Fiscale & Déclaration",
      type: "PRESENTIEL",
      status: Status.ACTIVE,
      scheduledAt: today,
      duration: 30,
      clientId: client1.id,
      accountantId: accountant.id,
    }
  });

  // 6. Upcoming Tasks
  const org = await prisma.organization.findFirst();
  if (org) {
     const nextWeek = new Date();
     nextWeek.setDate(nextWeek.getDate() + 4);
     await prisma.task.create({
       data: {
         title: "Clôture exercice fiscal",
         priority: "HIGH",
         status: Status.PENDING,
         deadline: nextWeek,
         organizationId: org.id,
         createdBy: accountant.id,
         assignees: { connect: { id: accountant.id } }
       }
     });
     
     await prisma.task.create({
       data: {
         title: "Récupération relevés bancaires",
         priority: "MEDIUM",
         status: Status.ACTIVE,
         deadline: new Date(),
         organizationId: org.id,
         createdBy: accountant.id,
         assignees: { connect: { id: accountant.id } }
       }
     });
  }

  console.log('✅ Dashboard Data Successfully Seeded! Go check your UI!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
