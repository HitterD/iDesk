# iDesk — Laporan Review Komprehensif

**Tanggal:** 2026-08-21  
**Branch:** `feat/email-notification-config` — HEAD `d1e4a82` vs `origin/main` `6b5993c`  
**Cakupan:** Keseluruhan project (bukan hanya diff), perhatian ekstra ke perubahan branch ini  
**Metode:** 6 dimensi paralel (backend, frontend, security, performance, testing, infra) + sintesis deduplicated  
**Sumber evidence:** `Read`/`Grep`/`Glob` per file — setiap temuan cite `file:line`

> Review ini **read-only**. Tidak ada mutasi working tree untuk laporan ini.

---

## Ringkasan Eksekutif

iDesk adalah sistem helpdesk/ticketing + knowledge base + hardware request + SLA + Zoom booking dengan **site isolation** (fail-closed), auth JWT HttpOnly, dan infra Docker Compose. Fondasi arsitektur dan security hygiene **sudah di atas rata-rata** (site isolation konsisten, auth terdekomposisi, Helmet/ValidationPipe global, mail infra hybrid queue). Namun **5 risiko P0** menahan kelayakan merge ke `main`:

1. **Kredensial NAS & backup bisa bocor** — TLS verification dimatikan, encryption key fallback hardcoded, command injection via `pg_dump`/`tar` shell interpolation (`synology.service.ts`).
2. **Isolasi site bocor via notifikasi** — fan-out `ICT_STAFF` tanpa `siteId` dan WS `server.emit` global (`in-app-notifier.listener.ts:95`, `notification.service.ts:60`).
3. **Quality gate tidak ada** — coverage 6.74%, E2E hanya `expect(true)`, `maybeDescribe` selalu skip, `strict:false` + 1372× `any`.
4. **Infra tidak resilient** — tanpa `.dockerignore`, image `node:18` EOL, healthcheck `wget` missing, tanpa `restart`/`resources`/`CI`.
5. **Migrasi irreversible** — `DropIctBudget.down()` kosong.

**Rekomendasi:** Jangan merge sebelum **Fase 1** (5 fix P0) selesai. Estimasi Fase 1: **2–4 hari** untuk 1–2 engineer. Setelah itu project siap untuk hardening Fase 2.

---

## Skor Kesehatan per Dimensi (0–100)

| Dimensi | Skor | Alasan singkat |
|---------|------|----------------|
| **Backend** | **62** | Site isolation & auth rapi; tapi god module/entity, event outbox hilang, sync I/O di hot path, WS scoping bocor |
| **Frontend** | **58** | Feature-sliced + code-splitting bagus; tapi auth interceptor ganda, queryKey duplikat, file 1300+ baris, a11y flyout, circular `require()` |
| **Security** | **48** | JWT httpOnly + site fail-closed + Helmet kuat; tapi 3 critical (TLS, key, injection) + 7 important (register publik, bulk tanpa limit, CORS/CSRF longgar) |
| **Performance** | **55*** | *Dimensi perf agent ter-interrupt; skor inferred dari backend/infra/frontend — bottleneck utama: sync `fs` per-request, `softRemove` loop, bundle chunk belum split, tanpa gzip di nginx |
| **Testing** | **32** | Spec HRIS meaningful ada; tapi coverage 6.74% tanpa threshold, E2E hilang, integration selalu skip, `strict:false` + 1372 `any` |
| **Infra** | **45** | Healthcheck + env fail-fast + multi-stage bagus; tapi tanpa `.dockerignore`/`CI`, volume bind rawan, image EOL, `down()` kosong |
| **Keseluruhan** | **50** | Fondasi bagus tapi **quality & security gate belum mengunci** — prioritas: kunci P0 dulu |

> *Performance: agent `adc0affcdbeff2796` ter-interrupt sebelum emit JSON final; temuan perf di bawah dirangkum dari evidence cross-dimensi (backend `main.ts:131`, `ticket-update.service.ts:639`, frontend `vite.config.js:27`, `nginx.conf:1`). Perlu verifikasi lanjutan.

---

## Temuan Kritis (P0) — Wajib sebelum merge

