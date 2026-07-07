# syntax=docker/dockerfile:1

# ---- build ----
# Debian slim (glibc) zodat better-sqlite3 een prebuilt binary vindt; build-tools
# staan er toch bij voor het geval er gecompileerd moet worden.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3008 \
    HOSTNAME=0.0.0.0

# Standalone-output: minimale server.js + getracede node_modules (incl. better-sqlite3).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# SQLite-bestand (data/dashboard.db) leeft hier; in compose een named volume.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3008
CMD ["node", "server.js"]
