# Hardware Request — Install Completion Workflow Overhaul

**Date:** 2026-05-05
**Status:** Approved (pending implementation plan)
**Owner:** Hardware Request module
**Related specs:**
- `2026-04-17-hardware-request-rework-design.md`
- `2026-04-19-hardware-requests-workflow-overhaul-design.md`
- `2026-04-21-hardware-requests-calendar-redesign-design.md`

---

## 1. Problem Statement

Halaman hardware-request tidak bisa menyelesaikan instalasi dengan benar. Audit menemukan:

1. **Bypass barcode wizard di ActionPanel** — tombol "Selesaikan Instalasi" hanya `window.confirm` lalu kirim mutation tanpa items. `CompleteInstallWizard` (yang menscan barcode → asset code) tidak pernah terhubung.
2. **Cap mismatch UI vs guard** — `capsFor.canCompleteInstall` butuh `scheduleStatus === 'IN_PROGRESS'`, tapi tombol di ActionPanel hanya cek `r.status === 'INSTALLATION'`. Tombol muncul saat schedule masih CONFIRMED.
3. **Tidak ada tombol "Mulai Instalasi"** — `canStartInstall` ada di caps tapi tidak ada button di ActionPanel. Schedule mandek di CONFIRMED.
4. **Dummy schedule fallback** di `installation-schedule.service.completeInstallation` (line 165–172) — bila tidak ada schedule, dibuat schedule palsu dengan start=end=now.
5. **Double transition / activity log salah** — `scheduleSvc.completeInstallation` ubah `req.status → COMPLETED`, lalu `cmdSvc.completeInstallation` log activity dengan `fromStatus: INSTALLATION` walau status sudah COMPLETED.
6. **Tidak ada validasi all-items-arrived** sebelum mark COMPLETED.
7. **User tidak terlibat dalam konfirmasi**. Instalasi langsung COMPLETED begitu ICT klik selesai. Tidak ada audit / handshake bahwa user benar-benar menerima instalasi.

## 2. Goals

- Workflow instalasi yang eksplisit, single-source-of-truth, audit-friendly.
- Hilangkan barcode dari install path (asset code dikelola di tempat lain).
- Tambahkan handshake user: ICT mark done → user konfirmasi (atau auto 24 jam).
- Single ownership transisi status di `hardware-request-command.service`.

## 3. Non-Goals

- Tidak mengubah procurement / delivery sub-flow.
- Tidak menghapus seluruh asset/barcode capability — hanya melepas dari install completion path.
- Tidak menambah dispute / "Belum Selesai" dari sisi user (cukup tombol konfirmasi).

## 4. New State Machine

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PROCUREMENT
  → AWAITING_DELIVERY → INSTALLATION → AWAITING_USER_CONFIRMATION → COMPLETED → CLOSED
