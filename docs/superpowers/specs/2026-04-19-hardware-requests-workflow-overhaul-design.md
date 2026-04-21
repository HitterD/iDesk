# Hardware Requests — Workflow Overhaul Design Spec

**Date:** 2026-04-19
**Status:** Brainstorming approved → ready for planning
**Supersedes (partial):**
- `2026-04-17-hardware-request-rework-design.md` — bagian invoice/price input procurement & single-step scheduling.
- `2026-04-19-hardware-request-bugfix-and-role-flatten-design.md` — bagian install scheduling endpoint (digantikan mutual scheduling baru).
**Scope:** End-to-end overhaul workflow hardware-requests: state machine, data model, layout merge dashboard+calendar, procurement simplifikasi, delivery tracking, mutual scheduling, comments enable, UI/UX consistency.

---

## 1. Goals & Non-Goals

### Goals
- Layout merge: HR Dashboard + HR Calendar dijadikan sub-route di `/hardware-requests`. Tidak ada entry sidebar baru.
- List page: tiap baris request bisa expand → tampilkan daftar item (qty × name).
- Procurement simplifikasi: hapus input invoice/harga/file. Per-item ✓ (APPROVED) / ✗ (REJECTED). Status auto-transisi.
- Tambah state baru `AWAITING_DELIVERY` + per-item delivery tracking (`PENDING|ARRIVED|NOT_PROCURED`).
- Item bisa datang partial. ICT tandai item arrived → USER dapat notif. Bisa schedule per-item atau grouping fleksibel.
- Mutual scheduling: ICT propose 1-3 slot → USER pilih → CONFIRMED. Reschedule loop max 3x.
- Comments enable di semua status (USER own, ICT_STAFF semua).
- UI/UX & animasi konsisten dengan halaman dashboard & tickets existing.

### Non-Goals
- Tidak ubah role tier (sudah flat `ICT_STAFF | USER` per spec 2026-04-19-bugfix).
- Tidak hapus kolom DB invoice (back-compat). Optional cleanup phase berikutnya.
- Tidak rework barcode flow (existing tetap, dipakai saat install complete).
- Tidak tambah module notifikasi baru (pakai existing notifier listeners).

---

## 2. Context Reference

- Existing pages: `HardwareRequestListPage`, `HardwareRequestDetailPage`, `HardwareRequestCreatePage`, `HardwareDashboardPage`, `InstallationCalendarPage`, `CatalogAdminPage`.
- Existing entities: `hardware_request`, `hardware_request_item`, `hardware_request_activity`, `hardware_request_comment`, `installation_schedule`.
- Existing role mapping (post-bugfix spec): `ADMIN|MANAGER|AGENT → ICT_STAFF`, USER → `USER`.

---

## 3. Approach

**Approach B (selected) — Split jadi 3 sub-spec dependen:**
1. **Backend domain extension** — schema + state machine + endpoint baru.
2. **Frontend workflow** — procurement panel ✓/✗, delivery board, mutual scheduling modals, comments enable, expandable items.
3. **Layout merge + UI polish** — sub-routes, top-of-page tabs, sidebar cleanup, animation/visual match dashboard+tickets.

Spec ini cover full visi. Sub-spec implementation diturunkan via writing-plans skill.

**Rejected:** Approach A (single big PR) → blast radius luas; Approach C (extend prior spec) → overload scope.

---

## 4. State Machine

```
DRAFT → SUBMITTED → REVIEW → APPROVED → PROCUREMENT
                              │
                              ▼
                       AWAITING_DELIVERY    [new state]
                              │
                              ▼
                        INSTALLATION
                              │
                              ▼
                            DONE

Branch:
  REJECTED   ← REVIEW | PROCUREMENT
  CANCELLED  ← USER, sebelum APPROVED
```

### Transitions
| From | To | Trigger | Actor |
|------|-----|---------|-------|
| `PROCUREMENT` | `AWAITING_DELIVERY` | "Selesaikan Procurement" + ≥1 item APPROVED | ICT_STAFF |
| `PROCUREMENT` | `REJECTED` | "Selesaikan Procurement" + semua item REJECTED + alasan | ICT_STAFF |
| `AWAITING_DELIVERY` | `INSTALLATION` | Schedule pertama dibuat (≥1 item ARRIVED) | system (auto on schedule create) |
| `INSTALLATION` | `DONE` | Semua item ARRIVED **dan** semua schedule status = DONE | system (auto on last schedule complete) |

