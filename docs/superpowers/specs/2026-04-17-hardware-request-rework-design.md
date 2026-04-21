# Hardware Request Rework — Design Spec

**Date:** 2026-04-17
**Status:** Approved (brainstorming phase)

> **Partial supersede 2026-04-19:** Section "User Roles" 3-tier (ICT_LEAD / ICT_PROCUREMENT / ICT_TECHNICIAN) digantikan satu role `ICT_STAFF`. Lihat `2026-04-19-hardware-request-bugfix-and-role-flatten-design.md`.
**Scope:** Rework total halaman `hardware-requests` dan `hardware-installation` dari list hingga detail, backend + frontend, untuk pemakaian ICT-only. Module `ict-budget` di-absorb. `installation-schedule` dimigrasi dari `ticketing` ke module baru.

---

## 1. Goals & Non-Goals

### Goals
- Satu module `hardware-request` yang mencakup seluruh lifecycle: request → review → approve → procurement → installation → completed.
- ICT adalah satu-satunya pengelola; user (requester) hanya men-submit dan melihat status.
- Three-tier internal role di ICT: **ICT_LEAD**, **ICT_PROCUREMENT**, **ICT_TECHNICIAN**.
- Mutual scheduling untuk instalasi (requester & technician saling propose/confirm) dengan kalender teknisi terpadu.
- Barcode asset tracking per item saat instalasi selesai.
- Dashboard analitik untuk ICT.
- Notifikasi in-app dan email di setiap transisi penting.

### Non-Goals
- Integrasi Procurement eksternal / vendor portal.
- Automated asset inventory (full CMDB) — cukup barcode + assigned_to.
- SLA config per kategori (tersedia sebagai future work, struktur data siap).
- Multi-tenant / multi-company.
- Approval multi-tahap (hanya satu approval oleh ICT_LEAD).

---

## 2. User Roles

| Role | Kemampuan |
|------|-----------|
| USER | Create & submit request, lihat request sendiri, cancel saat SUBMITTED, komentar, propose install schedule, confirm proposal technician. |
| ICT_LEAD | Lihat semua, review/approve/reject, manage catalog, lihat dashboard. |
| ICT_PROCUREMENT | Lihat semua, isi actual cost/vendor/invoice per item, mark procurement complete, komentar, lihat dashboard (read-only calendar). |
| ICT_TECHNICIAN | Lihat semua, propose/confirm/reschedule install, start/complete install, scan barcode, komentar, lihat calendar + dashboard. |

Visibility: USER hanya lihat requestnya sendiri. Semua role ICT lihat semua request.

---

## 3. Architecture

### Backend — `apps/backend/src/modules/hardware-request/`

```
hardware-request/
├── domain/
│   ├── entities/
│   │   ├── hardware-request.entity.ts
│   │   ├── hardware-request-item.entity.ts
│   │   ├── hardware-request-comment.entity.ts
│   │   ├── hardware-request-activity.entity.ts
│   │   ├── hardware-catalog.entity.ts
│   │   ├── hardware-asset.entity.ts
│   │   └── installation-schedule.entity.ts     (migrated from ticketing)
│   ├── enums/
│   │   ├── request-status.enum.ts
│   │   ├── item-category.enum.ts
│   │   └── install-status.enum.ts
│   └── events/
│       └── (submitted, status-changed, install-scheduled, commented, ...)
├── dto/
│   └── (create, update, approve, reject, procurement-update, schedule-install,
│        confirm-schedule, reschedule, barcode, complete-install, comment)
├── services/
│   ├── hardware-request-command.service.ts
│   ├── hardware-request-query.service.ts
│   ├── hardware-catalog.service.ts
│   ├── installation-schedule.service.ts
│   ├── hardware-asset.service.ts
│   └── hardware-dashboard.service.ts
├── listeners/
│   ├── email-notifier.listener.ts
│   └── in-app-notifier.listener.ts
├── presentation/
│   ├── hardware-request.controller.ts
│   ├── hardware-catalog.controller.ts
│   ├── installation.controller.ts
│   └── hardware-dashboard.controller.ts
├── guards/
│   └── hardware-role.guard.ts
└── hardware-request.module.ts
```

### Frontend — `apps/frontend/src/features/hardware-request/`

