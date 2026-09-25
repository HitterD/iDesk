# Stage 1: Build
FROM node:20-alpine as builder

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
FROM nginx:1.25-alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
