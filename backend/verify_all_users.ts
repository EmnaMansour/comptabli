import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const result = await prisma.user.updateMany({
    data: {
      emailVerifiedAt: new Date(),
      status: 'ACTIVE'
    }
  });
  console.log(`Updated ${result.count} users.`);
}

main().catch(console.error).finally(() => process.exit(0));
