<p align="center">
  <img src="Stylized Logotype for iDesk.png" alt="iDesk Logo" width="400"/>
</p>

<h1 align="center">iDesk - Enterprise IT Helpdesk System</h1>

<p align="center">
  <strong>Modern, Full-Stack IT Helpdesk & Ticketing Solution</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-documentation">API Docs</a>
</p>

---

## 📋 Overview

**iDesk** is a comprehensive IT helpdesk and ticketing system designed for enterprise environments. It provides a modern, intuitive interface for managing IT support tickets, knowledge base articles, contract renewals, and team communications with seamless Telegram integration.

## ✨ Features

### 🎫 Ticketing System
- **Multi-channel ticket creation** - Web portal, Telegram bot, or agent-created
- **Priority & SLA management** - Automatic SLA tracking with breach notifications
- **Real-time updates** - WebSocket-powered live ticket updates
- **Rich text messaging** - Support for file attachments and @mentions
- **Internal notes** - Private agent-only communication
- **Ticket assignment** - Manual or automatic agent assignment
- **Status workflow** - TODO → IN_PROGRESS → WAITING → RESOLVED → CLOSED
- **Bulk operations (ADMIN)** - Assign, change status, or soft-delete multiple tickets with "type-the-count" confirmation

### 📚 Knowledge Base
- **Article management** - Create, edit, and publish help articles
- **Categories & tags** - Organized content structure
- **Search functionality** - Full-text search across articles
- **View tracking** - Track article popularity and helpfulness
- **Visibility controls** - Public, internal, or private articles

### 🤖 Telegram Bot Integration
- **Create tickets** via Telegram chat
- **View ticket status** and history
- **Receive real-time notifications**
- **Two-way communication** between Telegram and helpdesk
- **Role-based menus** - Different interfaces for Users, Agents, and Admins

### 📊 Dashboard & Reports
- **Real-time statistics** - Ticket volumes, response times, SLA compliance
- **Agent performance** - Resolution rates, avg response time
- **Visual charts** - Interactive dashboards with Recharts
- **Export capabilities** - PDF and Excel report generation

### 📅 Contract Renewal Management
- **PDF contract parsing** - Automatic extraction of contract details
- **Expiry notifications** - 30/60/90 day alerts
- **Acknowledgment tracking** - Track renewal confirmations
- **Manual entry** - Support for non-parseable contracts

### ⚡ Automation Rules
- **Event-driven triggers** - On ticket create, update, SLA breach
- **Automatic actions** - Assignment, priority changes, notifications
- **Configurable rules** - Condition-based automation

### 🔔 Notification System
- **Multi-channel notifications** - In-app, email, Telegram
- **Push notifications** - Browser push support (PWA)
- **Digest emails** - Daily/weekly summary options
- **Read/unread tracking**

### 👥 User Management
- **Role-based access** - Admin, Agent, User roles
- **Department organization**
- **User import** - Bulk import via CSV
- **Avatar management**

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **NestJS 10** | Server framework with modular architecture |
| **TypeORM** | Database ORM with PostgreSQL |
| **Socket.IO** | Real-time WebSocket communication |
| **Passport JWT** | Authentication & authorization |
| **Telegraf** | Telegram bot framework |
| **Bull** | Redis-backed job queues |
| **Swagger** | API documentation |
| **PDFKit** | PDF generation for reports |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI library with TypeScript |
| **Vite** | Fast build tool & dev server |
| **TailwindCSS** | Utility-first styling |
| **Radix UI** | Accessible component primitives |
| **TanStack Query** | Server state management |
| **Zustand** | Client state management |
| **Framer Motion** | Animations |
| **Recharts** | Data visualization |
| **Socket.IO Client** | Real-time updates |
| **React Hook Form + Zod** | Form handling & validation |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Redis** | Caching & job queues |
| **Docker** | Containerization |

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18 or higher
- **Docker** & Docker Compose
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HitterD/iDesk.git
   cd iDesk
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start database services**
   ```bash
   # Windows
   deploy_database_docker.bat
   
   # Or using Docker Compose
   docker-compose -f docker-compose.db.yml up -d
   ```

