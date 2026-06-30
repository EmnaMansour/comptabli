const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  console.log(JSON.stringify(admins, null, 2));
}

checkAdmins().catch(console.error).finally(() => prisma.$disconnect());