```

Status baru: **`AWAITING_USER_CONFIRMATION`**.

Transisi baru:
- `INSTALLATION → AWAITING_USER_CONFIRMATION` — actor: ICT_STAFF (mark install done).
- `AWAITING_USER_CONFIRMATION → COMPLETED` — actor: requester atau system cron.

CANCELLABLE_ICT diperbarui: tambah `AWAITING_USER_CONFIRMATION`.

`TERMINAL_STATUSES` tetap: REJECTED, CANCELLED, COMPLETED, CLOSED.

## 5. Backend Changes

### 5.1 Enum + state-machine

`apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts`
- Tambah `AWAITING_USER_CONFIRMATION = 'AWAITING_USER_CONFIRMATION'`.

`apps/backend/src/modules/hardware-request/domain/state-machine/request-state.ts`
- `INSTALLATION: [AWAITING_USER_CONFIRMATION, CANCELLED]`
- `AWAITING_USER_CONFIRMATION: [COMPLETED, CANCELLED]`
- `COMPLETED: [CLOSED]` (tetap)

### 5.2 Entity updates

`hardware-request.entity.ts` — tambah:
- `installMarkedDoneAt: Date | null` — timestamp ICT klik selesai (TTL anchor).
- `userConfirmedAt: Date | null` — timestamp user konfirmasi (manual atau auto-cron).
- `userConfirmationKind: 'MANUAL' | 'AUTO' | null` — sumber konfirmasi.

### 5.3 Activity actions

`activity-action.enum.ts` — tambah:
- `INSTALL_MARKED_DONE`
- `INSTALL_USER_CONFIRMED`
- `INSTALL_AUTO_CONFIRMED`

(Optional: deprecate / remap existing `INSTALL_COMPLETED` ke `INSTALL_USER_CONFIRMED` setelah migrasi data. Untuk backward compat, biarkan enum lama valid.)

### 5.4 Events

`hardware-request.events.ts` — tambah:
- `INSTALL_MARKED_DONE` — payload `{ requestId, scheduleId, actorId, requesterId, markedAt, autoConfirmAt }`.
- `INSTALL_USER_CONFIRMED` — payload `{ requestId, actorId, requesterId, confirmedAt, kind: 'MANUAL' }`.
- `INSTALL_AUTO_CONFIRMED` — payload `{ requestId, requesterId, confirmedAt, kind: 'AUTO' }`.

`INSTALL_COMPLETED` event tetap dipertahankan untuk listener yang sudah ada — di-emit saat user/system konfirmasi (bukan saat ICT mark done).

### 5.5 Service changes

#### `installation-schedule.service.ts`

`completeInstallation(requestId, actor)` — refactor:
- **Hapus** dummy schedule fallback (line 165–172). Bila tidak ada schedule aktif → throw `ConflictException('no active schedule')`.
- **Hapus** mutasi `req.status` (line 187–189). Schedule service tidak ubah request status.
- Logic baru:
  1. Load latest schedule by `requestId`.
  2. Bila status `CONFIRMED` → auto-promote ke `IN_PROGRESS` (set `startedAt`).
  3. Bila status `IN_PROGRESS` → lanjut.
  4. Selain itu (DONE/RESCHEDULED/CANCELLED/PROPOSED*) → throw `ConflictException`.
  5. Set `status = DONE`, `completedAt = now`, save.
  6. Activity log `INSTALL_SCHEDULE_DONE` (sudah ada).
  7. Return saved schedule. **Jangan** emit `INSTALL_COMPLETED` di sini.

#### `hardware-request-command.service.ts`

`markInstallDone(requestId, actor)` — **baru** (rename dari `completeInstallation`):
- Transaction:
  1. Load request.
  2. Validate `req.status === INSTALLATION`.
  3. Validate semua item dengan `procurementDecision === 'APPROVED'` punya `deliveryStatus === 'ARRIVED'`. Jika tidak → `BadRequestException('items not all arrived')`.
  4. Set `status = AWAITING_USER_CONFIRMATION`, `installMarkedDoneAt = now`.
  5. Save.
  6. Activity log `INSTALL_MARKED_DONE` dengan `fromStatus: INSTALLATION, toStatus: AWAITING_USER_CONFIRMATION`, metadata `{ scheduleId, autoConfirmAt: now + 24h }`.
  7. Emit `HR_EVT.INSTALL_MARKED_DONE`.

`confirmInstallation(requestId, actor)` — **baru**:
- Transaction:
  1. Load request.
  2. Validate `req.status === AWAITING_USER_CONFIRMATION`.
  3. Authorization:
     - Manual: actor must be `requesterId`.
     - Auto (cron): actor flag `system: true` (param tambahan internal).
  4. Set `status = COMPLETED`, `completedAt = now`, `userConfirmedAt = now`, `userConfirmationKind = 'MANUAL'|'AUTO'`.
  5. Save.
  6. Activity log `INSTALL_USER_CONFIRMED` (manual) atau `INSTALL_AUTO_CONFIRMED` (auto), metadata `{ kind, scheduleId }`.
  7. Emit `HR_EVT.INSTALL_USER_CONFIRMED` (manual) atau `HR_EVT.INSTALL_AUTO_CONFIRMED` (auto), plus emit `HR_EVT.INSTALL_COMPLETED` untuk backward compat listener.

### 5.6 Controller updates

`installation.controller.ts`:

`POST /hardware-requests/:id/install/complete` — body **dihapus** (`items` tidak diterima lagi). ICT only.
- Behavior: `scheduleSvc.completeInstallation(id, user)` lalu `cmdSvc.markInstallDone(id, user)`.

`POST /hardware-requests/:id/install/confirm` — **baru**. USER only (requester).
- Behavior: `cmdSvc.confirmInstallation(id, user)`.
- Guard: dalam controller verifikasi `requesterId === user.id` (gunakan `queryService.getById`).

### 5.7 Cron (auto-confirm)

`apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.ts` — baru:
- `@Cron('*/5 * * * *')` (setiap 5 menit).
- Query: `request WHERE status = 'AWAITING_USER_CONFIRMATION' AND installMarkedDoneAt < NOW() - INTERVAL '24 hours'`.
- Untuk setiap row → `cmdSvc.confirmInstallation(req.id, { id: SYSTEM_USER_ID, role: 'SYSTEM', system: true })`.
- `SYSTEM_USER_ID` = constant atau dari env. Bila tidak ada user system, gunakan actor `null` di activity (metadata `actor: 'SYSTEM_CRON'`).

### 5.8 Migration

Migration baru:
```sql
ALTER TYPE hardware_request_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION';