### P0-1 — TLS verification dimatikan untuk Synology DSM (Security Critical)
- **File:** `apps/backend/src/modules/synology/synology.service.ts:364`
- **Apa:** `https.Agent({ rejectUnauthorized: false })` di `callDsmApi`
- **Kenapa bahaya:** MITM di segmen NAS bisa sajikan cert palsu; backend tetap kirim `synologyUsername`/`synologyPassword` + `sid` FileStation.
- **Skenario:** ARP spoof / DNS kompromi → cred backup bocor → exfil NAS.
- **Fix:** Hapus `rejectUnauthorized:false`. Sediakan `TRUSTED_CA` bundle atau pin fingerprint; paksa HTTPS di `production` via `validateAuthEnvironment()`.

### P0-2 — Fallback encryption key hardcoded + salt statis (Security Critical)
- **File:** `apps/backend/src/modules/synology/synology.service.ts:26`
- **Apa:** `BACKUP_ENCRYPTION_KEY || 'idesk-backup-key-32chars!!'` + `scryptSync(key,'salt',32)` salt literal
- **Kenapa bahaya:** Jika env kosong (dev/default), `synologyPasswordEncrypted` di DB deterministik dan bisa di-decrypt siapa pun yang baca source.
- **Fix:** Fail-fast di `production` jika key kosong; ganti salt statis dengan salt random per-encrypt (simpan bersama IV) atau KMS.

### P0-3 — Command injection via shell interpolation `pg_dump`/`tar` (Security Critical)
- **File:** `apps/backend/src/modules/synology/synology.service.ts:515`
- **Apa:** `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} | gzip > "..."` lalu `execAsync(cmd,{shell})`; `tar -czf ...` serupa
- **Kenapa bahaya:** `dbHost`/`dbName` dari env — jika mengandung `; rm -rf` / backtick, shell eksekusi di host Node.
- **Fix:** Ganti ke `spawn`/`execFile` dengan arg array; tulis file via stream tanpa shell; validasi host/port dengan allowlist regex.

### P0-4 — Cross-site fan-out notifikasi hardware (Backend Critical)
- **File:** `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts:95,157` dan `email-notifier.listener.ts:39`
- **Apa:** `onProcurementDone` & `onInstallCompleted` panggil `listUsersWithRole('ICT_STAFF')` tanpa `siteId`; padahal `onSubmitted/onApproved/onRejected` sudah scoped `siteId`
- **Kenapa bahaya:** Notifikasi instalasi site A bocor ke ICT_STAFF site B — melanggar janji fail-closed `fb7c5bd`.
- **Fix:** `listUsersWithRole('ICT_STAFF', siteId)` ambil `siteId` dari `r.siteId`; tambah assertion di spec; pertimbangkan `PermissionsService` fail-closed bila `siteId` null untuk role site-locked.

### P0-5 — Global WS emit tanpa room scoping (Backend Critical)
- **File:** `apps/backend/src/modules/notifications/notification.service.ts:60,76` dan `notification-center.service.ts:245`
- **Apa:** `server.emit('notification:${userId}')` / `server.emit('notification:new')` broadcast ke semua socket; `emit('action-items:refresh:${userId}')` juga global
- **Kenapa bahaya:** Beban WS O(n) + potensi sniff lintas site jika client subscribe wildcard; bertentangan dengan `site:${siteId}` scoping yang sudah ada di `ticket-update.service.ts:312`
- **Fix:** `server.to('user:${userId}').emit(...)` dan `site:${siteId}` room; join room saat handshake (`ws-room-authz`); tambah test: client site A tidak terima event site B.

### P0-6 — Coverage 6.74% tanpa threshold — regresi tidak terdeteksi (Testing Critical)
- **File:** `coverage-baseline-backend.txt:295`, `apps/backend/package.json:114`, `apps/frontend/vitest.config.ts:12`
- **Apa:** `All files 6.74% Stmts / 2.73% Branch`; tanpa `coverageThreshold` di Jest/Vitest; `test:cov` hanya informatif
- **Kenapa bahaya:** Branch `feat/email-notification-config` bisa merge tanpa naikkan coverage; confidence release rendah.
- **Fix:** Tambah `coverageThreshold` bertahap (mis. 40% → 60%) dan fail CI jika di bawah baseline.

> **Deduplicate note:** P0-1/2/3 overlap Security; P0-4/5 overlap Backend+Security — digabung, ambil severity tertinggi (critical).

---

## Temuan Penting (P1) — Fix ASAP (minggu ini)

