import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Début du script de mise à jour des dossiers ---');
  
  // 1. Récupérer tous les clients
  const clients = await prisma.user.findMany({
    where: { role: Role.CLIENT }
  });

  console.log(`Nombre total de clients trouvés : ${clients.length}`);

  let updatedCount = 0;

  for (const client of clients) {
    // 2. Vérifier s'ils ont déjà des dossiers
    const folderCount = await prisma.folder.count({
      where: { clientId: client.id }
    });

    if (folderCount === 0) {
      console.log(`- Le client ${client.id} (${client.companyName || client.firstName}) n'a pas de dossier. Création en cours...`);
      
      const defaultFolders = ['Achat', 'Op.diverses', 'Caisse', 'Vente', 'Banque'];
      
      for (const name of defaultFolders) {
        await prisma.folder.create({
          data: {
            name,
            clientId: client.id,
          }
        });
      }
      
      console.log(`  -> 5 dossiers ajoutés avec succès.`);
      updatedCount++;
    } else {
      console.log(`- Le client ${client.id} a déjà ${folderCount} dossier(s). On ignore.`);
    }
  }

  console.log('--- Fin du script ---');
  console.log(`Total de clients mis à jour : ${updatedCount}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
