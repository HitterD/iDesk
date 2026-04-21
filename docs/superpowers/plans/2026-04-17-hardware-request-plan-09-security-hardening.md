# Hardware Request — Plan 9: Security Hardening & Deprecation Redirects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutup lubang keamanan yang teridentifikasi di audit Plan 01–07 + sediakan deprecation shim untuk client eksternal yang masih panggil `/ict-budget/*`. Harden migrasi data agar aman di production.

**Context gap (audit 2026-04-18):**
- `realtime/hardware-request.gateway.ts:16` pakai `cors: { origin: '*' }` → siapapun bisa konek WS dari domain manapun.
- WS `handleConnection` ada komentar "Can read token here for auth if needed" tapi **tidak ada auth**. Semua client bisa subscribe ke room request manapun → kebocoran data status/komentar/asset.
- Plan 5.7 "route redirect (deprecation shim)" tidak pernah di-implement. Client lama yang panggil `/ict-budget/*` dapat **404** — seharusnya **308 Permanent Redirect** selama window transisi.
- Migrasi `1776000300000-MigrateIctBudgetData.ts` lossy tanpa pre-flight check (no row count, no site fallback validation, no rollback plan).
- `hardware-activity.controller.ts` RBAC belum diverifikasi — activity log bisa berisi data sensitif (comments, rejection reasons).

**Scope:** Auth + CORS + redirect + migration hardening. Tidak tambah fitur baru.

**Tech Stack:** NestJS v10, socket.io 4, JWT (Passport), TypeORM migrations, NestJS Throttler, Supertest.

---

## Files in this plan

### Create
- `apps/backend/src/modules/hardware-request/realtime/ws-auth.guard.ts`
- `apps/backend/src/modules/hardware-request/realtime/ws-room-authz.ts`
- `apps/backend/src/modules/hardware-request/realtime/__tests__/hardware-request.gateway.auth.spec.ts`
- `apps/backend/src/modules/hardware-request/presentation/ict-budget-redirect.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/__tests__/ict-budget-redirect.spec.ts`
- `apps/backend/src/database/migrations/1776000299000-PreflightIctBudgetCheck.ts` (sisipan sebelum 300000)
- `apps/backend/scripts/verify-hardware-migration.ts`
- `apps/backend/src/modules/hardware-request/presentation/__tests__/hardware-activity.rbac.spec.ts`

### Modify
- `apps/backend/src/modules/hardware-request/realtime/hardware-request.gateway.ts` — CORS dari env, auth pada `handleConnection`, authz pada `subscribe` message
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` — register new guard + redirect controller
- `apps/backend/.env.example` — tambah `WS_CORS_ORIGIN`, `WS_JWT_SECRET` (atau reuse `JWT_SECRET`)
- `apps/backend/src/database/migrations/1776000300000-MigrateIctBudgetData.ts` — add defensive guards, log counts, dry-run env flag
- `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts` — add `@UseGuards(HardwareRoleGuard)` + scope check
- `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts` — support scope matrix jika belum

---

## Task 9.0: Baseline snapshot

- [ ] **Step 1: Inventaris permukaan serang**
  ```bash
  grep -rn "origin:.*'\*'\|origin:.*\"\*\"\|cors:.*true" apps/backend/src --include="*.ts"
  grep -rn "handleConnection\|handleDisconnect" apps/backend/src/modules/hardware-request
  ```
  Catat semua tempat wildcard CORS atau WS tanpa guard.

- [ ] **Step 2: Test baseline hijau + coverage file**
  ```bash
  cd apps/backend && pnpm test --coverage
  ```

## Task 9.1: WS CORS dari env + produksi strict

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/realtime/hardware-request.gateway.ts`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Env config**
  Tambah `WS_CORS_ORIGIN=http://localhost:5173` (comma-separated supported) ke `.env.example`. Tambah validasi di `ConfigModule` schema.

- [ ] **Step 2: Refactor `@WebSocketGateway`**
  Ganti `cors: { origin: '*' }` → `cors: { origin: (origin, cb) => { ... } }` yang baca env + whitelist. Di production (`NODE_ENV=production`) tolak wildcard — fail fast jika env tidak di-set.

- [ ] **Step 3: Unit test**
  Mock origin valid → allow. Origin invalid → deny. Missing env di prod → throw.

- [ ] **Step 4: Commit**
  ```
  fix(security): restrict WS CORS via env whitelist
  ```

## Task 9.2: WS JWT auth on handshake + per-room authz

