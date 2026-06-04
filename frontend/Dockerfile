# ── STAGE 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build pour la production (Vite génère le dossier dist)
RUN npm run build

# ── STAGE 2: Runner (Nginx) ───────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Nettoyer les fichiers par défaut de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copier les fichiers statiques buildés depuis le stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier notre configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
