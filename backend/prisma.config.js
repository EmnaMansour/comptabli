const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.cjs',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:admin@postgres:5432/Comptabli?schema=public',
  },
});
