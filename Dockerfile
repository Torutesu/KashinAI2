# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# System tools some collectors/actions rely on (optional; server warns if absent).
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