```
hardware-request/
├── api/
│   ├── hardware-request.api.ts
│   ├── catalog.api.ts
│   ├── installation.api.ts
│   └── dashboard.api.ts
├── hooks/
│   ├── useHardwareRequest.ts
│   ├── useHardwareRequestList.ts
│   ├── useInstallationCalendar.ts
│   ├── useHardwareRequestRealtime.ts
│   ├── usePermissions.ts
│   └── useCatalog.ts
├── pages/
│   ├── HardwareRequestListPage.tsx
│   ├── HardwareRequestCreatePage.tsx
│   ├── HardwareRequestDetailPage.tsx
│   ├── InstallationCalendarPage.tsx
│   ├── HardwareDashboardPage.tsx
│   └── CatalogAdminPage.tsx
├── components/
│   ├── list/RequestTable.tsx, RequestFilters.tsx, RequestCard.tsx
│   ├── create/CreateWizard.tsx, CatalogPicker.tsx, ItemBasket.tsx, ReviewStep.tsx
│   ├── detail/StatusPipeline.tsx, RequestInfoCard.tsx, ItemsCard.tsx,
│   │           CommentThread.tsx, ActivityTimeline.tsx, ActionPanel.tsx
│   ├── procurement/ProcurementPanel.tsx, InvoiceForm.tsx
│   ├── installation/InstallationScheduler.tsx, ScheduleProposeModal.tsx,
│   │                 BarcodeScanner.tsx, InstallProgressCard.tsx
│   ├── calendar/CalendarView.tsx, UnscheduledList.tsx, TechnicianFilter.tsx
│   └── dashboard/KpiCards.tsx, StatusDonut.tsx, AgingTable.tsx,
│                   TopCategoriesChart.tsx, WeeklyScheduleWidget.tsx,
│                   TechnicianWorkloadChart.tsx
├── types/
└── utils/
    ├── status.util.ts, aging.util.ts, permission.util.ts
```

### Migrasi
- Module `ict-budget` dihapus. Data existing (jika ada) di-migrate ke `hardware_request` + `hardware_request_item` via TypeORM migration.
- Entity `installation-schedule` dari `ticketing` dipindah ke `hardware-request`. File `ticketing/services/hardware-scheduler.service.ts` dan `listeners/installation-notification.listener.ts` di-port.
- Frontend `features/request-center/pages/HardwareRequest*.tsx` yang placeholder dihapus; folder baru `features/hardware-request/` berdiri sendiri.

---

## 4. Data Model

### `hardware_request`
- `id` uuid PK
- `request_number` varchar unique (format: `HR-YYYY-NNNN`, auto)
- `requester_id` FK users, not null
- `recipient_id` FK users, nullable (default requester_id)
- `site_id` FK sites, not null
- `justification` text, not null, min 20 char
- `status` enum RequestStatus, not null, default `DRAFT`
- `submitted_at`, `reviewed_at`, `approved_at`, `procured_at`, `installed_at`, `completed_at` timestamptz nullable
- `reviewed_by`, `approved_by`, `procured_by` FK users nullable
- `reject_reason` text nullable
- `version` int not null default 1 (optimistic lock)
- `created_at`, `updated_at` timestamptz

### `hardware_request_item`
- `id` uuid PK
- `request_id` FK hardware_request (cascade delete)
- `catalog_id` FK hardware_catalog nullable
- `category_snapshot` jsonb not null (freeze catalog state at submit)
- `quantity` int not null check >0
- `actual_cost` decimal(14,2) nullable
- `vendor` varchar(255) nullable
- `invoice_number` varchar(100) nullable
- `invoice_date` date nullable
- `notes` text nullable

### `hardware_catalog`
- `id` uuid PK
- `code` varchar unique (e.g. `LAPTOP_STD`, `MONITOR_24`)
- `name`, `category` enum ItemCategory (LAPTOP, MONITOR, ACCESSORY, NETWORK, SOFTWARE, OTHER)
- `default_specs` jsonb
- `required_fields` jsonb (schema for dynamic fields per category)
- `active` bool default true, `display_order` int
- `created_at`, `updated_at`

### `hardware_request_comment`
- `id` uuid PK
- `request_id` FK, `author_id` FK users
- `body` text not null
- `attachments` jsonb default '[]'
- `created_at`, `edited_at`, `deleted_at` timestamptz nullable

### `hardware_request_activity`
- `id` uuid PK
- `request_id` FK, `actor_id` FK users
- `action` enum ActivityAction
- `from_status`, `to_status` enum RequestStatus nullable
- `metadata` jsonb
- `created_at` timestamptz

