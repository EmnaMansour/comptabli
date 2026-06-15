const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Pro Dashboard Data...');
  const accountant = await prisma.user.findFirst({ where: { role: 'COMPTABLE' } });
  if (!accountant) return;

  const clients = await prisma.accountantClient.findMany({
    where: { accountantId: accountant.id },
    include: { client: true },
  });
  if (clients.length === 0) return;
  const client1 = clients[0].client;

  for (let i = 0; i < 15; i++) {
    const isPending = i < 7;
    const randomAmount = Math.floor(Math.random() * 5000) + 500;
    let simulatedDate = new Date();
    simulatedDate.setMonth(simulatedDate.getMonth() - Math.floor(Math.random() * 5));

    await prisma.document.create({
      data: {
        name: `Facture_00${i}.pdf`,
        type: 'application/pdf',
        size: 250000,
        url: `https://dummy/facture_${i}.pdf`,
        status: isPending ? 'PENDING' : 'VALIDATED',
        clientId: client1.id,
        accountantId: accountant.id,
        category: 'Facture Fournisseur',
        invoices: {
          create: {
            vendorName: `Fournisseur Pro ${i}`,
            invoiceNumber: `F2026-${100+i}`,
            totalAmount: randomAmount,
            status: isPending ? 'PENDING' : 'VALIDATED',
            invoiceDate: simulatedDate,
          }
        }
      }
    });
  }

  for (let i = 0; i < 4; i++) {
    await prisma.request.create({
      data: {
        clientId: client1.id,
        accountantId: accountant.id,
        type: 'Conseil',
        description: `Besoin d'un accompagnement pour investissement ${i}`,
        status: 'PENDING',
        urgency: i % 2 === 0 ? 'HIGH' : 'NORMAL',
      }
    });
  }

  const today1 = new Date(); today1.setHours(14, 0, 0, 0);
  await prisma.meeting.create({
    data: { title: "Synthèse Mensuelle", type: "VISIO", status: 'ACTIVE', scheduledAt: today1, duration: 60, clientId: client1.id, accountantId: accountant.id }
  });

  const today2 = new Date(); today2.setHours(16, 30, 0, 0);
  await prisma.meeting.create({
    data: { title: "Consultation Fiscale", type: "PRESENTIEL", status: 'ACTIVE', scheduledAt: today2, duration: 30, clientId: client1.id, accountantId: accountant.id }
  });

  console.log('✅ Dashboard Data Successfully Seeded! Go check your UI!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
