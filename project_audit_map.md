# iDesk Project Audit — Peta Faktual (v2)

> Tanggal scan: 2026-04-30 | Branch: current HEAD (46 total commits)
> Update: Enriched dengan jawaban user + verifikasi .env

---

## 1. Stack & Arsitektur

### Bahasa & Runtime

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Bahasa | TypeScript | ~5.9.3 |
| Backend Runtime | Node.js (NestJS) | NestJS ^11.1.11 |
| Frontend Framework | React + Vite | React ^19.2.3, Vite ^7.3.0 |
| Desktop Notifier | Electron + React | Electron ^39.2.7 (tahap dev, belum deployed) |
| Database | PostgreSQL | 15-alpine (Docker) |
| Cache/Queue | Redis + Bull | Redis 7-alpine, Bull ^4.12.2 (**Redis disabled di dev**) |
| ORM | TypeORM | ^0.3.28 |
| CSS Framework | TailwindCSS | v4.1.18 |
| State Management | Zustand | ^5.0.8 |
| Data Fetching | TanStack React Query | ^5.99.0 |

### Struktur Folder Utama

```
iDesk-main/
├── apps/
│   ├── backend/        ← NestJS API server (listen :5050, .env PORT=3001 — mismatch)
│   │   └── src/
│   │       ├── main.ts           ← Bootstrap, middleware, Swagger
│   │       ├── app.module.ts     ← Root module (29 feature modules)
│   │       ├── modules/          ← 29 domain modules
│   │       ├── shared/           ← Core (guards, filters, interceptors), Queue, Upload
│   │       ├── migrations/       ← 29 TypeORM migrations
│   │       ├── seeds/            ← DB seeding scripts
│   │       └── tests/            ← Integration tests (manual API)
│   │
│   ├── frontend/       ← React SPA (Vite)
│   │   └── src/
│   │       ├── features/         ← 19 feature modules (domain-driven)
│   │       ├── components/       ← Shared UI (layout, auth, dashboard, notifications, ui)
│   │       ├── hooks/            ← 20 shared hooks
│   │       ├── lib/              ← Utilities, API client, constants
│   │       ├── stores/           ← Zustand (1 file: useAuth)
│   │       ├── types/            ← Shared type definitions (4 file)
│   │       ├── routes/           ← AppRoutes.tsx (single file, 309 lines)
│   │       └── styles/           ← CSS modules
│   │
│   └── desktop-notifier/ ← Electron tray app (belum digunakan)
│
├── startup.bat          ← Dev startup (auto-detect IP, start BE+FE, open browser)
├── deploy_database_docker.bat ← DB deployment tool (fresh/migrate/backup/restore)
├── docker-compose.yml   ← Full stack (Postgres + Redis + Backend + Frontend)
├── docker-compose.db.yml← DB-only compose (yang aktif dipakai)
└── package.json         ← Root monorepo (concurrently)
```

### Tanggung Jawab per Backend Module

| Module | Fungsi |
|--------|--------|
| `auth` | JWT authentication, login, session |
| `users` | User CRUD, department management |
| `ticketing` | Core ticketing (CRUD, SLA, messages, surveys, templates) |
| `notifications` | Multi-channel notification (in-app, email, push, telegram) |
| `telegram` | Telegram bot integration (**ditinggalkan, belum dihapus**) |
| `reports` | Reporting & PDF generation |
| `knowledge-base` | KB articles CRUD |
| `renewal` | Contract renewal tracking |
| `automation` | Workflow rules engine |
| `zoom-booking` | Zoom meeting booking calendar |
| `hardware-request` | Hardware request lifecycle (DDD-style, paling mature) |
| `eform-request` | E-Form request/approval flow |
| `permissions` | Feature-level access control |
| `google-sync` | Google Spreadsheet sync |
| `vpn-access` | VPN access tracking |
| `lost-item` | Lost & found item reporting |
| `access-request` | Access request management |
| `workload` | Agent workload balancing |
| `audit` | Audit logging |
| `health` | System health monitoring (belum maksimal) |
| `search` | Full-text search |
| `settings` | System settings, file cleanup |
| `sites` | Multi-site management |
| `sla-config` | SLA & business hours config |
| `sound` | Notification sounds |
| `synology` | Synology backup integration |
| `ip-whitelist` | IP whitelist management |
| `manager` | Manager dashboard |
| `uploads` | File upload handling |

### Dependency Outdated (>1 tahun)

