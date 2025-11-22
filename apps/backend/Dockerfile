FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build backend
RUN npm run build --workspace=apps/backend

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "apps/backend/dist/main"]
