import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_FOLDERS = ['Vente', 'Achat', 'Banque', 'Caisse', 'Op.diverses'];

async function main() {
  // Find all CLIENT users
  const clients = await prisma.user.findMany({
    where: { role: Role.CLIENT },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(`Found ${clients.length} clients. Adding default folders...`);

  for (const client of clients) {
    // Check which default folders already exist for this client
    const existingFolders = await prisma.folder.findMany({
      where: {
        clientId: client.id,
        parentId: null,
        name: { in: DEFAULT_FOLDERS },
      },
      select: { name: true },
    });

    const existingNames = new Set(existingFolders.map((f) => f.name));
    const missingFolders = DEFAULT_FOLDERS.filter((name) => !existingNames.has(name));

    if (missingFolders.length === 0) {
      console.log(`  ✓ ${client.firstName} ${client.lastName} — all folders exist`);
      continue;
    }

    await prisma.folder.createMany({
      data: missingFolders.map((name) => ({
        name,
        clientId: client.id,
        parentId: null,
      })),
    });

    console.log(
      `  + ${client.firstName} ${client.lastName} — created: ${missingFolders.join(', ')}`,
    );
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
