# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

COPY apps/frontend/package*.json ./apps/frontend/
RUN npm ci --prefix apps/frontend

COPY apps/frontend ./apps/frontend

ARG VITE_API_URL=
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build the application
RUN npm run build --prefix apps/frontend

# Stage 2: Serve
FROM nginx:1.28-alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
