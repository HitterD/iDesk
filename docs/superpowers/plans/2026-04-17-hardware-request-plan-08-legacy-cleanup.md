# Hardware Request — Plan 8: Legacy Cleanup (ict-budget removal + stale HardwareInstallation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus total modul `ict-budget` backend + halaman/komponen `HardwareInstallation` frontend + file duplikat yang masih tersisa dari Plan 01–07. Cegah crash startup setelah migrasi `DropIctBudget` jalan di environment bersih.

**Context gap (audit 2026-04-18):**
- `apps/backend/src/modules/ict-budget/` masih ada → `app.module.ts:77,209` masih register `IctBudgetModule`. Tabel `ict_budgets` sudah di-drop via migration `1776000300500-DropIctBudget.ts` → TypeORM schema sync = crash.
- `ict-budget.module.ts:9` import `../ticketing/entities/installation-schedule.entity` (stale path, sudah di-port ke `hardware-request/domain/entities/installation-schedule.entity.ts` di Plan 3).
- Frontend legacy routes `AppRoutes.tsx:168,169,273` + sidebar `BentoSidebar.tsx:231` masih tunjuk `pages/HardwareInstallation/*`.
- Duplikat cron file: `modules/hardware-request/cron/aging-reminder.cron.ts` **dan** `modules/hardware-request/listeners/aging-reminder.cron.ts`. Module hanya refer ke `listeners/` variant → `cron/` file dead code.
- Route block di `AppRoutes.tsx` tercopy 3x (l.189–194, 232–237, 267–272).

**Scope:** Strictly deletion + re-wiring. Zero feature addition. Setiap delete diverifikasi via regression test: build clean + app boot OK + dropped routes return 404.

**Tech Stack:** NestJS v10, TypeORM, React 18, Vite, React Router v6, Vitest.

---

## Files in this plan

### Delete (backend)
- `apps/backend/src/modules/ict-budget/` (seluruh dir: module, service, controller, entities, listeners, tests)
- `apps/backend/src/modules/hardware-request/cron/aging-reminder.cron.ts` (duplikat — listeners variant tetap)
- `apps/backend/src/modules/hardware-request/cron/` dir (jika jadi kosong)
- `apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts` (sudah dipindah ke hardware-request)

### Delete (frontend)
- `apps/frontend/src/pages/HardwareInstallation/` (semua file)
- `apps/frontend/src/components/HardwareInstallation/` (semua file)
- `apps/frontend/src/features/hardware-request/routes.tsx` (stub duplikat — konsolidasi ke AppRoutes)