### `installation_schedule`
- `id` uuid PK
- `request_id` FK hardware_request unique (1-to-1)
- `technician_id` FK users (ICT_TECHNICIAN)
- `scheduled_start`, `scheduled_end` timestamptz not null
- `status` enum InstallStatus (PROPOSED, CONFIRMED, IN_PROGRESS, DONE, RESCHEDULED, CANCELLED)
- `proposed_by` FK users, `confirmed_by` FK users nullable
- `location_detail` text nullable
- `started_at`, `completed_at` timestamptz nullable
- `created_at`, `updated_at`

### `hardware_asset`
- `id` uuid PK
- `item_id` FK hardware_request_item
- `barcode` varchar unique, indexed
- `assigned_to_user_id` FK users
- `installed_at` timestamptz, `installed_by` FK users
- `site_id` FK sites
- `created_at`

### Invariants
- 1 request wajib punya ≥1 item.
- `status=COMPLETED` butuh setiap quantity×item punya entry `hardware_asset` dengan barcode unik.
- `installation_schedule.status=CONFIRMED` wajib `confirmed_by ≠ proposed_by`.
- State transitions enforced di service layer (state machine guard).

### Indexes
- `hardware_request(status, created_at desc)`
- `hardware_request(requester_id, created_at desc)`
- `hardware_request_item(request_id)`
- `hardware_request_comment(request_id, created_at)`
- `installation_schedule(technician_id, scheduled_start)`
- `installation_schedule(status, scheduled_start)`
- `hardware_asset(barcode)` unique
- `hardware_asset(assigned_to_user_id)`

---

## 5. State Machine

### Request Status Transitions

| From | To | Trigger / Role | Guard |
|------|-----|----------------|-------|
| — | DRAFT | USER create | — |
| DRAFT | SUBMITTED | USER submit | ≥1 item, justification ≥20 char |
| SUBMITTED | CANCELLED | USER (requester) | status = SUBMITTED |
| SUBMITTED | UNDER_REVIEW | ICT_LEAD review | assigns self as reviewer |
| UNDER_REVIEW | APPROVED | ICT_LEAD approve | — |
| UNDER_REVIEW | REJECTED | ICT_LEAD reject | reject_reason not empty |
| APPROVED | PROCUREMENT | ICT_PROCUREMENT enter | auto pada edit pertama di procurement panel |
| PROCUREMENT | INSTALLATION | ICT_PROCUREMENT complete | semua item punya actual_cost, vendor, invoice_number |
| INSTALLATION | COMPLETED | ICT_TECHNICIAN complete | install_schedule.status=DONE, setiap quantity punya asset+barcode |

**Terminal:** REJECTED, CANCELLED, COMPLETED — immutable kecuali komentar tetap terbuka (ya, bahkan setelah terminal — untuk arsip).

**Backward transitions:** tidak ada di versi ini (YAGNI). Jika barang tidak tersedia saat PROCUREMENT, ICT berdiskusi di comment thread atau request baru.

### Installation Status Transitions

| From | To | Trigger |
|------|-----|---------|
| — | PROPOSED | USER or TECHNICIAN propose |
| PROPOSED | CONFIRMED | pihak lain confirm |
| PROPOSED | RESCHEDULED | salah satu pihak reschedule (create new PROPOSED) |
| CONFIRMED | IN_PROGRESS | TECHNICIAN start install |
| CONFIRMED | RESCHEDULED | reschedule sebelum start |
| IN_PROGRESS | DONE | TECHNICIAN complete (all items barcoded) |
| any non-terminal | CANCELLED | TECHNICIAN or LEAD (e.g. request cancelled — edge, tidak bisa terjadi di versi ini karena request cancel dibatasi SUBMITTED) |

---

## 6. Permissions

### Read

| Role | Request | Comment | Calendar | Dashboard | Catalog |
|------|---------|---------|----------|-----------|---------|
| USER | own | own | own installs | — | — |
| ICT_LEAD | all | all | all | ✓ | ✓ |
| ICT_PROCUREMENT | all | all | all (read) | ✓ | — |
| ICT_TECHNICIAN | all | all | all | ✓ | — |

### Write