### Item-level Status (`hardware_request_item.delivery_status`)
- `PENDING` (default) — sebelum diputuskan procurement, atau sudah APPROVED tapi belum datang.
- `ARRIVED` — barang datang, siap dijadwalkan.
- `NOT_PROCURED` — ICT silang ✗ saat procurement.

### Schedule-level Status (`installation_schedule.status`)
Existing: `PROPOSED|CONFIRMED|IN_PROGRESS|DONE|RESCHEDULED|CANCELLED`.
**Tambah:** `PROPOSED_AWAITING_USER` (ICT propose, menunggu USER pilih), `RESCHEDULE_REQUESTED` (USER minta ulang).

---

## 5. Data Model

### 5.1 `hardware_request_item` — kolom baru
```sql
ALTER TABLE hardware_request_item
  ADD COLUMN delivery_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING','ARRIVED','NOT_PROCURED')),
  ADD COLUMN arrived_at timestamptz NULL,
  ADD COLUMN procurement_decision varchar(20) NULL
    CHECK (procurement_decision IN ('APPROVED','REJECTED')),
  ADD COLUMN procurement_decided_at timestamptz NULL,
  ADD COLUMN procurement_decided_by uuid NULL REFERENCES users(id);

CREATE INDEX idx_hri_delivery_status ON hardware_request_item(delivery_status);
```

### 5.2 `hardware_request` — kolom existing
- `invoice_number`, `invoice_url`, `total_price`: **tetap** di schema, dijadikan nullable / optional. FE baru tidak isi. Cleanup di phase berikutnya.

### 5.3 `installation_schedule` — kolom baru
```sql
ALTER TABLE installation_schedule
  ADD COLUMN proposed_slots jsonb NULL,
  ADD COLUMN selected_slot_at timestamptz NULL,
  ADD COLUMN reschedule_count int NOT NULL DEFAULT 0,
  ADD COLUMN reschedule_reason text NULL;

-- extend CHECK constraint status
ALTER TABLE installation_schedule
  DROP CONSTRAINT IF EXISTS installation_schedule_status_check,
  ADD CONSTRAINT installation_schedule_status_check
    CHECK (status IN ('PROPOSED','PROPOSED_AWAITING_USER','CONFIRMED',
                      'IN_PROGRESS','DONE','RESCHEDULED','RESCHEDULE_REQUESTED','CANCELLED'));
```

`proposed_slots` shape:
```json
[
  { "start": "2026-04-22T09:00:00+07:00", "end": "2026-04-22T11:00:00+07:00" },
  { "start": "2026-04-23T14:00:00+07:00", "end": "2026-04-23T16:00:00+07:00" }
]
```

### 5.4 Tabel baru `installation_schedule_items`
```sql
CREATE TABLE installation_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES installation_schedule(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES hardware_request_item(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, item_id)
);

CREATE INDEX idx_isi_schedule ON installation_schedule_items(schedule_id);
CREATE INDEX idx_isi_item ON installation_schedule_items(item_id);
```

### 5.5 Migration Strategy
- 1 file migration additive only.
- Default values aman untuk existing rows (`PENDING`, `0`, `null`).
- Reversible: down migration drop kolom + drop tabel join.

---

## 6. Layout & Navigation

### 6.1 Sub-routes
```
/hardware-requests              → ListView (default)
/hardware-requests/dashboard    → DashboardView (existing HardwareDashboardPage di-mount di sini)
/hardware-requests/calendar     → CalendarView (existing InstallationCalendarPage di-mount di sini)
/hardware-requests/new          → CreatePage (existing)
/hardware-requests/:id          → DetailPage (existing)
```

### 6.2 Sidebar
- Hapus entry `HR Dashboard` & `HR Calendar` dari sidebar config (jika ada).
- 1 entry: `Hardware Requests` → default route `/hardware-requests`.

### 6.3 Komponen baru `<HardwareRequestsTabs>`
Render di header List, Dashboard, Calendar view. Layout:
```
┌──────────────────────────────────────────────┐
│  Hardware Requests                           │
│  ─────────────────────────────────────────   │
│  [Permintaan (12)]  [Dashboard]  [Kalender]  │
└──────────────────────────────────────────────┘
```
- Pakai `<NavLink>` react-router (auto active state).
- Sticky top + `backdrop-blur` saat scroll.
- Underline indicator: framer-motion `layoutId="hr-tab-underline"` slide animation.
- Counter badge "Permintaan (N)" — N = total request open status.

