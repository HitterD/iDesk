# Stage 1: Build
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm install

COPY . .

RUN npm run build --workspace=apps/frontend

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