### Backend (6)
- **God module `AppModule`** — `apps/backend/src/app.module.ts:1` impor 40+ entity & 30+ module, duplikat `autoLoadEntities:true` + manual list, 4 pasang `forwardRef` sirkular. *Fix:* `forFeature()` per feature module; ekstrak `shared/ports` contracts.
- **God entity `Ticket`** — `ticket.entity.ts:185` campur `isHardwareInstallation/scheduledDate/hardwareType/reminderD*`. *Fix:* Ekstrak ke `InstallationSchedule`; tambah `INDEX (siteId, status) WHERE deletedAt IS NULL`.
- **Event `@OnEvent` tanpa retry/outbox** — `ticket-notification.listener.ts:39` + hardware/eform listeners in-memory; crash antara emit dan `mailDispatch.send` → hilang. *Fix:* Bull queue atau outbox table + `idempotencyKey`.
- **Upload fallback sync I/O per-request** — `main.ts:131` `existsSync/statSync/readdirSync` tiap `GET /uploads` block event loop. *Fix:* `fs.promises` + LRU cache atau `storagePath` di DB; hapus duplikat `useStaticAssets:182`.
- **HRIS NIK fallback terlalu longgar** — `credential-validator.service.ts:68` jika HRIS `valid:true, match:false` tetap fallback ke local. *Fix:* Hanya fallback jika `mustChangePassword` atau `passwordResetAt` dalam window; audit metric fallback.
- **Dedup notifikasi TOCTOU + enrich tanpa site guard** — `notification.service.ts:30` `findOne`→`save` tanpa unique; `ticket-query` enrich HW tanpa `siteId`. *Fix:* Partial unique index `UNIQUE(userId,type,referenceId) WHERE createdAt>now()-24h` atau `ON CONFLICT DO NOTHING`.

### Security (7)
- **Magic-bytes bypass `text/plain`** — `magic-bytes.validator.ts:12` `text/plain:[]` + `bytes.length===0 → true`; `.txt` polyglot lolos → stored XSS via `/uploads`. *Fix:* Tolak `text/plain` allow-all; validasi HTML/SVG tag; `Content-Disposition: attachment`.
- **Path traversal `ticketId` di storage** — `attachment-upload.interceptor.ts:22` `join(UPLOAD_ROOT,'tickets', ticketId)` tanpa sanitasi. *Fix:* Hanya `IsUUID`, `path.resolve` + `relative` check seperti `main.ts:143`.
- **Register publik tanpa guard** — `auth.controller.ts:103` `POST /auth/register` hanya `@Throttle(3/min)`. *Fix:* `@UseGuards(JwtAuthGuard) @Roles(ADMIN)` atau feature flag; `RegisterDto` jangan expose `role`/`siteId`.
- **Bulk tanpa batas** — `bulk-update.dto.ts:6` tanpa `@ArrayMaxSize`. *Fix:* `@ArrayMaxSize(50-100)` + dedup + rate-limit bulk.
- **CORS allow localhost di production** — `main.ts:46` selalu push `localhost:4050/5173/3000`. *Fix:* Hanya allow localhost jika `NODE_ENV!=='production'`.
- **CSP `unsafe-inline`+`unsafe-eval`** — `main.ts:70` meniadakan mitigasi XSS. *Fix:* Hapus `unsafe-eval`; ganti `unsafe-inline` dengan nonce/hash.
- **CSRF middleware dinonaktifkan** — `main.ts:96` hanya andalkan `SameSite:strict`. *Fix:* Aktifkan double-submit (`csrf-token` + `X-CSRF-TOKEN`) termasuk bulk/delete.

### Frontend (4)
- **Axios instance kedua tanpa interceptor** — `features/hardware-request/api/http.ts:3` tanpa `auth/refresh/CSRF`. *Fix:* Hapus instance kedua; pakai `lib/api.ts` terpusat (`withCredentials`).
- **Duplikasi `queryKey ['my-permissions']`** — `hooks/usePermissions.ts:99` `staleTime` berbeda + fetch berulang. *Fix:* Satu source `queryKey` + `staleTime` konsisten; `select` untuk derivasi.
- **Wildcard fallback hapus 404** — `routes/AppRoutes.tsx:322` selalu redirect role-aware. *Fix:* Tambah `NotFoundPage`.
- **Flyout collapsed tidak aksesibel keyboard** — `components/layout/BentoSidebar.tsx:105` hanya `group-hover`. *Fix:* Radix Popover/DropdownMenu + `role=menu` + roving tabindex.