| Package | Versi Saat Ini | Catatan |
|---------|----------------|---------|
| `passport-local` | ^1.0.0 | Last publish 2016 |
| `pdf-parse` | ^1.1.1 | Last publish 2019, unmaintained |
| `source-map-support` | ^0.5.21 | Not updated since 2022 |
| `supertest` | ^6.3.3 | v7 sudah rilis |
| `@typescript-eslint/*` | ^6.0.0 | v8 sudah rilis |
| `eslint` (backend) | ^8.42.0 | v9 sudah rilis |
| `xlsx` | ^0.18.5 | SheetJS CE — terakhir update 2023, license concerns |

### Build/Deploy Tooling

- **Deployment saat ini:** Dev server saja — Postgres & Redis via Docker, FE & BE via cmd (startup.bat)
- **Backend:** NestJS CLI (`nest build`), `ts-node` untuk migrations/seeds
- **Frontend:** Vite dev server, PostCSS + TailwindCSS
- **Database tool:** `deploy_database_docker.bat` — 6 mode (fresh install, server migration, update/restart, backup, restore, migrations only)
- **API Docs:** Swagger (auto-generated via `@nestjs/swagger`) di `/api/docs`
- **Monitoring:** Tidak ada external monitoring. Hanya SystemHealthPage di web UI

---

## 2. Inventori Kode

### Total File & Lines of Code

| Area | Source Files | Test Files | Total LOC (source) |
|------|-------------|------------|---------------------|
| Backend (`apps/backend/src`) | 515 | 35 | ~51,254 |
| Frontend (`apps/frontend/src`) | 487 | 25 | ~77,672 |
| Desktop Notifier | 13 | 0 | ~1,500 (estimasi) |
| CSS (frontend) | 12 | — | ~3,541 |
| **Total** | **~1,027** | **60** | **~133,967** |

### Top 10 File Terbesar

| # | File | LOC |
|---|------|-----|
| 1 | `backend/modules/telegram/telegram.update.ts` | 1,641 |
| 2 | `frontend/features/admin/pages/BentoAdminAgentsPage.tsx` | 1,436 |
| 3 | `frontend/features/client/pages/BentoCreateTicketPage.tsx` | 1,196 |
| 4 | `backend/modules/telegram/telegram.service.ts` | 1,001 |
| 5 | `backend/modules/zoom-booking/services/zoom-booking.service.ts` | 993 |
| 6 | `backend/modules/users/users.service.ts` | 927 |
| 7 | `frontend/features/reports/pages/BentoReportsPage.tsx` | 917 |
| 8 | `frontend/features/ticket-board/components/BentoTicketKanban.tsx` | 906 |
| 9 | `frontend/features/dashboard/pages/BentoDashboardPage.tsx` | 867 |
| 10 | `backend/modules/permissions/permissions.service.ts` | 759 |

### File >300 LOC (Kandidat Refactor)

- **Backend:** 28 file >300 LOC
- **Frontend:** 64 file >300 LOC
- **Total:** 92 file >300 LOC

Top offenders (>800 LOC):

| File | LOC | Concern Campuran |
|------|-----|------------------|
| `telegram.update.ts` | 1,641 | Bot handlers + formatting + state (ditinggalkan) |
| `BentoAdminAgentsPage.tsx` | 1,436 | UI + data fetch + form + modal + table |
| `BentoCreateTicketPage.tsx` | 1,196 | Form UI + validation + upload + multi-type + API |
| `telegram.service.ts` | 1,001 | Service monolith (ditinggalkan) |
| `zoom-booking.service.ts` | 993 | CRUD + calendar + conflict + Zoom API |
| `users.service.ts` | 927 | CRUD + search + dept + role + pagination + site |
| `BentoReportsPage.tsx` | 917 | Charts + stats + filters + layout |
| `BentoTicketKanban.tsx` | 906 | DnD + rendering + filter + mutations |
| `BentoDashboardPage.tsx` | 867 | Charts + stats + realtime + filters |

### Test Coverage

| Area | Source Files | Test Files | Ratio |
|------|-------------|------------|-------|
| Backend total | 515 | 35 | 6.8% |
| — `hardware-request` | ~45 | 29 | ~64% |
| — sisa 28 module | ~470 | 6 | ~1.3% |
| Frontend total | 487 | 25 | 5.1% |
| — `hardware-request` | ~35 | 25 | ~71% |
| — sisa 18 feature | ~452 | 0 | 0% |

