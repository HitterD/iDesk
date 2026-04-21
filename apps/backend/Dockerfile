# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm ci

COPY apps/backend ./
# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Security M10: Run as non-root user to prevent privilege escalation
USER node
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist

# Install only production dependencies to reduce image bloat
RUN npm ci --only=production

EXPOSE 3001

CMD ["node", "dist/main"]