### 6.4 List Page — Expandable Items
- `RequestTable` / `RequestCard` tambah chevron `>` per row.
- Klik chevron → expand panel inline tampilkan:
  ```
  Items (3):
    • Monitor Dell 24"   qty: 2
    • Keyboard Logitech  qty: 5
    • Mouse Wireless     qty: 5
  ```
- State expand: local component state, tidak persist ke URL.
- Animation: `AnimatePresence` + height auto-collapse.

### 6.5 Lazy-load
Tiap view code-split via `React.lazy` + Suspense fallback skeleton.

### 6.6 Breadcrumb
Detail page: `Hardware Requests / Permintaan / #HR-1234`.

---

## 7. Procurement Simplification

### 7.1 UI — `ItemDecisionList` (replace `InvoiceForm`)
```
┌─ Item Decision ────────────────────────────┐
│  Monitor Dell 24"  qty:2     [✓]  [✗]      │
│  Keyboard Logitech qty:5     [✓]  [✗]      │
│  Mouse Wireless    qty:5     [✓]  [✗]      │
│                                            │
│  Catatan procurement (opsional): [______]  │
│                                            │
│  [Simpan Draft]  [Selesaikan Procurement]  │
└────────────────────────────────────────────┘
```

### 7.2 Behavior
- Tiap item 2 toggle: `✓` (APPROVED) / `✗` (REJECTED). Default null (netral).
- Visual: APPROVED → border-left hijau + badge ✓. REJECTED → border-left merah + badge ✗ + opacity 0.7. Netral → abu.
- "Simpan Draft" → save partial, status request tetap `PROCUREMENT`. Bisa balik lagi.
- "Selesaikan Procurement":
  - Validasi: semua item harus diputuskan → error toast jika ada netral.
  - ≥1 APPROVED → status request `PROCUREMENT → AWAITING_DELIVERY`. Item APPROVED `delivery_status=PENDING`. Item REJECTED `delivery_status=NOT_PROCURED`.
  - Semua REJECTED → buka `RejectDialog` (reuse) → input alasan → status `REJECTED`.

### 7.3 API
```
POST /hardware-requests/:id/procurement/decision
Body: {
  decisions: [{ itemId: uuid, decision: 'APPROVED' | 'REJECTED' }],
  note?: string
}
→ persist per-item decision, no status change
```

```
POST /hardware-requests/:id/procurement/complete
Body: { rejectReason?: string }
→ server validate semua item diputuskan
→ atomic: update item delivery_status, update request status, emit event
```

### 7.4 Files
- DELETE: `components/procurement/InvoiceForm.tsx`
- NEW: `components/procurement/ItemDecisionList.tsx`
- MODIFY: `components/procurement/ProcurementPanel.tsx`
- BE NEW: `procurement-decision.dto.ts`, service method `decideItems()`, `completeProcurement()`.

### 7.5 Animation
- Click ✓/✗ → button scale 0.95 + color flash 200ms.
- Border-left color transition 300ms.
- AnimatePresence saat semua item terputus + tombol "Selesaikan" enable.

---

## 8. Delivery Tracking

### 8.1 Komponen baru `<DeliveryBoard>`
Render di Detail page ketika status ∈ {`AWAITING_DELIVERY`, `INSTALLATION`} dan masih ada item `PENDING`.

```
┌─ Status Pengiriman Item ─────────────────────┐
│ ✅ Monitor Dell 24"  qty:2  Datang 14 Apr    │
│    [Tandai Belum Datang]                     │
│                                              │
│ ⏳ Keyboard Logitech qty:5  Menunggu         │
│    [Tandai Sudah Datang]                     │
│                                              │
│ ✗  Cable HDMI        qty:1  Tidak diproses   │
│    (rejected at procurement)                 │
└──────────────────────────────────────────────┘

[Jadwalkan Instalasi (2 item siap)]
```