4. **Install dependencies**
   ```bash
   npm run install:all
   ```

5. **Start development servers**
   ```bash
   # Windows one-click
   startup.bat
   
   # Or cross-platform
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:4050
   - Backend API: http://localhost:5050
   - Swagger Docs: http://localhost:5050/api

### Default Credentials
After seeding, use these credentials:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@idesk.com | admin123 |
| Agent | agent@idesk.com | agent123 |
| User | user@idesk.com | user123 |

## 📁 Project Structure

```
iDesk/
├── apps/
│   ├── backend/                 # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/         # Feature modules
│   │   │   │   ├── auth/        # Authentication & JWT
│   │   │   │   ├── ticketing/   # Ticket management
│   │   │   │   ├── telegram/    # Telegram bot integration
│   │   │   │   ├── knowledge-base/
│   │   │   │   ├── notifications/
│   │   │   │   ├── reports/
│   │   │   │   ├── renewal/     # Contract management
│   │   │   │   ├── automation/  # Rule-based automation
│   │   │   │   ├── users/
│   │   │   │   ├── search/
│   │   │   │   ├── sla-config/
│   │   │   │   └── ...
│   │   │   ├── shared/          # Shared utilities
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── frontend/                # React/Vite Frontend
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── features/        # Feature modules
│       │   │   ├── ticket-board/
│       │   │   ├── dashboard/
│       │   │   ├── knowledge-base/
│       │   │   ├── reports/
│       │   │   ├── settings/
│       │   │   └── ...
│       │   ├── hooks/           # Custom React hooks
│       │   ├── stores/          # Zustand state stores
│       │   └── lib/             # Utilities & API client
│       └── package.json
│
├── docker-compose.yml           # Full stack deployment
├── docker-compose.db.yml        # Database only
├── startup.bat                  # Windows quick start
├── dev.bat                      # Development utilities
└── package.json                 # Monorepo root
```

## 📖 API Documentation

Interactive API documentation is available via Swagger UI at:
```
http://localhost:5050/api
```

### Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | User authentication |
| `GET /tickets` | List tickets with filters |
| `POST /tickets` | Create new ticket |
| `DELETE /tickets/bulk` | Bulk soft-delete (ADMIN only) — requires type-the-count confirmation |
| `GET /kb/articles` | List knowledge base articles |
| `GET /reports/monthly` | Monthly statistics |
| `POST /telegram/webhook` | Telegram bot webhook |

## ⚙️ Configuration

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=idesk_db

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=60m  # Role-based: Admin/Agent=3h, User=1h

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_USE_WEBHOOK=false

# Redis (optional)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_USER=your-email
SMTP_PASS=your-password
```

## 🔐 Security Features

- **JWT Authentication** with role-based expiration
- **Password hashing** with bcrypt
- **Rate limiting** on critical endpoints
- **Helmet** for HTTP security headers
- **Input validation** with class-validator
- **File upload validation** with magic bytes check
- **CORS protection**

## 🧪 Testing

