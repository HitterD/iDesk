# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm ci

COPY apps/backend ./
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist

# Install only production dependencies to reduce image bloat
RUN npm ci --only=production

# Install runtime utilities: su-exec, postgresql-client (providing pg_dump and psql), tar, and bash
RUN apk add --no-cache su-exec postgresql-client tar bash

# Create application runtime directories and ensure node ownership
RUN mkdir -p /app/reports /app/storage/nas-cache /app/uploads /app/backups/database /app/backups/files /app/backups/temp && chown -R node:node /app

# Company TLS: ipop.santos.co.id (and other internal hosts) use certificates from the internal SJA-ROOT-CA, which
# Node does not trust by default. Public certificate only; without it every call to iPop (Sign in with iPop, webhooks)
# fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
COPY apps/backend/certs/sja-root-ca.pem /usr/local/share/ca-certificates/sja-root-ca.pem
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/sja-root-ca.pem

# Entrypoint script that ensures volume permissions then drops to node
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5050

HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 5050) + '/v1/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