> Test terkonsentrasi 100% di `hardware-request`. Modul lain praktis tanpa automated test.

---

## 3. Entry Points & Critical Paths

### Entry Points

| File | Fungsi |
|------|--------|
| [main.ts](file:///d:/iDesk-main/apps/backend/src/main.ts) | Backend bootstrap — listen :5050 |
| [app.module.ts](file:///d:/iDesk-main/apps/backend/src/app.module.ts) | Root module — 29 modules |
| [main.tsx](file:///d:/iDesk-main/apps/frontend/src/main.tsx) | Frontend React entry |
| [AppRoutes.tsx](file:///d:/iDesk-main/apps/frontend/src/routes/AppRoutes.tsx) | 3 portals: Admin/Agent, Manager, Client |
| [startup.bat](file:///d:/iDesk-main/startup.bat) | Dev startup (detect IP, start both, open browser) |

### Request Lifecycle

```
HTTP → helmet → compression → cookieParser → CorrelationMiddleware
    → ThrottlerGuard (100 req/min)
    → ValidationPipe (whitelist + transform)
    → JwtAuthGuard + RolesGuard
    → Controller → Service → TypeORM → PostgreSQL
    → LoggingInterceptor → ExceptionFilters → Response
```

### Role System

4 portal paths berdasarkan role:

| Role | Portal | Path Prefix |
|------|--------|-------------|
| ADMIN | Admin Portal | `/dashboard`, `/agents`, `/settings`, dsb |
| AGENT (+ variants) | Agent Portal | Same as ADMIN minus admin-only pages |
| MANAGER | Manager Portal | `/manager/*` |
| USER | Client Portal | `/client/*` |

### Top 10 Most Changed Files (6 bulan)

| # | File | Commits |
|---|------|---------|
| 1 | `notifications/notification-center.service.ts` | 6 |
| 2 | `users/users.service.ts` | 5 |
| 3 | `routes/AppRoutes.tsx` | 4 |
| 4 | `layout/BentoSidebar.tsx` | 4 |
| 5 | `layout/ClientLayout.tsx` | 4 |
| 6 | `request-center/pages/LostItemListPage.tsx` | 3 |
| 7 | `settings/components/NotificationSettings.tsx` | 3 |
| 8 | `ticket-board/pages/BentoTicketDetailPage.tsx` | 3 |
| 9 | `users/users.controller.ts` | 3 |
| 10 | `ticket-board/components/BentoTicketKanban.tsx` | 3 |

---

## 4. Smell Awal (Observasi Netral)

### 4.1 Pola Positif ✅

- Feature-module architecture konsisten backend & frontend
- Code splitting — semua page lazy-loaded
- Error boundaries per feature
- Proper auth flow — HttpOnly cookies, JWT, role-based guards
- Security headers — helmet, CSP production, rate limiting
- API versioning (URI-based)
- 3-layer exception handling (HTTP, Validation, Database)
- Correlation ID middleware
- Queue-based async processing
- `hardware-request` module pakai DDD pattern — paling mature
- Deploy database tool (`deploy_database_docker.bat`) sangat lengkap — 6 mode operasi

### 4.2 Pola Perlu Perhatian ⚠️

- **92 file >300 LOC**, 9 file >800 LOC
- **Dual page pattern** — Versi lama + "Bento" aktif (6+ file lama tidak dipakai)
- **Route duplication** — hardware-requests, eform-access, lost-items diulang 3× tanpa extraction
- **1000+ `any` usage** di backend, 80+ file frontend
- **`console.log` di production code** — 20 file backend, 44 file frontend
- **35+ TODO/FIXME markers** tersebar
- **1 swallowed catch** di `BentoMyTicketsPage.tsx:302`

### 4.3 Tanpa Tipe/Dokumentasi

- Backend service besar tanpa JSDoc
- 20 hooks tanpa documentation
- Type definitions terpusat minimal (4 file)
- State management store hanya 1 file

### 4.4 Dead Code Terlihat

- Page lama (non-Bento): `LoginPage.tsx`, `DashboardPage.tsx`, `FeedbackPage.tsx`, `MyTicketsPage.tsx`, `TicketKanban.tsx`, `ReportsPage.tsx`, `KnowledgeBasePage.tsx`, `ArticleDetailPage.tsx`
- `BentoDashboardPage.tsx.bak` (94KB backup file)
- `_orig.tsx` (unnamed file di root frontend)
- CSRF middleware commented out tapi file masih ada
- `IctBudgetForm.tsx` — module sudah deprecated
- Scratch files: `fix-as-any.js`, `fix-create.js`, `fix-req.js`, `scratch.js`, etc.
- Root project files: `fix-catalog.ts`, `rewrite.js`, `test-db.js`, `update_calendar.js`
- **Telegram module** (2,642 LOC total) — ditinggalkan tapi masih loaded di app.module.ts

### 4.5 Port & Config Mismatch

- `.env` → `PORT=3001`
- `main.ts` → `app.listen(5050, '0.0.0.0')` (hardcoded, .env PORT diabaikan)
- `docker-compose.yml` → maps `3001:3001` (match .env tapi bukan actual listen port)
- `startup.bat` → `VITE_API_URL=http://!IP!:5050` (match main.ts)

---

## 5. Jawaban & Temuan Tambahan

### Jawaban User

| # | Pertanyaan | Jawaban |
|---|-----------|---------|
| 1 | Concurrent users | 1000 target, 20-50% aktif (200-500 simultaneous) |
| 2 | Sumber bug production | Belum ada/belum ditemukan |
| 3 | Page lama diperlukan? | **Tidak** — bisa dihapus |
| 4 | Deployment | Dev server saja, DB di Docker, FE/BE via cmd |
| 5 | synchronize: true? | **Ya, aktif** (lihat verifikasi bawah) |
| 6 | Telegram module | **Ditinggalkan**, dipertahankan sementara, arah ke native Android |
| 7 | Monitoring | Tidak ada. Hanya SystemHealthPage (minta yang gratis) |
| 8 | Test coverage target | Ingin ditingkatkan untuk kemudahan maintenance |
| 9 | Desktop notifier | Belum digunakan (tahap development) |
| 10 | Tim developer | **Solo developer** |

### Verifikasi #5: TypeORM Synchronize

```typescript
// app.module.ts line 145
synchronize: process.env.NODE_ENV !== 'production',
```

```env
# .env line 73
NODE_ENV=development
```

> **Konfirmasi: `synchronize: true` AKTIF** karena `NODE_ENV=development`. Artinya TypeORM otomatis mengubah schema database setiap kali entity berubah. Ini bisa menyebabkan data loss jika entity field dihapus atau direname.

### 🔴 TEMUAN KRITIS: Secrets di .env yang Committed ke Git

> [!CAUTION]
> File `.env` berisi production-level secrets dan **ter-commit ke git repository**:

| Secret | Nilai Terekspos | Risiko |
|--------|-----------------|--------|
| `JWT_SECRET` | `NAcSpr2khdDeoPyKEOzU10vHn...` (60 char) | Token signing key — jika bocor, siapapun bisa forge JWT |
| `ZOOM_ACCOUNT_ID` | `FI4BhznOTFueweCC5pFR9A` | Zoom OAuth credentials |
| `ZOOM_CLIENT_ID` | `DaO1WfmDTW63qxvzLPzNZA` | Zoom OAuth credentials |
| `ZOOM_CLIENT_SECRET` | `LdZPowA4VEKU2EkZeeqkoBBwNaFMLtoN` | **Zoom OAuth secret — full API access** |
| `TELEGRAM_BOT_TOKEN` | `8552039109:AAEGCm78HLb6...` | **Full bot control** |
| `GOOGLE_CREDENTIALS_PATH` | Points to `idesk-481813-271700b60e92.json` | Google service account key file |

Catatan: `.gitignore` meng-exclude `node_modules` tapi **`.env` file ada di git** (terlihat dari directory listing). File `idesk-481813-271700b60e92.json` (Google SA key) juga di root project.

### Analisis Connection Pool vs Target Users

Target: 1000 concurrent, 200-500 aktif. Current config:

```
DB Pool: max=20, min=5
Rate Limit: 100 req/min per IP
Server Timeout: 30s
```

Dengan 200-500 active users, pool `max=20` kemungkinan cukup untuk saat ini karena queries biasanya cepat (<1s). Tapi jika ada slow queries + banyak concurrent requests, pool bisa jadi bottleneck.

### Redis Status

```env
REDIS_ENABLED=false
```

Redis disabled di development. Artinya Bull queue features (email, notification, zoom-meeting) berjalan in-process atau tidak berjalan sama sekali. Perlu verifikasi apakah ada fallback mechanism.