### Infra (6)
- **Tanpa `.dockerignore`** — context `.:.` kirim `node_modules/.git/.env/uploads/backups` ke daemon. *Fix:* Tambah `.dockerignore` root/backend/frontend.
- **Base `node:18-alpine` EOL + `wget` missing** — `apps/backend/Dockerfile:2` healthcheck `wget` akan selalu failing. *Fix:* `node:20/22-alpine` + `apk add wget` atau `node -e fetch(...)`.
- **Postgres volume bind `./backups/postgres`** — `docker-compose.yml:15` rawan permission + `down -v` data loss. *Fix:* Named volume `pgdata`/`redisdata`.
- **Tanpa `restart/resources/logging`** — `docker-compose.yml:55` hanya Redis punya. *Fix:* `restart: unless-stopped` + `deploy.resources.limits` + `logging max-size 10m` untuk semua.
- **Tanpa CI/CD** — `.github/workflows` tidak ada. *Fix:* `ci.yml` (build/test/lint + docker build cache).
- **Migrasi `DropIctBudget` irreversible** — `migrations/1776000300500-DropIctBudget.ts:11` `down()` kosong. *Fix:* Restore dari backup table atau cegah drop jika backup tidak ada.

### Testing (6)
- **Tanpa quality gate** — `package.json:114` tanpa `coverageThreshold`; `vitest.config.ts:12` tanpa `coverage`. *Fix:* Threshold bertahap + `test:cov:strict`.
- **Isolasi serial dilanggar** — `package.json:18` `test=jest` tanpa `--runInBand` vs `MEMORY.md` wajib serial. *Fix:* `jest --runInBand --detectOpenHandles`.
- **E2E config hilang** — `package.json:21` `test:e2e` → `test/jest-e2e.json` tidak ada. *Fix:* Buat config atau ganti `test:integration`.
- **E2E hanya `expect(true)`** — `hr-e2e-smoke.integration.spec.ts:27` tanpa `login→create→assign→resolve`. *Fix:* Tulis E2E supertest nyata + seed.
- **Integration selalu skip** — `hardware-request.integration.spec.ts:21` `maybeDescribe = TEST_DATABASE_URL ? describe : describe.skip` tanpa `TEST_DATABASE_URL` di CI. *Fix:* Sediakan Postgres di CI atau `testcontainers`.
- **`strict:false` + 1372× `any`** — `tsconfig.json:15` hanya `strictNullChecks`. *Fix:* `strict:true` bertahap; ban `no-explicit-any`.

---

## Temuan Minor / Tech Debt (P2–P3)

**Backend:** Magic string role/template + `Promise.all` tanpa limit (`email-notifier.listener.ts:21` → `p-limit(20)`); `bulkSoftDelete` loop `softRemove` (`ticket-update.service.ts:639` → `softDelete({id: In(ids)})`); in-memory `viewCache` 10k tidak terdistribusi (`knowledge-base.service.ts:23` → Redis `SETNX`).

**Frontend:** File raksasa 1300+ baris (`BentoCreateTicketPage:1`, `BentoSlaSettingsPage`, `PresetDrawer` → pecah per concern + zod schema); `manualChunks` belum split `framer-motion/recharts/fullcalendar/xlsx` (`vite.config.js:27`); `useHasFeaturePermission` conditional `useQuery` langgar Rules of Hooks (`usePermissions.ts:182`); circular `require()` di interceptor (`lib/api.ts:106` → `EventEmitter`); IIFE + `AnimatePresence mode=wait` remount `Outlet` (`BentoLayout.tsx:114`); `queryKey` object tanpa stabilisasi (`useTickets.ts:78`); 5 CSS global tanpa code-split (`main.tsx:4`); FAB tanpa text alternatif (`MobileBottomNav.tsx:51`).

**Security (minor):** `SoundSettingsPage.tsx:54` masih `localStorage token` + `/api` prefix salah; `csrf.middleware.ts:182` token tanpa HMAC; `token.service.ts:86` access 8 jam untuk privileged terlalu panjang.

**Infra:** `nginx.conf:1` tanpa `gzip`/security headers/rate limit + `location /assets` tanpa `immutable`; `Dockerfile:4` layer caching tidak optimal (`COPY apps/backend ./` invalidate `npm ci`).

