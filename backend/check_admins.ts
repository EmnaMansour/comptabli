import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  console.log("Found admins:");
  console.log(admins);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
