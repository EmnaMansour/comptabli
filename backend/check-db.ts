import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Fetching all invoices...");
  const invoices = await prisma.invoice.findMany({
    include: {
      document: {
        include: {
          client: {
            include: {
              accountantClients: true
            }
          }
        }
      }
    }
  });

  for (const inv of invoices) {
    console.log(`Invoice ${inv.id}: status=${inv.status}`);
    console.log(`-> Document ${inv.documentId}: status=${inv.document.status}, clientId=${inv.document.clientId}`);
    console.log(`-> Client accountants: ${JSON.stringify(inv.document.client.accountantClients)}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