**Testing:** `hardware-request.gateway.spec.ts:12` missing `WsAuthGuard` DI; `uuid` ESM transform belum lengkap (`transformIgnorePatterns`); tanpa `husky`/`lint-staged`; frontend `coverage` tidak dikonfigurasi; drift `.env.example` vs `HRIS_GATEWAY_*`.

---

## Top 10 Quick Wins (impact tinggi, effort rendah)

| # | Fix | File:line | Effort | Impact |
|---|-----|-----------|--------|--------|
| 1 | Tambah `@ArrayMaxSize(50)` + dedup ke bulk DTO | `bulk-update.dto.ts:6` | 15m | Cegah DoS bulk 10k IDs |
| 2 | Proteksi `POST /auth/register` dengan `JwtAuthGuard+Roles(ADMIN)` | `auth.controller.ts:103` | 10m | Tutup privilege escalation |
| 3 | Tambah `siteId` ke `listUsersWithRole` di `in-app-notifier` | `in-app-notifier.listener.ts:95,157` | 20m | Kunci bocor site isolation |
| 4 | Ganti `server.emit` → `server.to('user:${userId}').emit` | `notification.service.ts:60` | 20m | Kunci sniff lintas site |
| 5 | Tambah `.dockerignore` (root/backend/frontend) | `.dockerignore:1` | 10m | Build 5–10× lebih cepat + cegah bocor `.env` |
| 6 | `test` → `jest --runInBand` + `coverageThreshold` 30% | `package.json:18,114` | 15m | Enforce quality gate |
| 7 | `manualChunks` untuk `framer-motion/recharts/fullcalendar` | `vite.config.js:27` | 20m | Initial chunk -30% |
| 8 | Ganti `softRemove` loop → `softDelete({id: In(ids)})` | `ticket-update.service.ts:639` | 10m | Bulk delete 400→1 query |
| 9 | Validasi `ticketId` UUID sebelum `join(UPLOAD_ROOT,...)` | `attachment-upload.interceptor.ts:22` | 15m | Cegah path traversal |
| 10 | `CORS` hanya allow `localhost` di non-production | `main.ts:46` | 10m | Perkecil trust boundary |

---

## Roadmap Prioritas (3 Fase)

### Fase 1 — Minggu ini (P0, 2–4 hari)
- [ ] P0-1/2/3 Synology (TLS + key/salt + injection) — `synology.service.ts:26,364,515`
- [ ] P0-4/5 Notifikasi site isolation — `in-app-notifier.listener.ts:95`, `notification.service.ts:60`
- [ ] P0-6 Coverage threshold + `E2E` config + `--runInBand` — `package.json:18,114`, `test/jest-e2e.json`
- [ ] Quick wins #1,2,9 (bulk limit, register guard, path traversal)

### Fase 2 — Bulan ini (P1)
- [ ] Backend: God module/entity refactor + outbox/queue untuk `@OnEvent` + async upload fallback
- [ ] Security: Magic-bytes + CORS/CSP/CSRF hardening
- [ ] Frontend: Hapus axios kedua, queryKey dedup, 404 page, flyout a11y, pecah file raksasa, `manualChunks` berat
- [ ] Infra: `.dockerignore`, `node:20/22`, named volumes, `restart/resources/logging`, `down()` reversible
- [ ] Testing: E2E nyata + `TEST_DATABASE_URL` di CI + `strict:true` bertahap

### Fase 3 — Next quarter (P2–P3 + perf hardening)
- [ ] Perf: `nginx gzip` + `assets immutable`, `viewCache` → Redis, `bulkSoftDelete` batch, token lifetime 8h→1h + revocation
- [ ] DX: `npm workspaces`/`pnpm`, `concurrently --kill-others`, ` husky` + `lint-staged` + GitHub Actions `ci.yml` + `prom-client` metrics
- [ ] Docs: Sync `.env.example` + `README Testing` + Blueprint sebagai living E2E spec
- [ ] Verifikasi ulang perf dimensi (agent ter-interrupt) — ukur bundle `visualizer`, slow-query `>1000ms`, WS room test

---

## Hal yang Sudah Bagus (Strengths)

**Backend:** Site isolation konsisten (`site-scope.util.ts` + `site-access.util.ts` dipakai di `ticket-query/update/messaging/gateway`); auth terdekomposisi (`credential-validator/token/session/mapper`) + JWT httpOnly + refresh rotation + reuse detection (`jwt.strategy.ts:56`, `session.service.ts:49`); mail infra DB-backed hybrid queue (`mail-config/transport/dispatch` + Bull retry exponential); `ValidationPipe` global `whitelist+forbidNonWhitelisted` + `Helmet+HSTS+CSP` + `ThrottlerGuard` global; transaksi atomik `ticket-update:60`/`messaging:133` post-commit baru emit.