```bash
# Backend unit tests
cd apps/backend
npm run test

# Backend e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start both backend & frontend |
| `npm run install:all` | Install all dependencies |
| `startup.bat` | Windows one-click startup |
| `dev.bat` | Development utilities |
| `backup_db.bat` | Backup PostgreSQL database |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

---

## ⚙️ Environment variables required in production

Below is the complete reference of environment variables read by the backend, their production requirement level, and the impact if missing:

| Variable | Required? | What breaks if missing / unset |
|---|---|---|
| `JWT_SECRET` | **Yes (Fatal)** | Application crashes on boot (`JWT_SECRET must be set and at least 32 characters`). |
| `ENCRYPTION_KEY` | **Yes (Fatal)** | Symmetric credential cipher fails on startup (requires 64-char hex key). |
| `EFORM_ENCRYPTION_KEY` | **Yes (Fatal)** | E-form encryption cipher fails on startup (requires 64-char hex key). |
| `COOKIE_SECURE` | **Yes (Prod)** | Auth cookies (`access_token`, `refresh_token`) lack the `Secure` flag and travel in plaintext; Helmet HSTS is disabled. Set to `true` in production. |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | **Yes (Fatal)** | PostgreSQL database connection fails; TypeORM cannot initialize. |
| `DB_SYNCHRONIZE` | **Yes (Prod)** | Must be `false` in production. Setting `true` in production throws a startup error to prevent destructive schema changes. |
| `FRONTEND_URL` | **Yes** | CORS origin validation fails; browser requests from the frontend client are blocked. |
| `WS_CORS_ORIGIN` | **Yes** | WebSocket gateway rejects incoming real-time ticket/hardware connections. |
| `REDIS_PASSWORD` | **Yes (Docker)** | Docker Compose and Redis container fail fast on boot if empty. |
| `AUTH_REFRESH_SESSION_MODE` | Optional | Refresh session storage mode (`legacy`, `dual`, `redis`). Setting `redis`/`dual` without `REDIS_ENABLED=true` crashes boot. Defaults to `legacy`. |
| `AUTH_LEGACY_REFRESH_DROP` | Optional | Safety gate for migration `1785000001000`. Migration skips dropping legacy `refreshToken` column unless set to `confirmed`. |
| `DB_POOL_MIN`, `DB_POOL_MAX` | Optional | Database connection pool bounds. Falls back to 2 min / 10 max (or 5/20 in TypeORM). |
| `SLOW_QUERY_THRESHOLD_MS` | Optional | Query logger threshold for slow query warnings. Falls back to `1000` ms. |
| `TRUSTED_PROXY_COUNT` | Optional (Reverse Proxy) | Number of trusted reverse proxy hops for HTTP rate limiting (`client-ip.ts`). **Critical two-sided operational impact:** (1) If unset or `0` behind a reverse proxy, `X-Forwarded-For` is ignored and socket IP is used, so all users resolve to the proxy IP and share ONE rate-limit bucket (throttling legitimate users); (2) If set too high, clients can forge `X-Forwarded-For` entries and evade rate limiting (e.g. login brute-force). **Rule for choosing N:** Set N to the exact count of trusted reverse proxies in front of the backend (e.g. `1` for a single Nginx reverse proxy, `2` for Cloudflare in front of Nginx). |
| `TRUST_PROXY` | Optional (WebSocket) | Set to `'true'` only when the backend sits behind a trusted reverse proxy that always overwrites `X-Forwarded-For` (e.g. bundled Nginx). Enables real client IP extraction for WebSocket gateway rate limiting (`events.gateway.ts`). Leave unset if directly exposed. |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Optional | Rate limiter threshold. Falls back to 100 requests per 60,000 ms. |
| `PAGE_ACCESS_CACHE_TTL`, `PAGE_ACCESS_MAX_DENIALS`, `PAGE_ACCESS_LOCKOUT_MINUTES` | Optional | Page access security lockout thresholds. Falls back to 300s cache / 10 denials / 15 min lockout. |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot polling and messaging features cannot initialize. |
| `TELEGRAM_USE_WEBHOOK`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_DOMAIN`, `TELEGRAM_WEBHOOK_PATH` | Optional | Required if `TELEGRAM_USE_WEBHOOK=true`. Webhook updates fail signature verification if secret is missing. |
| `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `CACHE_TTL` | Optional | Falls back to in-memory cache and synchronous execution instead of Bull Redis queue. Cache TTL defaults to `300`s. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | Optional | Email notifications cannot be delivered. Initial values seed database email settings on first boot. |
| `SLA_ADMIN_EMAIL` | Optional | SLA breach escalation alerts fall back to `admin@idesk.com`. |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Optional | Server-to-Server OAuth Zoom meeting generation fails with unconfigured adapter warning. |
| `ZOOM_WEBHOOK_SECRET` | Optional | Incoming Zoom webhook events fail HMAC SHA256 signature verification. |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_ID`, `OUTLOOK_CLIENT_ID` | Optional | Google Calendar / Outlook synchronization for Zoom bookings is disabled. |
| `HRIS_GATEWAY_BASE_URL`, `HRIS_GATEWAY_API_KEY`, `HRIS_GATEWAY_TIMEOUT_MS` | Optional | External NIK employee verification fails. Timeout defaults to `10000` ms. |
| `HRIS_LOGIN_VERIFY_ENABLED` | Optional | If `false`, bypasses HRIS password check (development escape hatch only). Must be `true` in production. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional | Web push notifications to browser service workers cannot be signed and fail to send. |
| `GOOGLE_CREDENTIALS_PATH` | Optional | Google Sheets synchronization service cannot authenticate with Google Cloud. |
| `BACKUP_ENCRYPTION_KEY`, `DB_DOCKER_CONTAINER`, `PG_DUMP_PATH` | Optional | Synology backup utility falls back to default key (`idesk-backup-key-32chars!!`) and container `idesk-postgres`. |
| `SEED_ADMIN_PASSWORD`, `SEED_DEFAULT_PASSWORD` | Optional (Setup) | Initial database seed scripts (`seed.ts` / `initial-seed.ts`) fail if unset or shorter than 12 characters. |