### 8.2 Behavior
- ICT_STAFF only: tombol toggle delivery per item.
- USER read-only.
- "Sudah Datang" → set `delivery_status=ARRIVED`, `arrived_at=now()`, fire event `hardware-item.arrived`.
- Listener kirim notif in-app + email ke USER: "Item X sudah datang. Menunggu jadwal instalasi."
- Tombol "Jadwalkan Instalasi" enabled jika ≥1 item `ARRIVED` AND tidak ada schedule active untuk item tsb.
- Klik → buka `<ScheduleProposeModal>` (Section 9) dengan pre-select item ARRIVED yang belum punya schedule.

### 8.3 API
```
PATCH /hardware-requests/:id/items/:itemId/delivery
Body: { status: 'ARRIVED' | 'PENDING' }
Auth: ICT_STAFF only
→ update item, emit event
```

### 8.4 Files
- NEW: `components/delivery/DeliveryBoard.tsx`
- BE NEW: `delivery.controller.ts` atau extend `installation.controller.ts`, `item-arrived.listener.ts` untuk notif.

### 8.5 Empty State
"Semua item belum tiba. ICT akan update saat barang sampai."

### 8.6 Animation
- Row state change → slide + checkmark draw (svg path animate via framer-motion).
- Row background shift hijau saat ARRIVED.
- Row fade saat NOT_PROCURED.

---

## 9. Mutual Scheduling

### 9.1 Flow
```
ICT propose (max 3 slot, pilih item N, assign technician)
  → schedule status = PROPOSED_AWAITING_USER
  → notif USER "Pilih jadwal instalasi"
  → USER buka SlotPickerModal
  → pilih 1 slot
  → schedule CONFIRMED, selected_slot_at=now(), link installation_schedule_items
  → notif ICT
  → status request → INSTALLATION (jika belum)
```

Reschedule loop:
```
USER klik "Minta Reschedule" + alasan
  → schedule status = RESCHEDULE_REQUESTED, reschedule_count++
  → notif ICT
  → ICT propose ulang (3 slot baru)
  → loop sampai max reschedule_count = 3 → auto CANCELLED
```

### 9.2 Komponen baru `<ScheduleProposeModal>` (ICT)
```
┌─ Jadwalkan Instalasi ─────────────────────────┐
│ Item yang dijadwalkan:                        │
│   ☑ Monitor Dell 24" (qty:2)                  │
│   ☑ Keyboard Logitech (qty:5)                 │
│   ☐ Mouse Wireless (qty:5)                    │
│                                               │
│ Teknisi: [ Dropdown: Budi (default: me) ]     │
│                                               │
│ Usulkan slot waktu (1-3):                     │
│   Slot 1: [date] [start] [end]      [×]       │
│   Slot 2: [date] [start] [end]      [×]       │
│   [+ Tambah slot]                             │
│                                               │
│ Catatan: [______________]                     │
│                                               │
│           [Batal]  [Kirim ke User]            │
└───────────────────────────────────────────────┘
```

Validation:
- Min 1 slot, max 3 slot.
- Tiap slot: end > start, start ≥ now() + 1 jam.
- Min 1 item ter-checklist.
- Item ter-checklist harus `delivery_status=ARRIVED`.

### 9.3 Komponen baru `<SlotPickerModal>` (USER)
```
┌─ Pilih Jadwal Instalasi ──────────────────────┐
│ Teknisi: Budi                                 │
│ Item: Monitor Dell 24", Keyboard Logitech     │
│ Catatan ICT: "Mohon di kantor lt.3"           │
│                                               │
│ ○ Senin, 22 Apr   09:00–11:00                 │
│ ○ Selasa, 23 Apr  14:00–16:00                 │
│ ○ Rabu, 24 Apr    10:00–12:00                 │
│                                               │
│ [Minta Reschedule]   [Batal]  [Konfirmasi]    │
└───────────────────────────────────────────────┘
```

### 9.4 API
```
POST /hardware-requests/:id/schedule/propose
Body: {
  itemIds: uuid[],
  technicianId: uuid,
  slots: [{ start: ISO, end: ISO }]  (length 1-3),
  note?: string
}
Auth: ICT_STAFF
→ atomic transaction:
   1. create installation_schedule (status=PROPOSED_AWAITING_USER, proposed_slots persisted, scheduled_start/end null)
   2. create installation_schedule_items rows untuk semua itemIds (link permanen)
   3. emit event schedule.proposed
```

