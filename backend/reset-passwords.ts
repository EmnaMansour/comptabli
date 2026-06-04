import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 12);
  const res = await prisma.user.updateMany({
    data: { password: hash, status: 'VALIDATED' }
  });
  console.log('Updated users:', res.count);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
