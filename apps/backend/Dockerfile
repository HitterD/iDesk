# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm ci

COPY apps/backend ./
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

# Install su-exec to safely drop privileges from root to node after fixing volume permissions
RUN apk add --no-cache su-exec

# Entrypoint script that ensures volume permissions then drops to node
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5050

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