---

## 🚀 Pre-Deploy Database Backup & Migration Runbook

In production (`NODE_ENV=production`), `apps/backend/src/app.module.ts:159` sets `migrationsRun: true`. The backend automatically applies all pending TypeORM database migrations on application startup.

> [!WARNING]
> **MANDATORY SAFETY STEP:** To prevent unrecoverable schema corruption from a mid-migration failure, an immediate database backup is mandatory **before** starting the backend for the first time or deploying a new release.

Follow these 5 numbered steps in order:

### 1. Run the database backup before first start

Ensure the database container (`idesk-postgres`) is running (`docker compose up -d postgres` or `docker-compose -f docker-compose.db.yml up -d`).

**Windows (using `backup_db.bat`):**
```cmd
backup_db.bat
```
*(Alternatively, run `deploy_database_docker.bat` and choose option `[4] Backup Only`).*

**Cross-Platform / Linux (using Docker volume tar and pg_dump):**
```bash
# 1. Volume tar archive (mirrors backup_db.bat)
mkdir -p backups
docker run --rm --volumes-from idesk-postgres -v "$(pwd)/backups:/backup" ubuntu tar cvf "/backup/postgres_backup_$(date +%Y%m%d_%H%M%S).tar" /var/lib/postgresql/data

# 2. Standalone custom archive dump (recommended dual-backup)
docker exec -t idesk-postgres pg_dump -U postgres -d idesk_db -F c -b -v > "backups/idesk_db_backup_$(date +%Y%m%d_%H%M%S).dump"
```
*(Note: Database host for host-side tooling is `127.0.0.1` on port `5432` or `5454` per `.env`).*

### 2. Verify backup file exists and is non-empty

Verify that the backup archive file exists in `backups/` and is non-empty before starting the application:

**Windows (PowerShell):**
```powershell
Get-ChildItem -Path backups -Filter postgres_backup_*.tar | Select-Object Name, Length, LastWriteTime
```

**Windows (Command Prompt):**
```cmd
dir backups\postgres_backup_*.tar
```

**Linux / macOS:**
```bash
ls -lh backups/postgres_backup_*.tar backups/*.dump
```

> [!IMPORTANT]
> Confirm the file size is greater than 0 bytes. Do not proceed with deployment if the backup file is empty or failed to generate.

### 3. Start the backend and watch migrations apply

Start the backend container or process in production mode (`NODE_ENV=production`):

