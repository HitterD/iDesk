# Hardware Request — Plan 10: Quality, Coverage & E2E Smoke

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naikkan coverage backend + frontend HR module ke ≥80%, tambah ErrorBoundary wrap pada 3 halaman ICT, bangun E2E smoke matrix untuk happy path end-to-end, jalankan dependency audit yang dilewat di Plan 6.0/7.0, dan pasang CI gate.

**Context gap (audit 2026-04-18):**
- Backend: 15 spec file, beberapa service utama belum ada test (`hardware-request-query.service`, `installation-schedule.service` confirm/reschedule edge, redirect controller).
- Frontend: hanya 3 test (`StatusPipeline.test.tsx`, `RejectDialog.test.tsx`, `aging.util.test.ts`). Target ≥80% jauh dari tercapai. CreateWizard, CompleteInstallWizard, EventPopover, useHardwareRequestRealtime belum ada test.
- ErrorBoundary tidak membungkus `InstallationCalendarPage`, `HardwareDashboardPage`, `CatalogAdminPage` — error di third-party lib (FullCalendar/ZXing) crash seluruh app shell.
- E2E smoke matrix (Plan 7.24) absen — tidak ada Playwright/Cypress spec yang cover submit→approve→schedule→install→complete.
- Dependency audit Plan 6.0/7.0 tidak terdokumentasi — tidak ada bukti version compatibility check.

**Scope:** Test, test, test + E2E + ErrorBoundary + audit doc + CI gate. Zero production logic addition.

**Tech Stack:** Jest (backend), Vitest + React Testing Library (frontend), Playwright (E2E), GitHub Actions.

---

## Files in this plan

### Create — backend tests
- `apps/backend/src/modules/hardware-request/services/__tests__/hardware-request-query.service.spec.ts`
- `apps/backend/src/modules/hardware-request/services/__tests__/installation-schedule.service.edge.spec.ts`
- `apps/backend/src/modules/hardware-request/services/__tests__/hardware-catalog.service.crud.spec.ts`
- `apps/backend/src/modules/hardware-request/services/__tests__/hardware-dashboard.service.spec.ts`
- `apps/backend/src/modules/hardware-request/domain/__tests__/request-number.service.spec.ts`
- `apps/backend/test/hr-e2e-smoke.integration.spec.ts` (nest integration)

### Create — frontend tests
- `apps/frontend/src/features/hardware-request/components/create/__tests__/CreateWizard.test.tsx`
- `apps/frontend/src/features/hardware-request/components/create/__tests__/RequiredFieldsForm.test.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/__tests__/ActionPanel.test.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/__tests__/ProcurementPanel.test.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/__tests__/ActivityTimeline.test.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/__tests__/EventPopover.test.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/__tests__/UnscheduledList.test.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/__tests__/CompleteInstallWizard.test.tsx`
- `apps/frontend/src/features/hardware-request/hooks/__tests__/useHardwareRequestRealtime.test.ts`
- `apps/frontend/src/features/hardware-request/hooks/__tests__/useHardwareMutations.test.ts`
- `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`
- `apps/frontend/src/features/hardware-request/utils/__tests__/status.util.test.ts`

### Create — Playwright E2E
- `e2e/hardware-request/submit-approve-flow.spec.ts`
- `e2e/hardware-request/schedule-install-complete.spec.ts`
- `e2e/hardware-request/catalog-admin.spec.ts`
- `e2e/hardware-request/dashboard-smoke.spec.ts`
- `e2e/fixtures/hardware-request.fixture.ts`
- `e2e/playwright.config.ts` (jika belum ada)

### Create — ErrorBoundary wrapper
- `apps/frontend/src/features/hardware-request/components/common/FeatureErrorBoundary.tsx`

### Create — docs
- `docs/superpowers/dependency-audit-hardware-request.md`

### Modify
- `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx` — wrap dengan FeatureErrorBoundary
- `apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx` — wrap
- `apps/frontend/src/features/hardware-request/components/catalog/CatalogAdminPage.tsx` — wrap
- `apps/backend/package.json` — tambah script `test:coverage:hr`
- `apps/frontend/package.json` — tambah script `test:coverage:hr`
- `.github/workflows/ci.yml` atau equivalent — tambah job HR coverage gate + E2E

---

## Task 10.0: Baseline coverage report