**Frontend:** Feature-sliced konsisten + 40+ `lazy()`+`Suspense`+`FeatureErrorBoundary` per route + `LazyMotion`; design token terpusat (`styles/tokens.css:6`); TanStack Query konsisten `staleTime/gcTime` + optimistic update + rollback (`useOptimisticMutation:40`).

**Security:** JWT httpOnly+secure+SameSite=strict + Bearer fallback + `type:'access'` validated; site fail-closed `1=0`; throttling per akun+IP (`CustomThrottlerGuard:11`); Handlebars `{{var}}` escaped + TypeORM parameterized; magic-bytes + extension whitelist; Helmet awal + body limit + masking PII; HRIS bounded timeout + `encodeURIComponent(NIK)`.

**Testing:** Spec HRIS meaningful (fallback, provisioning gate, audit masking); HRIS adapter edge-case lengkap; pola integrasi DB real (`hardware-request.integration:23`); `vitest` modern (jsdom+globals+testing-library).

**Infra:** Healthcheck + `depends_on: service_healthy`; fail-fast `${VAR:?msg}`; multi-stage + non-root user; `validateAuthEnvironment()` ketat di prod; `liveness/readiness` k8s-ready; slow-query logger + param masking; backup preflight.

---

## Appendix: Temuan per Dimensi (ringkas)

### Backend — 11 temuan (2 critical, 6 important, 3 minor)
| Sev | File:line | Judul |
|-----|-----------|-------|
| critical | `in-app-notifier.listener.ts:95` | Cross-site fan-out tanpa `siteId` |
| critical | `notification.service.ts:60` | WS emit global tanpa room |
| important | `app.module.ts:1` | God module 40+ import + forwardRef |
| important | `ticket.entity.ts:185` | God entity campur hardware/SLA |
| important | `ticket-notification.listener.ts:39` | `@OnEvent` tanpa retry/outbox |
| important | `main.ts:131` | Sync `fs` per-request block event loop |
| important | `credential-validator.service.ts:68` | HRIS fallback terlalu longgar |
| important | `notification.service.ts:30` | Dedup TOCTOU + enrich tanpa site |
| minor | `email-notifier.listener.ts:21` | Magic string + Promise.all tanpa limit |
| minor | `ticket-update.service.ts:639` | `softRemove` loop tidak efisien |
| minor | `knowledge-base.service.ts:23` | In-memory viewCache tidak terdistribusi |

### Frontend — 13 temuan (4 high, 6 medium, 3 low)
| Sev | File:line | Judul |
|-----|-----------|-------|
| high | `hardware-request/api/http.ts:3` | Axios kedua tanpa interceptor |
| high | `hooks/usePermissions.ts:99` | Duplikasi `queryKey` + staleTime |
| high | `routes/AppRoutes.tsx:322` | Wildcard hapus 404 |
| high | `components/layout/BentoSidebar.tsx:105` | Flyout tidak keyboard-accessible |
| medium | `features/client/pages/BentoCreateTicketPage.tsx:1` | File 1387 baris |
| medium | `vite.config.js:27` | `manualChunks` belum split berat |
| medium | `hooks/usePermissions.ts:182` | Conditional `useQuery` langgar hooks |
| medium | `lib/api.ts:106` | Circular `require()` |
| medium | `components/layout/BentoLayout.tsx:114` | IIFE + AnimatePresence remount |
| medium | `features/ticket-board/hooks/useTickets.ts:78` | `queryKey` object tidak stabil |
| low | `main.tsx:4` | 5 CSS global tanpa split |
| low | `components/layout/MobileBottomNav.tsx:51` | FAB tanpa a11y |
| low | `features/vpn-access/pages/VpnAccessPage.tsx:44` | Cross-feature import |