| Action | USER | LEAD | PROC | TECH |
|--------|------|------|------|------|
| Create/edit DRAFT | own | — | — | — |
| Submit | own | — | — | — |
| Cancel (SUBMITTED) | own | — | — | — |
| Start review | — | ✓ | — | — |
| Approve | — | ✓ | — | — |
| Reject (with reason) | — | ✓ | — | — |
| Procurement fields | — | — | ✓ | — |
| Mark procurement complete | — | — | ✓ | — |
| Propose schedule | own | — | — | ✓ |
| Confirm / reschedule schedule | own (if counterpart) | — | — | ✓ |
| Start install | — | — | — | ✓ |
| Scan barcode | — | — | — | ✓ |
| Complete install | — | — | — | ✓ |
| Add comment | own requests | ✓ | ✓ | ✓ |
| Manage catalog | — | ✓ | — | — |

Enforcement: `HardwareRoleGuard` di controller + service-level `authorize(user, request, action)`.

---

## 7. API Contracts

**Prefix:** `/api/hardware-requests`

### Requests
- `POST /` create DRAFT — body: `{ site_id, recipient_id?, justification, items[] }`
- `GET /` list — query: `status[], category[], siteId, requesterId, scope=my|all, page, pageSize, search`
- `GET /:id` detail
- `PATCH /:id` edit (DRAFT only)
- `POST /:id/submit`
- `POST /:id/cancel`
- `POST /:id/review` (ICT_LEAD)
- `POST /:id/approve`
- `POST /:id/reject` body: `{ reason }`

### Items & Procurement
- `PATCH /:id/items/:itemId` body: `{ actual_cost?, vendor?, invoice_number?, invoice_date?, notes? }`
- `POST /:id/procurement/complete`

### Installation
- `POST /:id/schedule` body: `{ technician_id?, scheduled_start, scheduled_end, location_detail? }`
- `POST /:id/schedule/confirm`
- `POST /:id/schedule/reschedule` body: `{ scheduled_start, scheduled_end, reason? }`
- `POST /:id/install/start`
- `POST /:id/items/:itemId/barcode` body: `{ barcode }` → creates hardware_asset
- `POST /:id/install/complete`

### Comments
- `GET /:id/comments` (paginated)
- `POST /:id/comments` body: `{ body, attachments? }`
- `PATCH /:id/comments/:cid` (author, <15min)
- `DELETE /:id/comments/:cid` (author or LEAD, soft)

### Activity
- `GET /:id/activity`

### Catalog (ICT_LEAD)
- `GET /catalog?category=&active=`
- `POST /catalog`
- `PATCH /catalog/:id`
- `DELETE /catalog/:id` (soft: active=false)

### Calendar
- `GET /calendar?from=&to=&technicianId[]=&status[]=`

### Dashboard
- `GET /dashboard/kpi`
- `GET /dashboard/status-distribution`
- `GET /dashboard/aging?thresholdDays=3`
- `GET /dashboard/top-categories?range=30d|90d`
- `GET /dashboard/weekly-schedule`
- `GET /dashboard/technician-workload`

### Utility
- `GET /assets/by-barcode/:code` (uniqueness check)

**Response envelope:** `{ success: boolean, data?: T, error?: string, meta?: { total, page, pageSize } }`

**Error codes:** `HR_INVALID_TRANSITION` (409), `HR_PERMISSION_DENIED` (403), `HR_CATALOG_INACTIVE` (400), `HR_BARCODE_DUPLICATE` (409), `HR_OPTIMISTIC_LOCK` (409), `HR_VALIDATION` (400), `HR_NOT_FOUND` (404).

---

## 8. Events & Notifications

### Internal events (EventEmitter2)

| Event | Recipients | Channels |
|-------|-----------|----------|
| `hardware-request.submitted` | ICT_LEAD(s) | in-app, email |
| `hardware-request.approved` | requester, ICT_PROCUREMENT(s) | in-app, email |
| `hardware-request.rejected` | requester | in-app, email |
| `hardware-request.cancelled` | ICT_LEAD(s) if was under review | in-app |
| `hardware-request.procurement.completed` | requester, ICT_TECHNICIAN(s) | in-app, email |
| `hardware-request.schedule.proposed` | counterparty (requester ↔ technician) | in-app, email |
| `hardware-request.schedule.confirmed` | both parties | in-app |
| `hardware-request.schedule.rescheduled` | both parties | in-app, email |
| `hardware-request.install.started` | requester | in-app |
| `hardware-request.install.completed` | requester, ICT_LEAD | in-app, email |
| `hardware-request.commented` | request subscribers (requester + prior commenters) | in-app |

### Email templates (`apps/backend/src/modules/notifications/templates/hardware-request/`)
- `submitted.html`, `approved.html`, `rejected.html`, `procurement-done.html`, `schedule-proposed.html`, `schedule-rescheduled.html`, `install-completed.html`.