**Docker Compose (Production Full Stack):**
```bash
docker compose up -d backend
```

**Standalone Node process (from `apps/backend`):**
```bash
cd apps/backend
npm run start:prod
```

**Monitor migration progress in real-time:**
```bash
docker logs -f idesk-backend
```

**Expected successful output:**
- Successful migration logs:
  ```text
  [Nest] ... LOG [TypeORM] Migration: 1785000001000-DropLegacyRefreshTokenColumn has been executed successfully.
  ```
  *(Or `[Nest] ... LOG [TypeORM] Migration: No migrations to run.` if schema is already up to date)*
- Successful application start:
  ```text
  [Nest] ... LOG [NestApplication] Nest application successfully started
  ```
- Readiness probe check:
  ```bash
  curl -isS http://127.0.0.1:5050/v1/health/ready
  ```
  *(Returns `HTTP/1.1 200 OK`)*

### 4. How to tell if a migration failed

If a migration fails during backend startup:

1. **Container crashes or exits on boot:**
   ```bash
   docker ps -a --filter "name=idesk-backend"
   # Container shows status: Exited (1)
   ```
2. **Error in application logs:**
   ```text
   [Nest] ... ERROR [TypeORM] {"message":"QUERY_ERROR","error":"relation \"...\" already exists",...}
   [Nest] ... ERROR [TypeOrmModule] Unable to run migrations!
   ```
3. **Health check fails or refuses connection:**
   ```bash
   curl -isS http://127.0.0.1:5050/v1/health/ready
   # Returns 503 Service Unavailable or Connection Refused
   ```
4. **Check unapplied migrations via TypeORM CLI:**
   ```bash
   cd apps/backend
   npm run migration:show
   # Shows [X] for applied migrations and [ ] for failed / pending migrations
   ```

### 5. How to restore from backup if migration failed

If a migration failed and left the database in an inconsistent state, restore the database:

#### Method A: Interactive Restore Tool (Windows `deploy_database_docker.bat`)
1. Run `deploy_database_docker.bat`.
2. Select menu option `[5] Restore from Backup`.
3. Enter the filename of the PostgreSQL backup archive (e.g. `postgres_backup_20260902_000839.tar`).

#### Method B: Manual Volume Restore from `.tar` Archive
1. Stop the application and database containers:
   ```bash
   docker compose stop backend idesk-postgres
   ```
2. Extract the backup tar into the PostgreSQL data directory (`backups/postgres`):
   ```bash
   # Windows (CMD / PowerShell)
   docker run --rm -v "%cd%\backups:/backup" -v "%cd%\backups\postgres:/restore" ubuntu bash -c "rm -rf /restore/* && cd /restore && tar xvf /backup/<YOUR_POSTGRES_BACKUP_FILE>.tar --strip-components=4"

   # Linux / macOS
   docker run --rm -v "$(pwd)/backups:/backup" -v "$(pwd)/backups/postgres:/restore" ubuntu bash -c "rm -rf /restore/* && cd /restore && tar xvf /backup/<YOUR_POSTGRES_BACKUP_FILE>.tar --strip-components=4"
   ```
3. Restart database container and verify readiness:
   ```bash
   docker compose up -d postgres
   docker exec idesk-postgres pg_isready -U postgres
   ```

#### Method C: Manual Restore via `pg_restore` or `psql` (Dump Files)
If you created a `pg_dump` file in Step 1:
```bash
# Custom format (.dump) restore
docker exec -i idesk-postgres pg_restore -U postgres -d idesk_db --clean --if-exists < backups/idesk_db_backup_<TIMESTAMP>.dump

# Plain SQL (.sql) restore
docker exec -i idesk-postgres psql -U postgres -d idesk_db < backups/idesk_db_backup_<TIMESTAMP>.sql
```

#### Method D: Revert Single Migration (Transactional Clean Rollbacks Only)
If the database schema is intact and only the last successful migration step needs rollback:
```bash
cd apps/backend
npm run migration:revert
```