- [ ] **Step 1: Generate coverage backend**
  ```bash
  cd apps/backend && pnpm test --coverage --testPathPattern=hardware-request
  ```
  Simpan hasil di `coverage-baseline-backend.txt`.

- [ ] **Step 2: Generate coverage frontend**
  ```bash
  cd apps/frontend && pnpm test --coverage features/hardware-request
  ```
  Simpan baseline.

- [ ] **Step 3: Target audit**
  Catat file mana yang <80% → prioritas test berikutnya.

## Task 10.1: Backend — test untuk `hardware-request-query.service`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/__tests__/hardware-request-query.service.spec.ts`

- [ ] **Step 1: Test skeleton**
  Mock repository. Cover: `findById`, `findByNumber`, `list` dengan filter (status, site, requester, aging bucket, pagination).

- [ ] **Step 2: Edge cases**
  - Request tidak ditemukan → `NotFoundException`
  - Pagination offset melebihi total → empty array
  - Filter combined (status + site + aging) → correct WHERE

- [ ] **Step 3: Jalankan + commit**
  ```
  test(backend): coverage for hardware-request-query.service
  ```

## Task 10.2: Backend — test edge `installation-schedule.service`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/__tests__/installation-schedule.service.edge.spec.ts`

- [ ] **Step 1: Edge cases**
  - `confirm` saat status bukan PROPOSED → `DomainError`
  - `reschedule` setelah `started_at` → `DomainError`
  - `propose` dengan technician_id dari site berbeda → validate error
  - Partial unique index konflik (2 schedule aktif di 1 request) → DB error propagate clean
  - `calendar` dengan range 0 day → empty array

- [ ] **Step 2: Commit**
  ```
  test(backend): edge-case coverage for installation-schedule service
  ```

## Task 10.3: Backend — tambahan service tests

**Files:**
- Create: `hardware-catalog.service.crud.spec.ts`
- Create: `hardware-dashboard.service.spec.ts`
- Create: `request-number.service.spec.ts`

- [ ] **Step 1: Catalog CRUD**
  Cover `createCatalog`, `updateCatalog`, `deleteCatalog` + soft-delete semantic jika ada, list filter `active/all`.

- [ ] **Step 2: Dashboard aggregation**
  Stub repository; assert query builder output untuk KPI, donut, aging buckets, weekly strip, workload. Verify timezone handling jika pakai `date-fns-tz`.

- [ ] **Step 3: Request number generator**
  Test format `HR-YYYYMM-####` (atau format project). Concurrency test: 50 parallel call → 50 unique number (bila pakai advisory lock).

- [ ] **Step 4: Commit**
  ```
  test(backend): coverage for catalog, dashboard, request-number services
  ```

## Task 10.4: Backend — integration E2E happy path

**Files:**
- Create: `apps/backend/test/hr-e2e-smoke.integration.spec.ts`

- [ ] **Step 1: Full lifecycle dalam satu test**
  1. Login user `requester` → create request
  2. Login user `sdm-head` → approve
  3. Login user `procurement` → mark done
  4. Login user `ict-lead` → propose schedule
  5. Login user `requester` → confirm schedule
  6. Login user `ict-tech` → start + barcode scan + complete
  7. GET detail → status `INSTALLED`, ada installation_schedule completed, ada hardware_asset attached

- [ ] **Step 2: Gunakan TestingModule + in-memory atau test DB**
  Isolate dengan transaction rollback per test.

- [ ] **Step 3: Commit**
  ```
  test(backend): integration E2E happy path for hardware request lifecycle
  ```

## Task 10.5: Frontend — `FeatureErrorBoundary` component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/common/FeatureErrorBoundary.tsx`

- [ ] **Step 1: Implementation**
  React class component `componentDidCatch`. Fallback UI: SectionCard dengan ikon + pesan "Terjadi kesalahan pada halaman ini" + tombol "Coba lagi" yang reset state. Log error ke console + (opsional) `/api/client-errors` endpoint.

- [ ] **Step 2: Test**
  Render `<FeatureErrorBoundary><BrokenChild/></FeatureErrorBoundary>` — assert fallback UI. Click "Coba lagi" → re-render child.

- [ ] **Step 3: Commit**
  ```
  feat(frontend): FeatureErrorBoundary for hardware-request pages
  ```

## Task 10.6: Wrap 3 halaman ICT dengan ErrorBoundary

**Files:**
- Modify: `InstallationCalendarPage.tsx`, `HardwareDashboardPage.tsx`, `CatalogAdminPage.tsx`

