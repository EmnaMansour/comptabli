require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: 'postgresql://postgres:admin@localhost:5432/Comptabli?schema=public' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log("Current admins before deletion:", admins.map(a => a.email));

  const deleteResult = await prisma.user.deleteMany({
    where: {
      role: 'ADMIN',
      email: {
        not: 'admin@gmail.com'
      }
    }
  });
  console.log(`Deleted ${deleteResult.count} admin(s).`);

  const adminsAfter = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log("Current admins after deletion:", adminsAfter.map(a => a.email));
}
main().finally(() => prisma.$disconnect());