### Modify (backend)
- `apps/backend/src/app.module.ts` — hapus import + providers entry `IctBudgetModule` (l.77, l.209)
- `apps/backend/src/modules/ticketing/ticketing.module.ts` — hapus registrasi entity `InstallationSchedule` (jika ada)
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` — verifikasi cron path (harus `./listeners/aging-reminder.cron`)

### Modify (frontend)
- `apps/frontend/src/app/AppRoutes.tsx` — hapus 3 legacy routes + dedupe 3 duplikat blok HR routes
- `apps/frontend/src/components/layout/BentoSidebar.tsx` — hapus entry legacy HardwareInstallation (l.231)

### Create (tests)
- `apps/backend/test/legacy-removal.integration.spec.ts` — confirm `/ict-budget/*` return 404 + app boot OK
- `apps/frontend/src/__tests__/legacy-routes.test.tsx` — confirm legacy paths redirect/404

---

## Task 8.0: Snapshot baseline & verify migration applied

**Files:**
- Read only

- [ ] **Step 1: Konfirmasi migration 1776000300500 sudah jalan di dev/staging**
  ```bash
  cd apps/backend && pnpm typeorm migration:show -- -d src/data-source.ts
  ```
  Cari tanda `[X]` di `DropIctBudget1776000300500`. Jika belum: jalankan migrasi dulu, backup DB.

- [ ] **Step 2: Grep seluruh referensi `ict-budget` + `HardwareInstallation` (non-hardware-request)**
  ```bash
  grep -rn "ict-budget\|IctBudget\|HardwareInstallation" apps/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|modules/hardware-request"
  ```
  Catat baseline — akan jadi 0 hits setelah plan selesai.

- [ ] **Step 3: Snapshot test run hijau**
  ```bash
  cd apps/backend && pnpm test
  cd ../frontend && pnpm test
  ```
  Pastikan semua test baseline pass sebelum delete.

## Task 8.1: Hapus registrasi `IctBudgetModule` dari `app.module.ts`

**Files:**
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Hapus import line**
  Hapus `import { IctBudgetModule } from './modules/ict-budget/ict-budget.module';` (sekitar l.77).

- [ ] **Step 2: Hapus entry di imports array**
  Hapus `IctBudgetModule,` di dalam `@Module({ imports: [...] })` (sekitar l.209).

- [ ] **Step 3: Build**
  ```bash
  cd apps/backend && pnpm build
  ```
  Expected: success (karena modul masih ada di disk, import file-nya masih resolvable sampai Task 8.2).

- [ ] **Step 4: Commit**
  ```
  refactor(backend): unregister IctBudgetModule from app.module
  ```

## Task 8.2: Delete dir `modules/ict-budget/`

**Files:**
- Delete: `apps/backend/src/modules/ict-budget/`

- [ ] **Step 1: Hapus seluruh folder**
  ```bash
  rm -rf apps/backend/src/modules/ict-budget
  ```

- [ ] **Step 2: Grep untuk sisa reference**
  ```bash
  grep -rn "ict-budget\|IctBudget" apps/backend/src --include="*.ts"
  ```
  Expected: 0 hits.

- [ ] **Step 3: Build + unit tests**
  ```bash
  cd apps/backend && pnpm build && pnpm test
  ```
  Expected: hijau.

- [ ] **Step 4: Commit**
  ```
  refactor(backend): delete legacy ict-budget module
  ```

## Task 8.3: Hapus stale `installation-schedule.entity.ts` di ticketing

**Files:**
- Delete: `apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts`
- Modify: `apps/backend/src/modules/ticketing/ticketing.module.ts` (jika mendaftarkan entity ini)

- [ ] **Step 1: Cek referensi runtime**
  ```bash
  grep -rn "ticketing/entities/installation-schedule" apps/backend/src
  ```
  Jika ada referensi di `ict-budget` — sudah hilang via Task 8.2. Jika ada di `ticketing.module.ts` → hapus.

- [ ] **Step 2: Delete file**
  ```bash
  rm apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts
  ```

- [ ] **Step 3: Verify**
  ```bash
  cd apps/backend && pnpm build
  ```

- [ ] **Step 4: Commit**
  ```
  refactor(backend): remove stale ticketing InstallationSchedule entity
  ```

## Task 8.4: Hapus duplikat cron file hardware-request

**Files:**
- Delete: `apps/backend/src/modules/hardware-request/cron/aging-reminder.cron.ts`
- Possibly delete: `apps/backend/src/modules/hardware-request/cron/` (jika kosong)

- [ ] **Step 1: Verify listeners path aktif**
  ```bash
  grep -n "aging-reminder" apps/backend/src/modules/hardware-request/hardware-request.module.ts
  ```
  Expected path: `./listeners/aging-reminder.cron`. Jika path berbeda — perbaiki dulu.

- [ ] **Step 2: Delete duplicate**
  ```bash
  rm apps/backend/src/modules/hardware-request/cron/aging-reminder.cron.ts
  rmdir apps/backend/src/modules/hardware-request/cron 2>/dev/null || true
  ```

- [ ] **Step 3: Build + cron spec run**
  ```bash
  cd apps/backend && pnpm build && pnpm test --testPathPattern=aging-reminder
  ```

- [ ] **Step 4: Commit**
  ```
  refactor(backend): remove duplicate aging-reminder.cron (keep listeners variant)
  ```

## Task 8.5: Integration test legacy routes → 404

**Files:**
- Create: `apps/backend/test/legacy-removal.integration.spec.ts`

- [ ] **Step 1: Bootstrap Nest test app + hit old endpoints**
  Gunakan supertest. Cek endpoint `/ict-budget`, `/ict-budget/123`, `/ict-budget/approve` dsb. harus return **404**. Cek `/hardware-requests` return **200**.

- [ ] **Step 2: Tambahkan boot smoke assertion**
  App instantiation tidak lempar `EntityMetadataNotFoundError` atau `MissingSchemaError`.

- [ ] **Step 3: Run**
  ```bash
  cd apps/backend && pnpm test --testPathPattern=legacy-removal
  ```

- [ ] **Step 4: Commit**
  ```
  test(backend): legacy ict-budget routes return 404
  ```

## Task 8.6: Frontend — hapus legacy HardwareInstallation routes

**Files:**
- Modify: `apps/frontend/src/app/AppRoutes.tsx`
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx`

- [ ] **Step 1: Hapus 3 route entries**
  Hapus baris yang `import` + `<Route>` untuk `pages/HardwareInstallation/*` (sekitar AppRoutes.tsx l.168,169,273).

- [ ] **Step 2: Hapus sidebar entry**
  Hapus item label "Hardware Installation" di `BentoSidebar.tsx:231`.

- [ ] **Step 3: Verify build + typecheck**
  ```bash
  cd apps/frontend && pnpm build
  ```

- [ ] **Step 4: Commit**
  ```
  refactor(frontend): remove legacy HardwareInstallation routes + sidebar
  ```

## Task 8.7: Delete legacy frontend dirs

**Files:**
- Delete: `apps/frontend/src/pages/HardwareInstallation/`
- Delete: `apps/frontend/src/components/HardwareInstallation/`

- [ ] **Step 1: Delete**
  ```bash
  rm -rf apps/frontend/src/pages/HardwareInstallation
  rm -rf apps/frontend/src/components/HardwareInstallation
  ```

- [ ] **Step 2: Grep residu**
  ```bash
  grep -rn "HardwareInstallation" apps/frontend/src
  ```
  Expected: 0 hits (kecuali string label jika ada di i18n — verifikasi).

- [ ] **Step 3: Build + test**
  ```bash
  cd apps/frontend && pnpm build && pnpm test
  ```

- [ ] **Step 4: Commit**
  ```
  refactor(frontend): delete legacy HardwareInstallation pages + components
  ```

## Task 8.8: Dedupe `AppRoutes.tsx` — satu blok HR routes

**Files:**
- Modify: `apps/frontend/src/app/AppRoutes.tsx`
- Delete: `apps/frontend/src/features/hardware-request/routes.tsx` (stub)

- [ ] **Step 1: Identifikasi 3 duplikat block**
  Blok HR routes copy di l.189–194, 232–237, 267–272. Tentukan satu blok kanonik (biasanya di bawah path `/hardware-requests`).

- [ ] **Step 2: Ekstrak ke fungsi/array config**
  Bikin const `hardwareRequestRoutes: RouteObject[]` lalu spread ke tempat yang butuh. ATAU: pindahkan semua ke satu parent `<Route path="/hardware-requests">` dengan child routes.

- [ ] **Step 3: Hapus 2 blok duplikat**
  Sisakan 1 blok.

- [ ] **Step 4: Hapus stub `features/hardware-request/routes.tsx`**
  ```bash
  rm apps/frontend/src/features/hardware-request/routes.tsx
  ```

- [ ] **Step 5: Test navigasi**
  ```bash
  cd apps/frontend && pnpm test --run
  ```
  Pastikan `RequestListPage`, `RequestCreatePage`, `RequestDetailPage`, `InstallationCalendarPage`, `HardwareDashboardPage`, `CatalogAdminPage` masih reachable.

- [ ] **Step 6: Commit**
  ```
  refactor(frontend): dedupe hardware-request route blocks in AppRoutes
  ```

## Task 8.9: Frontend regression test — legacy path 404

**Files:**
- Create: `apps/frontend/src/__tests__/legacy-routes.test.tsx`

- [ ] **Step 1: Test MemoryRouter dengan path `/hardware-installation`**
  Render `<AppRoutes />` lewat `MemoryRouter initialEntries={['/hardware-installation']}`. Assert fallback / NotFound element muncul.

- [ ] **Step 2: Test `/hardware-requests/calendar` masih render**
  Sanity check kanonik route tetap jalan.

- [ ] **Step 3: Run**
  ```bash
  cd apps/frontend && pnpm test legacy-routes
  ```

- [ ] **Step 4: Commit**
  ```
  test(frontend): legacy HardwareInstallation routes yield 404
  ```

## Task 8.10: Final verification

- [ ] **Step 1: Full grep zero hits**
  ```bash
  grep -rn "ict-budget\|IctBudget\|HardwareInstallation" apps/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|hardware-request\|docs/"
  ```
  Expected: empty.

- [ ] **Step 2: Full build + test suite**
  ```bash
  cd apps/backend && pnpm build && pnpm test
  cd ../frontend && pnpm build && pnpm test
  ```

- [ ] **Step 3: Manual boot on clean DB**
  Drop dev DB, run all migrations, boot backend. Verifikasi log tidak ada `Entity metadata for ict_budgets was not found`.

- [ ] **Step 4: Commit + PR**
  ```
  chore: finalize legacy cleanup for hardware-request rework
  ```

---

## Acceptance Criteria

- [ ] 0 kejadian `IctBudget`/`ict-budget` di `apps/backend/src` (di luar docs)
- [ ] 0 kejadian `HardwareInstallation` di `apps/frontend/src/pages` dan `apps/frontend/src/components` (kecuali `hardware-request/` feature dir)
- [ ] App backend boot clean di DB fresh (semua migrasi + 0 TypeORM metadata error)
- [ ] Endpoint `/ict-budget/*` return 404 (test otomatis)
- [ ] Route frontend `/hardware-installation*` return NotFound (test otomatis)
- [ ] Cron `aging-reminder` jalan tepat 1x per trigger (bukan 2x dari duplikat)
- [ ] `AppRoutes.tsx` hanya punya 1 blok HR routes
- [ ] Semua test existing tetap hijau

## Out of Scope (defer ke Plan 9 / 10)

- Deprecation redirect `/ict-budget/*` → `/hardware-requests/*` (Plan 9.3)
- Security hardening (Plan 9)
- Coverage 80% target (Plan 10)