- [ ] **Step 1: Wrap root return**
  ```tsx
  return <FeatureErrorBoundary><...existing...></FeatureErrorBoundary>
  ```

- [ ] **Step 2: Test regression**
  Run existing tests — pastikan selector tetap match (ErrorBoundary transparent saat no error).

- [ ] **Step 3: Commit**
  ```
  fix(frontend): wrap ICT pages with FeatureErrorBoundary
  ```

## Task 10.7: Frontend — tests untuk CreateWizard + form

**Files:**
- Create: `CreateWizard.test.tsx`, `RequiredFieldsForm.test.tsx`

- [ ] **Step 1: CreateWizard flow**
  - Langkah 1 (pilih catalog) → langkah 2 (required fields dinamis) → langkah 3 (justification) → submit
  - Validasi: tidak bisa next jika required field kosong
  - Submit mock API → redirect to detail page

- [ ] **Step 2: RequiredFieldsForm**
  Schema dari catalog bervariasi (text/number/select). Render sesuai tipe. Error message muncul saat blur tanpa input.

- [ ] **Step 3: Commit**
  ```
  test(frontend): CreateWizard + RequiredFieldsForm coverage
  ```

## Task 10.8: Frontend — tests detail panel

**Files:**
- Create: `ActionPanel.test.tsx`, `ProcurementPanel.test.tsx`, `ActivityTimeline.test.tsx`

- [ ] **Step 1: ActionPanel**
  Cek tombol muncul sesuai role + status:
  - requester + DRAFT → "Submit", "Cancel"
  - approver + SUBMITTED → "Approve", "Reject"
  - procurement + APPROVED → "Mark procurement done"
  Disable jika tidak berwenang.

- [ ] **Step 2: ProcurementPanel**
  Mode edit untuk procurement officer. Validasi supplier, po_number, cost.

- [ ] **Step 3: ActivityTimeline**
  Render list activity + filter (comment/status-change/schedule-event). Virtual scroll jika >50 item.

- [ ] **Step 4: Commit**
  ```
  test(frontend): detail-page panels coverage
  ```

## Task 10.9: Frontend — realtime + mutation hooks

**Files:**
- Create: `useHardwareRequestRealtime.test.ts`, `useHardwareMutations.test.ts`

- [ ] **Step 1: Realtime**
  Mock socket.io-client. Test: subscribe dipanggil saat mount, unsubscribe saat unmount. Event `request.updated` → invalidate query cache.

- [ ] **Step 2: Mutations**
  Mock axios. Test: optimistic update, rollback on error, toast on success. Invalidation key benar.

- [ ] **Step 3: Commit**
  ```
  test(frontend): realtime + mutation hooks coverage
  ```

## Task 10.10: Frontend — utils coverage

**Files:**
- Create: `permission.util.test.ts`, `status.util.test.ts`

- [ ] **Step 1: permission.util**
  Matrix lengkap role × status × action. Minimal 12 assertion.

- [ ] **Step 2: status.util**
  Label, color, next-statuses untuk tiap `RequestStatus` enum value.

- [ ] **Step 3: Commit**
  ```
  test(frontend): utils coverage to 100%
  ```

## Task 10.11: Playwright E2E setup

**Files:**
- Create: `e2e/playwright.config.ts` (jika belum ada)
- Create: `e2e/fixtures/hardware-request.fixture.ts`

- [ ] **Step 1: Config**
  Target `baseURL: http://localhost:5173`. Webserver auto-start backend + frontend. Project matrix: chromium only (smoke).

- [ ] **Step 2: Fixture**
  Helper: login-as-role, seed-request, cleanup-request (via backend admin endpoint atau DB direct).

- [ ] **Step 3: Commit**
  ```
  chore(e2e): playwright config + HR fixtures
  ```

## Task 10.12: E2E — submit→approve

**Files:**
- Create: `e2e/hardware-request/submit-approve-flow.spec.ts`

- [ ] **Step 1: Skrip**
  - Login requester → klik "New Request" → pilih catalog → isi required fields → submit
  - Assert toast + redirect ke detail + status `SUBMITTED`
  - Logout → login approver → open detail → klik Approve → komentar → confirm
  - Assert status `APPROVED`

- [ ] **Step 2: Commit**
  ```
  test(e2e): hardware request submit + approve
  ```

## Task 10.13: E2E — schedule→install→complete + barcode