ALTER TABLE hardware_request
  ADD COLUMN install_marked_done_at TIMESTAMPTZ NULL,
  ADD COLUMN user_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN user_confirmation_kind VARCHAR(16) NULL
    CHECK (user_confirmation_kind IS NULL OR user_confirmation_kind IN ('MANUAL','AUTO'));
```

Backfill: row existing `status = COMPLETED` → set `userConfirmedAt = completedAt`, `userConfirmationKind = 'MANUAL'` (best-effort).

## 6. Frontend Changes

### 6.1 Hapus barcode dari install flow (B1)

Hapus file:
- `components/barcode/CompleteInstallWizard.tsx`
- `components/barcode/BarcodeScannerModal.tsx`
- `components/barcode/BarcodeInputFallback.tsx`
- `hooks/useBarcodeScanner.ts`
- `__tests__/BarcodeScannerModal.test.tsx`
- Endpoint `assets/by-barcode/:code` di controller — tetap dipertahankan untuk asset management lain (tidak terkait install).

`installation.api.ts` — `completeInstallation(id)` tanpa body items.

### 6.2 Permission caps update

`utils/permission.util.ts` `capsFor`:
- `canStartInstall: isStaff && r === 'INSTALLATION' && scheduleStatus === 'CONFIRMED'`
- `canCompleteInstall: isStaff && r === 'INSTALLATION' && (scheduleStatus === 'IN_PROGRESS' || scheduleStatus === 'CONFIRMED') && allArrivedOk(req)`
  - `allArrivedOk`: helper baru cek semua item APPROVED procurement sudah ARRIVED.
- `canConfirmInstall: mine && r === 'AWAITING_USER_CONFIRMATION'`
- `canScanBarcode`, `canCompleteInstall` (versi lama) → review/hapus pemakaian terkait barcode.

### 6.3 ActionPanel changes

`components/detail/ActionPanel.tsx`:
- Tambah tombol **"Mulai Instalasi"** (`canStartInstall`) — call `installation.api.startInstallation(id)`.
- Ganti tombol **"Selesaikan Instalasi"** — pakai `caps.canCompleteInstall` (bukan inline check). Hapus `window.confirm`, ganti dialog konfirmasi proper. Tanpa wizard barcode.
- Tambah tombol **"Konfirmasi Instalasi Selesai"** untuk USER (`canConfirmInstall`) — call `install/confirm` endpoint.
- Tambah banner countdown di status `AWAITING_USER_CONFIRMATION` (untuk user requester):
  - Tampilkan sisa waktu sebelum auto-confirm: `installMarkedDoneAt + 24h`.
  - Pesan: "ICT telah menyelesaikan instalasi pada [waktu]. Konfirmasi sebelum [ETA] atau sistem akan auto-konfirmasi."

### 6.4 Status display

- `StatusBadge` — tambah label "Menunggu Konfirmasi User" untuk `AWAITING_USER_CONFIRMATION` dengan warna distinct (mis. amber).
- `StatusPipeline` — insert step baru.
- `RequestFilters` — tambah opsi filter status baru.

### 6.5 Hooks/mutations

`useHardwareMutations.ts`:
- `markInstallDoneMut` — rename existing `completeInstallMut` (UI label diubah, endpoint sama, behavior baru di backend).
- `confirmInstallMut` — baru, call `install/confirm`.
- `startInstallMut` — baru, call `install/start`.

### 6.6 Notification

`in-app-notifier.listener.ts` + `email-notifier.listener.ts` — handle event baru:
- `INSTALL_MARKED_DONE` → notif ke `requesterId`. Title: "Konfirmasi Instalasi". Body: "ICT telah selesai instalasi. Konfirmasi dalam 24 jam atau akan auto-confirm." Deep-link: detail request.
- `INSTALL_USER_CONFIRMED` → notif ke ICT teknisi (`technicianId`) "User telah konfirmasi instalasi selesai".
- `INSTALL_AUTO_CONFIRMED` → notif ke requester + technician "Instalasi auto-konfirmasi karena melewati TTL 24 jam".

## 7. Audit & Activity Log

Single transition per activity row:

| Action | fromStatus | toStatus | actor |
|---|---|---|---|
| INSTALL_SCHEDULE_DONE | — (schedule) | — (schedule) | ICT |
| INSTALL_MARKED_DONE | INSTALLATION | AWAITING_USER_CONFIRMATION | ICT |
| INSTALL_USER_CONFIRMED | AWAITING_USER_CONFIRMATION | COMPLETED | requester |
| INSTALL_AUTO_CONFIRMED | AWAITING_USER_CONFIRMATION | COMPLETED | system |

## 8. Testing

### Unit
- `request-state.spec.ts` — assert transisi baru valid + invalid dilarang.
- `hardware-request-item.entity.spec.ts` — N/A (no entity logic change).
- `installation-schedule.service.spec.ts` — `completeInstallation` no longer touches req.status; throws if no schedule.
- `hardware-request-command.service.spec.ts` — `markInstallDone` happy + reject (status ≠ INSTALLATION, items not all ARRIVED). `confirmInstallation` happy + reject (wrong actor, wrong status). Auto path bypass actor check.

### Service / integration
- `installation.controller.routes.spec.ts` — endpoint `install/confirm` ada, RBAC: USER hanya bisa untuk own request, ICT denied.
- Integration: end-to-end transisi INSTALLATION → AWAITING_USER_CONFIRMATION → COMPLETED via API.

### Cron
- `install-auto-confirm.cron.spec.ts` — TTL boundary (23h59m: skip; 24h01m: trigger). Idempotent (re-run tidak duplicate).

### Frontend
- `ActionPanel` test — render tombol sesuai status + caps.
- `StatusPipeline` test — render step baru.
- E2E: ICT klik selesai → status ke awaiting → user klik konfirmasi → COMPLETED.

## 9. Rollout / Migration Plan

1. Deploy migration (tambah enum + kolom). Aman karena enum value baru, kolom NULL.
2. Deploy backend dengan endpoint baru + cron.
3. Deploy frontend.
4. Backfill aktivitas (optional) untuk request COMPLETED existing.
5. Monitor cron 24 jam pertama.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cron skip karena downtime | Cron idempotent; setiap 5 menit re-scan. TTL berdasarkan `installMarkedDoneAt`, tidak bergantung run-time spesifik. |
| User tidak menerima notif | Email + in-app + banner countdown di halaman detail. Auto-confirm jadi safety net. |
| Existing request stuck di INSTALLATION saat deploy | Tidak terdampak — flow lama yang masih INSTALLATION akan jalan ke flow baru saat ICT klik selesai. |
| Listener subscribe `INSTALL_COMPLETED` lama | Tetap di-emit saat confirm (manual/auto) untuk backward compat. |
| Race: user confirm + cron concurrent | Transaction guard: `WHERE status = AWAITING_USER_CONFIRMATION` dalam UPDATE. Yang kedua akan no-op + throw `ConflictException` ditangani idempotent. |

## 11. Open Questions

- (none — semua keputusan dikonfirmasi user pada brainstorm 2026-05-05)

---

*End of spec.*