**Files:**
- Create: `apps/backend/src/modules/hardware-request/realtime/ws-auth.guard.ts`
- Create: `apps/backend/src/modules/hardware-request/realtime/ws-room-authz.ts`
- Create: `apps/backend/src/modules/hardware-request/realtime/__tests__/hardware-request.gateway.auth.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/realtime/hardware-request.gateway.ts`
- Modify: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`

- [ ] **Step 1: Extract JWT dari handshake**
  Pakai `socket.handshake.auth.token` (client kirim saat `io(url, { auth: { token } })`) atau fallback query `?token=`. Verify pakai `JwtService`. Attach `socket.data.user = { id, roles }`. Jika invalid → `socket.disconnect(true)`.

- [ ] **Step 2: Room authz**
  Sebelum `socket.join(`request:${requestId}`)`, panggil `wsRoomAuthz(user, requestId, repo)` yang cek: user adalah requester, approver, ICT technician, atau admin. Jika bukan → emit `unauthorized` + disconnect.

- [ ] **Step 3: Implement di gateway**
  `handleConnection` verify JWT. `@SubscribeMessage('subscribe')` dengan DTO `{ requestId }` → authz → `join`.

- [ ] **Step 4: Test coverage**
  - no token → disconnect
  - invalid token → disconnect
  - valid token + unauthorized request → no join + error event
  - valid token + authorized → join + receive broadcast

- [ ] **Step 5: Frontend wire-up**
  Update `useHardwareRequestRealtime.ts` — kirim `auth: { token: accessToken }` saat `io()`. (Dokumentasi di body PR.)

- [ ] **Step 6: Commit**
  ```
  feat(security): WS JWT auth + per-room authorization
  ```

## Task 9.3: Deprecation redirect `/ict-budget/*` → `/hardware-requests/*`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/presentation/ict-budget-redirect.controller.ts`
- Create: `apps/backend/src/modules/hardware-request/presentation/__tests__/ict-budget-redirect.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`

- [ ] **Step 1: Controller definisi**
  `@Controller('ict-budget')` dengan catch-all:
  ```ts
  @All('*')
  redirect(@Req() req: Request, @Res() res: Response) {
    const newPath = req.originalUrl.replace(/^\/ict-budget/, '/hardware-requests');
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', '2026-07-01'); // adjust
    return res.redirect(308, newPath);
  }
  ```

- [ ] **Step 2: Mapping path lama → baru**
  Dokumentasi mapping (approve/reject/list/detail). Jika ada path lama yang TIDAK ada padanan baru → log warning + 410 Gone.

- [ ] **Step 3: Integration test**
  Supertest: `GET /ict-budget/123` → 308 + Location `/hardware-requests/123`. `POST /ict-budget/123/approve` body preserved → 308 + Location `/hardware-requests/123/approve`.

- [ ] **Step 4: Register controller**
  Di `HardwareRequestModule.controllers` array — **hanya** jika Plan 8 sudah hapus `IctBudgetModule` (kalau tidak, duplicate path conflict).

- [ ] **Step 5: Commit**
  ```
  feat(backend): deprecation 308-redirect for legacy /ict-budget routes
  ```

## Task 9.4: Pre-flight migration check

**Files:**
- Create: `apps/backend/src/database/migrations/1776000299000-PreflightIctBudgetCheck.ts`

- [ ] **Step 1: Migration logic**
  Query:
  - `SELECT COUNT(*) FROM ict_budgets` → log
  - `SELECT COUNT(*) FROM ict_budgets WHERE site_id IS NULL` → jika >0 **throw** (mandatory fallback di up)
  - `SELECT COUNT(*) FROM ict_budgets WHERE status NOT IN (known_statuses)` → log unknown statuses
  - Buat backup table `ict_budgets_backup_1776000299000` via `CREATE TABLE ... AS SELECT * FROM ict_budgets`

- [ ] **Step 2: Down method**
  `DROP TABLE ict_budgets_backup_1776000299000`.

- [ ] **Step 3: Test di dev snapshot**
  Run migration di copy DB. Assert backup table exist + row count match.

- [ ] **Step 4: Commit**
  ```
  chore(migration): preflight check + backup before ict_budget data port
  ```

## Task 9.5: Harden `MigrateIctBudgetData` migration

**Files:**
- Modify: `apps/backend/src/database/migrations/1776000300000-MigrateIctBudgetData.ts`

- [ ] **Step 1: Tambah defensive guards**
  - Before INSERT: assert `ict_budgets_backup_1776000299000` exists → else throw.
  - Log `rowsInserted` dan `rowsSkipped` (yg skip karena status unknown).
  - Env flag `HARDWARE_MIGRATION_DRY_RUN=true` → jalankan dalam transaction yg di-rollback.

- [ ] **Step 2: Status mapping eksplisit**
  Tabel mapping `legacy_status` → `RequestStatus`. Default bukan `CANCELLED` — default `DRAFT` + log WARN agar admin tinjau manual.

- [ ] **Step 3: Tulis verifier script**
  `apps/backend/scripts/verify-hardware-migration.ts` — query `SELECT COUNT(*) FROM hardware_requests WHERE legacy_ict_budget_id IS NOT NULL` vs backup count → harus match.

- [ ] **Step 4: Commit**
  ```
  chore(migration): harden ict_budget data port with logs + dry-run
  ```

## Task 9.6: RBAC pada `hardware-activity.controller.ts`

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts` (jika perlu scope support)
- Create: `apps/backend/src/modules/hardware-request/presentation/__tests__/hardware-activity.rbac.spec.ts`

- [ ] **Step 1: Tambah guard + scope cek**
  Endpoint `GET /hardware-requests/:id/activity`:
  - `@UseGuards(JwtAuthGuard, HardwareRoleGuard)` dengan `@Scope('view-activity')`.
  - Service cek: user adalah requester OR approver OR ict-member OR admin. Else `ForbiddenException`.

- [ ] **Step 2: Test matriks**
  - Requester bukan owner → 403
  - Random user → 403
  - Admin → 200
  - Approver di SDM untuk site tsb → 200

- [ ] **Step 3: Commit**
  ```
  fix(security): scope-based RBAC on hardware activity endpoint
  ```

## Task 9.7: Rate limit sensitive endpoints

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`

- [ ] **Step 1: Pasang `@Throttle` pada endpoint mutasi**
  - `POST /hardware-requests` (submit): 10/min/user
  - `POST /hardware-requests/:id/approve|reject`: 30/min/user
  - `POST /installation/barcode`: 60/min/technician (scanning cepat)

- [ ] **Step 2: Pasang `@SkipThrottle` pada read endpoints** jika project-wide Throttler aktif.

- [ ] **Step 3: Test integration**
  Hit 11 submit cepat → 429 di submit ke-11.

- [ ] **Step 4: Commit**
  ```
  fix(security): throttle hardware-request mutation endpoints
  ```

## Task 9.8: Secret scan + `.env.example` audit

- [ ] **Step 1: Scan repo**
  ```bash
  grep -rnE "sk_live|sk_test|password.*=.*['\"][^'\"]{8,}" apps/backend apps/frontend --include="*.ts" --include="*.tsx" --include="*.env*"
  ```
  Expected: 0 hits (kecuali `.env.example` placeholder yang obvious).

- [ ] **Step 2: `.env.example` lengkap**
  Pastikan semua var yg dipakai HR module tercatat: `JWT_SECRET`, `WS_CORS_ORIGIN`, `WS_JWT_SECRET` (atau reuse), `SMTP_*`, `HARDWARE_MIGRATION_DRY_RUN`.

- [ ] **Step 3: Commit**
  ```
  chore(security): audit secrets + complete .env.example for HR module
  ```

## Task 9.9: OWASP checklist review

- [ ] **Step 1: Cek input validation**
  Semua DTO pakai `class-validator`. Verifikasi file-by-file di `dto/`.

- [ ] **Step 2: Cek output sanitization**
  Template email `handlebars` harus pakai `{{var}}` (escaped), bukan `{{{var}}}` (raw) pada user-input (reason, comment).

- [ ] **Step 3: Cek auth pada setiap endpoint**
  `grep -rn "@Controller\|@Get\|@Post\|@Put\|@Delete\|@Patch" apps/backend/src/modules/hardware-request/presentation` — cocokkan setiap endpoint punya guard.

- [ ] **Step 4: Dokumen security-review.md**
  Tulis `docs/superpowers/security-review-hardware-request.md` ringkas — daftar temuan + resolusi.

- [ ] **Step 5: Commit**
  ```
  docs(security): OWASP review notes for hardware-request module
  ```

---

## Acceptance Criteria

- [ ] `WS_CORS_ORIGIN` wajib di production — boot gagal jika kosong
- [ ] WS tanpa JWT token valid: disconnect (test)
- [ ] WS subscribe ke `request:<id>` yang bukan milik user: ditolak (test)
- [ ] `GET /ict-budget/*` return 308 dengan Location header benar
- [ ] Migration 1776000299000 bikin backup table + abort jika site_id null
- [ ] Activity endpoint tolak user tanpa scope (test)
- [ ] Endpoint mutasi HR rate-limited (test: 11 hit cepat → 429)
- [ ] Handlebars tidak ada raw `{{{...}}}` pada user-controlled input
- [ ] `docs/superpowers/security-review-hardware-request.md` ada + listing temuan

## Dependencies

- Plan 8 **harus** selesai sebelum Task 9.3 (redirect controller conflict dengan IctBudgetModule kalau masih hidup).
- `JwtModule` sudah terdaftar di `AuthModule` root — reuse.

## Out of Scope

- Coverage 80%+ → Plan 10
- E2E smoke → Plan 10
- Refactor besar RBAC system — pakai mekanisme existing dulu.