**Files:**
- Create: `e2e/hardware-request/schedule-install-complete.spec.ts`

- [ ] **Step 1: Skrip**
  - Dari APPROVED + procurement done → ICT propose schedule → requester confirm
  - Login technician → open calendar → klik event → Start
  - Barcode: pakai `BarcodeInputFallback` (manual input) agar headless E2E stabil — input 5 barcode
  - Complete wizard: attach asset → finish
  - Assert status `INSTALLED`, asset terdaftar

- [ ] **Step 2: Commit**
  ```
  test(e2e): schedule + install + barcode flow
  ```

## Task 10.14: E2E — catalog admin + dashboard

**Files:**
- Create: `catalog-admin.spec.ts`, `dashboard-smoke.spec.ts`

- [ ] **Step 1: Catalog admin**
  Login admin → buat catalog baru dengan required field schema → simpan → muncul di list → edit → nonaktifkan → tidak muncul di CreateWizard.

- [ ] **Step 2: Dashboard smoke**
  Login ICT lead → buka dashboard → assert KPI card angka >0 setelah seed → donut chart render → aging table render (min 1 row setelah seed aged).

- [ ] **Step 3: Commit**
  ```
  test(e2e): catalog admin + dashboard smoke
  ```

## Task 10.15: Dependency audit dokumen

**Files:**
- Create: `docs/superpowers/dependency-audit-hardware-request.md`

- [ ] **Step 1: Inventaris**
  Backend: socket.io, class-validator, class-transformer, typeorm, handlebars, nestjs-schedule. Frontend: @fullcalendar/*, @zxing/browser, recharts, @tanstack/react-query, socket.io-client, date-fns, zod.

- [ ] **Step 2: Version pin + latest check**
  ```bash
  pnpm outdated --filter=backend
  pnpm outdated --filter=frontend
  ```
  Catat: versi current, versi latest stable, breaking change risk.

- [ ] **Step 3: Security audit**
  ```bash
  pnpm audit --prod
  ```
  Catat high/critical. Bila ada, plan remediation.

- [ ] **Step 4: Commit**
  ```
  docs: dependency audit for hardware-request module
  ```

## Task 10.16: CI gate

**Files:**
- Modify: `.github/workflows/ci.yml` (atau buat jika belum ada)

- [ ] **Step 1: Job `hr-backend-coverage`**
  Jalankan `pnpm --filter backend test --coverage --testPathPattern=hardware-request`. Fail jika line coverage <80%.

- [ ] **Step 2: Job `hr-frontend-coverage`**
  Jalankan Vitest coverage. Fail <80%.

- [ ] **Step 3: Job `hr-e2e`**
  Boot docker-compose (DB), build + start backend + frontend, run Playwright.

- [ ] **Step 4: Artifacts**
  Upload Playwright traces + HTML report sebagai artifacts on failure.

- [ ] **Step 5: Commit**
  ```
  ci: coverage + E2E gate for hardware-request module
  ```

## Task 10.17: Final report

- [ ] **Step 1: Re-run full coverage**
  ```bash
  cd apps/backend && pnpm test --coverage --testPathPattern=hardware-request
  cd ../frontend && pnpm test --coverage features/hardware-request
  ```

- [ ] **Step 2: Update `docs/superpowers/specs/.../quality-report.md`**
  Tabel: modul × baseline × final × target. Rata-rata ≥80%.

- [ ] **Step 3: Commit**
  ```
  docs: final quality report for hardware-request rework
  ```

---

## Acceptance Criteria

- [ ] Backend HR module line coverage ≥80%
- [ ] Frontend HR module line coverage ≥80%
- [ ] 4 E2E spec hijau (submit-approve, schedule-install, catalog-admin, dashboard-smoke)
- [ ] 3 halaman ICT dibungkus `FeatureErrorBoundary`
- [ ] `docs/superpowers/dependency-audit-hardware-request.md` ada + listing lengkap
- [ ] CI job `hr-backend-coverage`, `hr-frontend-coverage`, `hr-e2e` ada + gating PR
- [ ] `pnpm audit` high/critical = 0 pada dependency HR
- [ ] Quality report dokumen final

## Dependencies

- Plan 8 & Plan 9 selesai (E2E flow butuh WS auth + legacy bersih)
- Seed data / fixtures tersedia di test env

## Out of Scope

- Perf/load testing → future plan
- A11y audit → future plan
- i18n audit → future plan