```
POST /hardware-requests/:id/schedule/:scheduleId/select-slot
Body: { slotIndex: 0 | 1 | 2 }
Auth: USER (own request) atau ICT_STAFF
→ atomic transaction:
   1. validate slotIndex ∈ proposed_slots range
   2. update schedule: status=CONFIRMED, scheduled_start/end = proposed_slots[slotIndex],
      selected_slot_at=now()
   3. transition request status AWAITING_DELIVERY → INSTALLATION (if applicable)
   4. emit event schedule.confirmed
   (installation_schedule_items sudah di-link saat propose, no change here)
```

```
POST /hardware-requests/:id/schedule/:scheduleId/request-reschedule
Body: { reason: string }
Auth: USER (own) atau ICT_STAFF
→ schedule status=RESCHEDULE_REQUESTED, reschedule_count++
→ jika reschedule_count >= 3 → status=CANCELLED, fire event
```

### 9.5 Multiple Schedules per Request
- Boleh. Item Monitor schedule batch-1, Mouse arrived belakangan → schedule batch-2.
- Calendar view tampilkan semua schedule (1 row per schedule).
- Status request tetap `INSTALLATION` selama ada schedule belum DONE atau item belum ARRIVED.

### 9.6 Files
- NEW: `components/scheduling/ScheduleProposeModal.tsx`
- NEW: `components/scheduling/SlotPickerModal.tsx`
- NEW: `components/scheduling/RescheduleRequestModal.tsx`
- DELETE/REFACTOR: existing `RescheduleConfirmModal.tsx` — bila masih ada, harmonize.
- BE NEW: `mutual-scheduling.service.ts`, DTOs, listener untuk notifikasi.

### 9.7 Animation
- Slot card hover → border glow biru + scale 1.02.
- Selected slot → checkmark spring-in + ripple 300ms.
- Modal: spring scale 0.95→1, backdrop fade 200ms.

---

## 10. Comments Enable

### 10.1 Bug
Comments saat ini ter-block di certain status (suspect: post-`APPROVED` lock). Audit & hapus restriction.

### 10.2 Policy (Approach A approved)
- Auth required.
- USER bisa comment jika `request.userId === me.id` (own request) di **semua status** termasuk `DONE`, `CANCELLED`, `REJECTED`.
- ICT_STAFF bisa comment di **semua request** semua status.
- Edit window: author bisa edit dalam 5 menit, lalu lock (audit immutable).

### 10.3 Files
- MODIFY: `hardware-comment.controller.ts` — hapus status guard.
- MODIFY: `permission.util.ts` — `canComment(user, request)`: cek auth + ownership only.
- MODIFY: `CommentComposer.tsx` — selalu render di Detail page (tidak conditional per status).

### 10.4 Tests
- `permission.util.test.ts` — canComment matrix per status × per role.
- `hardware-comment.controller.spec.ts` — POST comment di status DONE/CANCELLED return 201.

---

## 11. UI/UX Pattern Consistency

### 11.1 Audit & Match
Verifikasi saat implement (cek `DashboardPage.tsx`, halaman tickets):
- **Card style**: `rounded-2xl border border-border/40 bg-card/80 backdrop-blur`.
- **Heading**: `text-2xl font-semibold tracking-tight` + subtitle `text-sm text-muted-foreground`.
- **Spacing**: `space-y-6` antar section, `p-6` card.
- **Empty state**: ilustrasi + heading + CTA button (reuse `EmptyState`).
- **Loading skeleton**: shimmer match `RequestListSkeleton`.
- **Toast**: sonner `success/error/info` dengan ikon.
- **Color tokens**: semantic (`text-success`, `bg-warning/10`, `border-destructive`). No hardcoded hex.

### 11.2 Animations (framer-motion + tailwind)
- Page tab transition: fade-in + slide-up 200ms.
- Tab underline: shared `layoutId` slide.
- Status badge change: color transition 300ms.
- Modal: spring scale + backdrop fade.
- List item add/remove: `AnimatePresence` + height collapse.
- Notif bell: pulse saat unread.
- Reduced motion: `useReducedMotion()` disable transform.

### 11.3 Accessibility
- Icon-only button: `aria-label`.
- Modal: focus trap (radix dialog).
- Status indicator: ikon + text, tidak hanya warna.
- Keyboard nav: tab order logis, esc tutup modal.

