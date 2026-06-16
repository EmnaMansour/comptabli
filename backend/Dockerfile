# ── STAGE 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de package
COPY package*.json ./

# Installer toutes les dépendances (y compris devDependencies pour le build)
RUN npm install

# Copier le code source
COPY . .

# Générer le client Prisma (nécessaire pour que TypeScript connaisse les modèles)
# Une URL factice suffit pour la génération du code
RUN DATABASE_URL="postgresql://comptabli:comptabli_pass@postgres:5432/comptabli_db" npx prisma generate

# Compiler TypeScript vers ./dist
RUN npm run build && ls -R dist

# ── STAGE 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Définir l'environnement en production
ENV NODE_ENV=production

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nestuser

# Copier les dépendances et le build depuis le stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copier le dossier prisma et le fichier de config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.js ./

# Copier les assets (incluant le logo)
COPY --from=builder /app/assets ./assets

# Donner les permissions à l'utilisateur
RUN chown -R nestuser:nodejs /app

USER nestuser

EXPOSE 3000

# Lancer les migrations puis l'application
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
