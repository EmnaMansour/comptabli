require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing in .env');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("Connected to DB, querying...");

  const invoices = await prisma.invoice.findMany();
  let found = false;
  for (const inv of invoices) {
    if (inv.extractedData && inv.extractedData.includes('KIO')) {
      console.log('Found in Invoice ID:', inv.id);
      console.log('Document ID:', inv.documentId);
      console.log('Extracted Data:', inv.extractedData);
      found = true;
    }
  }

  const docs = await prisma.document.findMany();
  for (const doc of docs) {
    if (doc.extractedData && doc.extractedData.includes('KIO')) {
      console.log('Found in Document ID:', doc.id);
      console.log('Extracted Data:', doc.extractedData);
      found = true;
    }
  }

  if (!found) {
    console.log("No invoice or document in DB contains 'KIO'.");
  }

  await prisma.$disconnect();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