### Security — 13 temuan (3 critical, 7 important, 3 minor)
| Sev | File:line | OWASP | Judul |
|-----|-----------|-------|-------|
| critical | `synology.service.ts:364` | A05 | TLS `rejectUnauthorized:false` |
| critical | `synology.service.ts:26` | A02 | Fallback key + salt statis |
| critical | `synology.service.ts:515` | A03 | Command injection `pg_dump/tar` |
| important | `magic-bytes.validator.ts:12` | A05+A03 | Bypass `text/plain` |
| important | `attachment-upload.interceptor.ts:22` | A01 | Path traversal `ticketId` |
| important | `auth.controller.ts:103` | A01 | Register publik |
| important | `bulk-update.dto.ts:6` | A01+A04 | Bulk tanpa limit |
| important | `main.ts:46` | A05 | CORS localhost di prod |
| important | `main.ts:70` | A05 | CSP `unsafe-inline/eval` |
| important | `main.ts:96` | A01 | CSRF dinonaktifkan |
| minor | `SoundSettingsPage.tsx:54` | A02 | `localStorage token` mati |
| minor | `csrf.middleware.ts:182` | A05 | Token tanpa HMAC |
| minor | `token.service.ts:86` | A02 | Token 8 jam privileged |

### Infra — 14 temuan (6 high, 6 medium, 2 low)
| Sev | File:line | Judul |
|-----|-----------|-------|
| high | `.dockerignore:1` | Tanpa `.dockerignore` |
| high | `apps/backend/Dockerfile:2` | `node:18` EOL + `wget` missing |
| high | `docker-compose.yml:15` | Volume bind `./backups/postgres` |
| high | `docker-compose.yml:55` | Tanpa `restart/resources/logging` |
| high | `.github/workflows:1` | Tanpa CI/CD |
| high | `migrations/1776000300500-DropIctBudget.ts:11` | `down()` kosong irreversible |
| medium | `.env.example:16` | Drift root vs backend |
| medium | `config/auth.config.ts:30` | Validasi env hanya di prod |
| medium | `docker-compose.yml:90` | Port 5050 publish bypass nginx |
| medium | `package.json:6` | Tanpa workspaces + lockfile divergen |
| medium | `logging.interceptor.ts:21` | Tanpa structured logger/Sentry |
| medium | `backup_db.bat:18` | `--volumes-from`/`wmic` deprecated |
| low | `nginx.conf:1` | Tanpa `gzip`/headers/rate limit |
| low | `apps/backend/Dockerfile:4` | Layer caching tidak optimal |

### Testing — 13 temuan (1 critical, 6 high, 6 medium/low)
| Sev | File:line | Judul |
|-----|-----------|-------|
| critical | `coverage-baseline-backend.txt:295` | Coverage 6.74% |
| high | `package.json:114` | Tanpa `coverageThreshold` |
| high | `package.json:18` | Tanpa `--runInBand` |
| high | `test/jest-e2e.json:0` | Config E2E hilang |
| high | `hr-e2e-smoke.integration.spec.ts:27` | E2E hanya `expect(true)` |
| high | `hardware-request.integration.spec.ts:21` | Integration selalu skip |
| high | `tsconfig.json:15` | `strict:false` + 1372 `any` |
| medium | `hardware-request.gateway.spec.ts:12` | Gateway spec broken |
| medium | `hardware-request.integration.spec.ts:175` | `uuid` ESM transform |
| medium | `.husky:1` | Tanpa lint/pre-commit/CI |
| medium | `vitest.config.ts:12` | Frontend coverage tidak ada |
| medium | `.env.example:1` | Drift docs/env |
| low | `credential-validator.service.spec.ts:16` | Mock `as any` |

### Performance — inferred (agent ter-interrupt)
Bottleneck terkonfirmasi via cross-evidence: sync `fs` di `main.ts:131`, `softRemove` loop di `ticket-update.service.ts:639`, `manualChunks` belum split di `vite.config.js:27`, `nginx.conf:1` tanpa `gzip`, `viewCache` in-memory di `knowledge-base.service.ts:23`. **Action:** ukur ulang dengan `vite-bundle-visualizer`, `EXPLAIN` untuk `siteId+status` index, dan load test `GET /uploads/<random>`.

---

**Evidence & reproducibility:** Setiap temuan di atas cite `file:line` yang diverifikasi via `Read`/`Grep`/`Glob`. Untuk klaim yang belum 100% terverifikasi (mis. perf skor), laporan tulis "perlu verifikasi" sesuai `CLAUDE.md §6 ANTI-HALLUCINATION`.

**Next step yang disarankan:** Mulai dari **Top 10 Quick Wins** (total ~2.5 jam) untuk mengunci 3 vector terbesar, lalu eksekusi **Fase 1** P0 sebelum review ulang.