### Real-time (WebSocket)
- Namespace `/ws/hardware-requests`.
- Rooms: `request:${id}` (detail page), `global` (list + dashboard with 1s debounce).
- Events emitted: `status-changed`, `comment-added`, `activity-logged`, `schedule-updated`, `install-progress`.

---

## 9. UI / UX

### Routes

| Path | Page | Access |
|------|------|--------|
| `/hardware-requests` | List | all |
| `/hardware-requests/new` | Create Wizard | USER |
| `/hardware-requests/:id` | Detail | USER own / ICT all |
| `/hardware-requests/calendar` | Installation Calendar | ICT |
| `/hardware-requests/dashboard` | Dashboard | ICT |
| `/hardware-requests/catalog` | Catalog Admin | ICT_LEAD |

### A. List Page
- Header: search, filter chips (status, category, date range, requester—ICT only), view toggle (table/card), scope toggle (My/All — ICT default All, USER hardcoded My).
- Columns: Request #, Requester (avatar+name), Items summary, Site, Status mini-pipeline, Updated, Aging badge.
- Aging: yellow >3 days in non-terminal, red >7 days.
- FAB `+ New Request` (USER only).
- Infinite scroll, skeleton loader, empty state illustration + CTA.

### B. Create Wizard (3 steps)
- **Step 1 Info:** site dropdown, recipient (default self), justification textarea (min 20, live counter).
- **Step 2 Items:** CatalogPicker grid by category → ItemBasket sidebar with quantity stepper + dynamic fields per catalog `required_fields`. Min 1 item.
- **Step 3 Review & Submit:** full summary, attachments drag-drop (max 5 × 10MB), `Save as Draft` | `Submit` with confirm modal.

### C. Detail Page (2-col desktop / stacked mobile)
- **Top:** request #, big status badge, animated 6-step pipeline (SUBMITTED → UNDER_REVIEW → APPROVED → PROCUREMENT → INSTALLATION → COMPLETED).
- **Left (main ~65%):**
  - Request Info card (requester, recipient, site, submitted_at, justification).
  - Items card (list with catalog info, procurement fields inline when role=PROC, barcode/asset when installed).
  - Installation Schedule card (appears from PROCUREMENT onwards).
  - Comment Thread (real-time, author role badges, attachments).
- **Right sidebar (~35%):**
  - Contextual Action Panel (buttons per role × status).
  - Activity Timeline vertical feed with relative timestamps.

### D. Installation Calendar Page
- Month/Week/Day toggle, technician multi-filter, status filter.
- Event color by technician; click → popover + link.
- TECHNICIAN drag-drop reschedule (with confirm to requester).
- Right sidebar: "Unscheduled" list + "My Today" for technicians.

### E. Dashboard
- KPI row: Total Active, In Procurement, Pending Install, Completed This Month.
- Widgets: status distribution donut, aging table, top categories bar chart, weekly install schedule compact, technician workload bars.

### F. Catalog Admin
- CRUD table (code, name, category, active toggle, display_order).
- Edit modal with JSON builder for `required_fields`.

### Design language
- Consistent dengan zoom-booking redesign (commit `ce0450f`): card radius, shadow, spacing.
- Status colors: SUBMITTED blue, UNDER_REVIEW amber, APPROVED emerald, PROCUREMENT violet, INSTALLATION indigo, COMPLETED solid green, REJECTED/CANCELLED rose.
- Typography: heading `text-2xl font-semibold`, body `text-sm`.
- Mobile-first, responsive sm/md/lg.
- Skeleton loader setiap async section.
- Animations: status pipeline step (0.3s ease), comment slide-in, modal fade+scale, toast slide-up.
- A11y: ARIA labels, keyboard navigation wizard & modals, axe tested.

---

## 10. Data Flow (Frontend)

- **React Query** server state.
- Query keys: `['hardware-requests','list',filters]`, `['hardware-requests','detail',id]`, `['hardware-requests','calendar',range,filters]`, `['hardware-requests','dashboard',widget]`, `['catalog',filters]`, `['activity',id]`, `['comments',id]`.
- Stale time: list 30s, detail 10s, dashboard 60s, catalog 5min.
- Optimistic update: comment add, status transition.
- Rollback on error with toast.
- Prefetch detail on list row hover.
- WebSocket → invalidate via `useHardwareRequestRealtime(id)` hook.

---

## 11. Error Handling & Edge Cases