---

## 12. Notifications

### 12.1 Trigger Matrix
| Event | Recipients | Channel |
|-------|-----------|---------|
| `request.submitted` | ICT_STAFF | in-app + email |
| `request.approved` | USER (owner) | in-app + email |
| `request.rejected` | USER (owner) | in-app + email |
| `procurement.completed` | USER (owner) | in-app |
| `item.arrived` | USER (owner) | in-app + email |
| `schedule.proposed` | USER (owner) | in-app + email |
| `schedule.confirmed` | ICT_STAFF (technician) | in-app + email |
| `schedule.reschedule_requested` | ICT_STAFF (technician) | in-app + email |
| `schedule.cancelled` | both | in-app + email |
| `comment.created` | counterpart (ICT ↔ USER) | in-app |

### 12.2 Implementation
- Reuse existing `email-notifier.listener.ts`, `in-app-notifier.listener.ts`.
- Tambah handler untuk event baru: `item.arrived`, `schedule.proposed`, `schedule.reschedule_requested`.

---

## 13. Testing Strategy

### 13.1 Test Runner Commands (per request user, max 2 worker)
```bash
# Backend (Jest)
pnpm --filter backend test -- --maxWorkers=2
# Atau serial:
pnpm --filter backend test -- --runInBand

# Frontend (Vitest)
pnpm --filter frontend test -- --no-threads
```
Tambah ke CI config + dokumentasi README.

### 13.2 Coverage Target: 80%+

**Sub-spec 1 (Backend):**
- Unit: state machine transitions (PROCUREMENT→AWAITING_DELIVERY, →INSTALLATION, →DONE, →REJECTED).
- Unit: item delivery_status update + event emit.
- Unit: schedule propose validation (1-3 slot, future date, item ARRIVED, item ownership).
- Unit: select-slot atomic update + linkage `installation_schedule_items`.
- Unit: reschedule loop counter + auto-cancel.
- Integration: full happy path SUBMITTED→DONE multi-batch.
- Integration: reject path partial procurement.
- Migration test: existing rows safe.

**Sub-spec 2 (Frontend workflow):**
- `ItemDecisionList.test.tsx` — toggle, validation, submit, error states.
- `DeliveryBoard.test.tsx` — toggle arrival, button enable, role gating.
- `SlotPickerModal.test.tsx` — radio select, request reschedule, error.
- `ScheduleProposeModal.test.tsx` — add/remove slot, item picker, validation.
- `CommentComposer.test.tsx` — render in DONE/CANCELLED status.
- Hook tests: `useScheduleSelection`, `useDeliveryUpdate`, `useProcurementDecision`.

**Sub-spec 3 (Layout):**
- `HardwareRequestsTabs.test.tsx` — active state per route, badge count.
- `RequestTable.test.tsx` — expand row, item list render.
- E2E (Playwright): full flow USER + ICT 2-tab session, mutual scheduling end-to-end.

---

## 14. Rollout & Migration

### 14.1 Sequence
1. **Sub-spec 1 (BE)**: deploy → migration + endpoint baru + state machine baru. FE lama compatible (additive only).
2. **Sub-spec 2 (FE workflow)**: deploy → procurement panel baru, delivery board, scheduling modals.
3. **Sub-spec 3 (layout)**: deploy → sub-routes + tabs + sidebar cleanup.

### 14.2 Feature Flag (optional)
Env `HARDWARE_REQUEST_V2=true` → enable new procurement panel + delivery board + mutual scheduling. Default off di staging awal, ON setelah QA pass.

### 14.3 Rollback
- Per-step git revert.
- Migration reversible (drop kolom + drop tabel join, no data loss).
- Tidak ada destructive data op.

### 14.4 Observability
- Sentry tag: `hardware-request-flow:v2`.
- Log event: `request.state.transitioned` dengan `{from, to, actor, requestId}`.
- Metric counter: `schedule.proposed`, `schedule.confirmed`, `schedule.rescheduled`, `item.arrived`, `procurement.completed`.

---

## 15. Files Touched (Estimated, Sub-spec Breakdown)

