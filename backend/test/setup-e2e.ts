import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

// Charge les variables de .env.test avant le lancement des tests E2E
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

console.log('Initialisation de la base de données de test...');
try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
} catch (e) {
  console.error('Erreur lors de l\'initialisation de la DB de test:', e);
}