Domain errors (mapped HTTP):
- `InvalidStateTransitionError` → 409 `HR_INVALID_TRANSITION`
- `PermissionDeniedError` → 403 `HR_PERMISSION_DENIED`
- `CatalogItemInactiveError` → 400 `HR_CATALOG_INACTIVE`
- `BarcodeAlreadyUsedError` → 409 `HR_BARCODE_DUPLICATE`
- `OptimisticLockError` → 409 `HR_OPTIMISTIC_LOCK`
- `NotFoundError` → 404 `HR_NOT_FOUND`
- Zod/class-validator failure → 400 `HR_VALIDATION`

Edge cases covered:
1. Catalog item dihapus/inactive setelah request submitted → `category_snapshot` immutable.
2. Requester deactivated — request tetap dieksekusi ICT, badge "User nonaktif".
3. Duplicate barcode — reject + show existing asset.
4. Mutual confirm race — first-writer-wins via version, loser gets 409 + refresh.
5. Reschedule after `IN_PROGRESS` → forbidden, harus explicit cancel & re-propose.
6. Procurement complete dengan item cost null/0 → blocked di service.
7. Stuck >7 hari UNDER_REVIEW → Aging dashboard + cron email reminder harian.
8. Attachment upload fail saat submit → request tetap submitted, retry via comment.
9. User cancel saat sudah UNDER_REVIEW (race) → error "sudah direview".
10. Install done setelah recipient pindah site → asset `assigned_to_user_id` snapshot at submit.

Observability:
- Structured logs + correlation ID per request lifecycle.
- Audit trail via `hardware_request_activity`.
- Metrics: throughput per status, avg time per stage.
- Error tracker untuk unhandled exceptions.

---

## 12. Testing Strategy

### Backend (target ≥80%)
- **Unit:** state machine guards, permission checks, catalog service, barcode uniqueness, mutual schedule logic, dashboard aggregators.
- **Integration:** full lifecycle happy path (submit → approve → procure → schedule → install → complete) + reject/cancel + barcode duplicate + optimistic lock with real DB.
- **Event listener tests:** event emit → notification record + email job.

### Frontend (target ≥70%)
- **Unit (Vitest):** hooks, utils (status/aging/permission), reducers.
- **Component (RTL):** StatusPipeline transitions, CommentThread, ItemPicker, InstallationScheduler propose/confirm, BarcodeScanner validation.
- **E2E (Playwright):**
  1. USER submit → ICT full lifecycle → COMPLETED (role switch fixtures).
  2. ICT_LEAD reject with reason → requester sees notification.
  3. Mutual scheduling: technician propose → user confirm → install progress → barcode scan → complete.

### Performance
- List 10k requests with virtualization.
- Calendar 500 events.

### Accessibility
- axe-core E2E checks.
- Keyboard nav on wizard, modal, calendar.

---

## 13. Migration Plan

1. Create new TypeORM migration:
   - Create tables: `hardware_request`, `hardware_request_item`, `hardware_catalog`, `hardware_request_comment`, `hardware_request_activity`, `hardware_asset`.
   - Move `installation_schedule` table ownership to hardware-request module (FK swap from ticket → hardware_request).
   - Seed initial catalog entries (common items: Laptop Standard, Laptop Design, Monitor 24", Monitor 27", Mouse, Keyboard, Headset, Network Cable, Access Point, Software License generic).
2. Data migration script (if `ict_budget` has production rows) → transform to `hardware_request` rows (status mapping best-effort; fall back to `COMPLETED` or `CANCELLED`).
3. Drop `ict_budget` tables after verification window.
4. Frontend routing update: old routes `/request-center/hardware-*` → redirect ke `/hardware-requests/*`.
5. Feature flag `hardware_request_v2` untuk soft cutover (optional).

---

## 14. Open Items for Implementation Planning

- Identifikasi definitif role yang ada di module `permissions` existing (map ke ICT_LEAD/PROCUREMENT/TECHNICIAN atau butuh tambah baru).
- Template email: copy bahasa Indonesia oleh UI copy review.
- Catalog seed: list awal disepakati dengan stakeholder ICT.
- Barcode scanner: native HTML5 getUserMedia atau library (planning-phase pick).
- Storage attachment: pakai module `uploads` existing.
- Dashboard chart library: reuse yang dipakai di project (planning-phase verify).

---

**Approvals:**
- Brainstorming phase: ✅ user-approved 2026-04-17.
- Next step: `writing-plans` skill untuk implementation plan.
