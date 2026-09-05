# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile -t reportflow-api .
#
# The runtime image carries the Prisma CLI so the entrypoint can run
# `prisma migrate deploy` on start. Set RUN_MIGRATIONS=false when a deploy job
# applies migrations instead (see .github/workflows/deploy-production.yml).

FROM node:22-bookworm-slim AS base
# OpenSSL is required by the Prisma query engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Only the manifests, so dependency layers cache independently of source changes.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# ---- production dependencies (shipped) -------------------------------------
FROM manifests AS prod-deps
RUN npm ci --workspace=apps/api --omit=dev \
 && npm cache clean --force

# ---- build (needs devDependencies) -----------------------------------------
FROM manifests AS build
RUN npm ci --workspace=apps/api
COPY apps/api ./apps/api
RUN npm run prisma:generate -w apps/api \
 && npm run build -w apps/api

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000
# Every COPY sets ownership directly; a `chown -R` here would duplicate the
# whole node_modules tree into a second image layer.
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json apps/api/
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# Prisma client generated during the build (schema-specific, plus engines).
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node apps/api/prisma ./apps/api/prisma
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