### Sub-spec 1 — Backend
**New files:**
- `migrations/<timestamp>-hardware-request-workflow-v2.ts`
- `modules/hardware-request/services/mutual-scheduling.service.ts`
- `modules/hardware-request/services/procurement-decision.service.ts`
- `modules/hardware-request/services/delivery-tracking.service.ts`
- `modules/hardware-request/dto/procurement-decision.dto.ts`
- `modules/hardware-request/dto/schedule-propose.dto.ts`
- `modules/hardware-request/dto/select-slot.dto.ts`
- `modules/hardware-request/dto/request-reschedule.dto.ts`
- `modules/hardware-request/dto/item-delivery.dto.ts`
- `modules/hardware-request/domain/entities/installation-schedule-item.entity.ts`
- `modules/hardware-request/listeners/item-arrived.listener.ts`

**Modified files:**
- `modules/hardware-request/hardware-request.module.ts`
- `modules/hardware-request/domain/entities/hardware-request-item.entity.ts`
- `modules/hardware-request/domain/entities/installation-schedule.entity.ts`
- `modules/hardware-request/domain/state-machine/request-state.ts`
- `modules/hardware-request/services/hardware-request-command.service.ts`
- `modules/hardware-request/services/installation-schedule.service.ts`
- `modules/hardware-request/presentation/installation.controller.ts`
- `modules/hardware-request/presentation/hardware-request.controller.ts`
- `modules/hardware-request/presentation/hardware-comment.controller.ts` (hapus status guard)
- `modules/hardware-request/listeners/in-app-notifier.listener.ts`
- `modules/hardware-request/listeners/email-notifier.listener.ts`
- Tests baru + update existing test fixtures.

### Sub-spec 2 — Frontend Workflow
**New files:**
- `features/hardware-request/components/procurement/ItemDecisionList.tsx`
- `features/hardware-request/components/delivery/DeliveryBoard.tsx`
- `features/hardware-request/components/scheduling/ScheduleProposeModal.tsx`
- `features/hardware-request/components/scheduling/SlotPickerModal.tsx`
- `features/hardware-request/components/scheduling/RescheduleRequestModal.tsx`
- `features/hardware-request/hooks/useProcurementDecision.ts`
- `features/hardware-request/hooks/useDeliveryUpdate.ts`
- `features/hardware-request/hooks/useScheduleSelection.ts`
- API extension files.

**Modified files:**
- `features/hardware-request/components/procurement/ProcurementPanel.tsx`
- `features/hardware-request/components/detail/CommentComposer.tsx`
- `features/hardware-request/components/detail/ActionPanel.tsx`
- `features/hardware-request/api/hardware-request.api.ts`
- `features/hardware-request/api/installation.api.ts`
- `features/hardware-request/utils/permission.util.ts`
- `features/hardware-request/types/index.ts`

**Deleted:**
- `features/hardware-request/components/procurement/InvoiceForm.tsx`

### Sub-spec 3 — Layout
**New files:**
- `features/hardware-request/components/common/HardwareRequestsTabs.tsx`
- `features/hardware-request/layouts/HardwareRequestsLayout.tsx`

**Modified files:**
- `features/hardware-request/routes.tsx` — sub-routes baru
- `features/hardware-request/pages/HardwareRequestListPage.tsx` — wrap layout + expandable row
- `features/hardware-request/components/dashboard/HardwareDashboardPage.tsx` — wrap layout
- `features/hardware-request/components/calendar/InstallationCalendarPage.tsx` — wrap layout
- `features/hardware-request/components/list/RequestTable.tsx` — expandable row
- `features/hardware-request/components/list/RequestCard.tsx` — expandable
- Sidebar config — remove HR Dashboard + HR Calendar entries.

---

## 16. Open Items (resolve di planning phase)

- Cleanup phase: kapan drop kolom `invoice_number/url/total_price` dari schema (post sub-spec 2 deploy + verifikasi tidak ada query lain pakai).
- Existing `RescheduleConfirmModal.tsx` — apakah merge ke `RescheduleRequestModal.tsx` atau drop.
- Feature flag toggling — tentukan saat planning sub-spec 1.
- Notifikasi listener: helper `listIctStaff()` reuse vs duplikat per event.
- Default reschedule limit `3x` — confirm di planning, mungkin config-driven.

---

## 17. Approvals

- Brainstorming phase: ✅ user-approved 2026-04-19 section 1-8.
- Next step: invoke `writing-plans` skill untuk implementation plan terinci, split jadi 3 sub-plan sesuai Approach B.
