# Hardware Request — Bugfix & Role Flatten Design Spec

**Date:** 2026-04-19
**Status:** Approved (brainstorming phase)
**Supersedes (partial):** `2026-04-17-hardware-request-rework-design.md` — bagian 3-tier role (`ICT_LEAD`/`ICT_PROCUREMENT`/`ICT_TECHNICIAN`) digantikan single `ICT_STAFF`.
**Scope:** Perbaikan error route conflict, endpoint hilang, query param mismatch, plus penyederhanaan role tier ICT menjadi satu role.

---

## 1. Goals & Non-Goals

### Goals
- Hilangkan UUID validation error pada `GET /hardware-requests/calendar`, `/unscheduled`, `/my-today`.
- Tambah endpoint backend yang dipanggil frontend tetapi belum ada (`/unscheduled`, `/my-today`, `/users/technicians`).
- Selaraskan path & query param antara FE/BE (`schedule/reschedule`, `install/complete`, `technicianIds`).
- Sederhanakan role HR jadi satu: `ICT_STAFF` (semua ADMIN/MANAGER/AGENT setara, semua bisa approve & lanjut workflow).
- Pastikan halaman Manage Presets di `BentoAdminAgentsPage` benar-benar memberi akses `hardware_requests` lewat default preset.

### Non-Goals
- Tidak rework UI/UX (tetap mengikuti spec 2026-04-17).
- Tidak ubah skema DB (no migration tabel).
- Tidak menambah preset HR-spesifik baru — cukup pastikan default preset Admin/Manager/Agent sudah mencakup `hardware_requests`.
- Tidak ubah USER role behavior (tetap own-only).

---

## 2. Root Cause Summary

| Bug | Root cause |
|-----|------------|
| `/hardware-requests/calendar` 400 UUID | Module register `HardwareRequestController` (yang punya `@Get(':id')` + ParseUUIDPipe) sebelum `InstallationController` (`@Get('calendar')`). Nest match `:id` duluan. |
| `/hardware-requests/unscheduled` 400 UUID | Sama dengan di atas + endpoint `unscheduled` belum ada di backend. |
| `/v1/users/technicians` 404 | `users.controller` tidak punya `@Get('technicians')`. |
| `/hardware-requests/schedules/:id/reschedule` 404 | FE pakai path lama; backend pakai `:id/schedule/reschedule`. |
| `/installation/complete` 404 | FE typo path; backend pakai `:id/install/complete`. |
| Calendar query param diabaikan | FE kirim `technicianIds[]`, BE DTO baca `technicianId`. |
| Manage Presets terasa "tidak nyambung" | Sudah mounted, tapi role tier ICT_LEAD/PROC/TECH bikin user bingung; user mau satu role saja. |

---

## 3. Approach

**Approach A — Surgical fix.** Reorder controllers, tambah endpoint hilang, align FE path, flatten role.

---

## 4. Backend Changes

### 4.1 Module — controller order

`apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- Reorder `controllers`: `InstallationController` SEBELUM `HardwareRequestController`. Juga taruh `HardwareCommentController` & `HardwareActivityController` sesuai kebutuhan (yang static-prefix duluan).

### 4.2 InstallationController — endpoint baru

`apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`

Tambah handler (semua `@HardwareRoles(HardwareRole.ICT_STAFF)`):
- `@Get('unscheduled')` — list HR status `INSTALLATION` yang **belum** punya entri `installation_schedule` dengan status ∈ {`PROPOSED`,`CONFIRMED`,`IN_PROGRESS`}. Schedule berstatus `CANCELLED`/`RESCHEDULED` dihitung "belum terjadwal".
- `@Get('my-today')` — list `installation_schedule` di mana `technician_id = req.user.id` AND `scheduled_start` antara hari ini start–end.

### 4.3 CalendarQueryDto — rename param

`apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts`
- `technicianId?: string[]` → `technicianIds?: string[]` (match FE).
- Update pemakaian di `installation-schedule.service.ts → calendar()`.

### 4.4 Single ICT role

`apps/backend/src/modules/hardware-request/domain/enums/hardware-role.enum.ts`
- Tambah `ICT_STAFF = 'ICT_STAFF'`. Tetap export `ICT_LEAD/ICT_PROCUREMENT/ICT_TECHNICIAN` sebagai alias deprecated (back-compat tests).

`apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts`
- `pickRole()`: jika role-DB upper ∈ {`ADMIN`,`MANAGER`,`AGENT`,`ICT_LEAD`,`ICT_MANAGER`,`ICT_PROCUREMENT`,`ICT_TECHNICIAN`,`ICT_STAFF`,`PROCUREMENT`,`TECHNICIAN`,`AGENT_OPERATIONAL_SUPPORT`,`AGENT_ADMIN`} → `ICT_STAFF`. Else `USER`.

`apps/backend/src/modules/hardware-request/presentation/*.controller.ts`
- Setiap `@HardwareRoles(HardwareRole.ICT_LEAD)` / `(ICT_PROCUREMENT)` / `(ICT_TECHNICIAN)` (dan kombinasinya) → `@HardwareRoles(HardwareRole.ICT_STAFF)`.
- USER-allowed endpoint (create/submit/cancel/comment own/schedule own) tetap.

`apps/backend/src/modules/hardware-request/services/*.ts`
- Permission check internal (state machine guard `authorize()`): kalau cek `role === ICT_LEAD` dst → ganti `role === ICT_STAFF`.

`apps/backend/src/modules/hardware-request/listeners/*.ts`
- `listUsersWithRole('ICT_LEAD'|'ICT_PROCUREMENT'|'ICT_TECHNICIAN')` digabung jadi satu call helper `listIctStaff()` di `PermissionsService` (atau union 3 role-DB ADMIN+MANAGER+AGENT). Notifikasi sama untuk semua.

### 4.5 Users — technicians endpoint

`apps/backend/src/modules/users/users.controller.ts`
- Tambah `@Get('technicians')` (sebelum `:id`), guard `JwtAuthGuard`. Return `[{ id, fullName }]`.

`apps/backend/src/modules/users/users.service.ts`
- `getTechnicians()`: delegate ke `PermissionsService.listUsersWithRole('ICT_STAFF')` (atau query users `role IN (ADMIN,MANAGER,AGENT)` + filter `pageAccess.hardware_requests = true`). Single source of truth.

### 4.6 Permissions — default presets check

`apps/backend/src/modules/permissions/permissions.service.ts → seedDefaultPresets()`
- Pastikan default preset `Admin`, `Manager`, `Agent` punya `pageAccess.hardware_requests = true`. Jika belum, tambah/update saat seed (idempotent).

---

## 5. Frontend Changes

### 5.1 API alignment

`apps/frontend/src/features/hardware-request/api/installation.api.ts`
- `rescheduleSchedule(scheduleId, payload)` → ganti signature `(requestId, payload)`; URL: `/hardware-requests/${requestId}/schedule/reschedule`.
- `completeInstallation(requestId, payload)` URL: `/install/complete`.
- `fetchCalendarEvents` query param tetap `technicianIds`.
- `CalendarEventResponse.status` union: `'PROPOSED'|'CONFIRMED'|'IN_PROGRESS'|'DONE'|'RESCHEDULED'|'CANCELLED'`.

Caller component (`InstallationCalendarPage`, `UnscheduledList`, `InstallationScheduler`, label util):
- Update label mapping ke status baru.

### 5.2 Role flatten

`apps/frontend/src/features/hardware-request/types/index.ts`
- `HardwareRole = 'USER' | 'ICT_STAFF'`.

`apps/frontend/src/features/hardware-request/hooks/usePermissions.ts`
- Return `{ role: 'ICT_STAFF' | 'USER', isIctStaff, isUser }`. Mapping: `ADMIN|MANAGER|AGENT` → `ICT_STAFF`. Hapus `isIctLead/isTechnician/isProcurement`.

`apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- Semua `canReview/canApprove/canReject/canEditProcurement/canCompleteProcurement/canStartInstall/canScanBarcode/canCompleteInstall/canManageCatalog`: cek `user.role === 'ICT_STAFF'` + status guard tetap.
- `canPropose/canConfirm/canReschedule`: USER tetap own-side, ICT_STAFF sisi lainnya.

`apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx` & turunan: update kondisi role check.

### 5.3 Tests update

`apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`
- Refactor: hapus `ICT_LEAD/PROC/TECH` cases, ganti `ICT_STAFF`.

---

## 6. Tests (Backend)

Update existing:
- `mutual-scheduling.integration.spec.ts` — actor `'ICT_TECHNICIAN'` → `'ICT_STAFF'`.
- `email-notifier.listener.spec.ts`, `in-app-notifier.listener.spec.ts` — recipient query → `ICT_STAFF`.
- `hardware-request.gateway.auth.spec.ts` — role check.
- `hardware-activity.rbac.spec.ts` — single ICT_STAFF.

New:
- `installation.controller.spec.ts` — 200 untuk `/calendar`, `/unscheduled`, `/my-today` ICT_STAFF; 403 USER.
- `users.controller.technicians.spec.ts` — 200 list `{id, fullName}`.
- `hardware-role.guard.spec.ts` — pickRole mapping table.

---

## 7. Manual Smoke Checklist

- [ ] `GET /v1/hardware-requests/calendar?from=...&to=...` → 200, no UUID error.
- [ ] `GET /v1/hardware-requests/unscheduled` → 200.
- [ ] `GET /v1/hardware-requests/my-today` → 200 (login as AGENT).
- [ ] `GET /v1/users/technicians` → 200, array berisi user.
- [ ] InstallationCalendarPage render tanpa error.
- [ ] Manage Presets dialog buka di `/admin/agents`, 3 default preset terlihat dan `hardware_requests=true`.
- [ ] AGENT bisa: approve request, isi procurement field, schedule install, scan barcode, complete install (akses penuh sebagai ICT_STAFF).
- [ ] USER hanya bisa lihat/cancel request sendiri.

---

## 8. Migration & Rollout

- **No DB migration.** Perubahan code-only.
- **Optional preset verification migration**: idempotent script ensure default presets include `hardware_requests=true`. Boleh inline di `seedDefaultPresets()`.
- Deploy sequence: backend dulu (route + endpoint + guard), frontend menyusul (API path + role typing).
- Rollback: per-step git revert; tidak ada destructive operation.

---

## 9. Files Touched (Estimated)

**Backend:**
- `modules/hardware-request/hardware-request.module.ts`
- `modules/hardware-request/presentation/installation.controller.ts`
- `modules/hardware-request/presentation/hardware-request.controller.ts`
- `modules/hardware-request/presentation/hardware-catalog.controller.ts`
- `modules/hardware-request/presentation/hardware-comment.controller.ts`
- `modules/hardware-request/presentation/hardware-activity.controller.ts`
- `modules/hardware-request/presentation/hardware-dashboard.controller.ts`
- `modules/hardware-request/dto/calendar-query.dto.ts`
- `modules/hardware-request/domain/enums/hardware-role.enum.ts`
- `modules/hardware-request/guards/hardware-role.guard.ts`
- `modules/hardware-request/services/hardware-request-command.service.ts`
- `modules/hardware-request/services/installation-schedule.service.ts` (calendar param + unscheduled/my-today queries)
- `modules/hardware-request/listeners/in-app-notifier.listener.ts`
- `modules/hardware-request/listeners/email-notifier.listener.ts`
- `modules/users/users.controller.ts`
- `modules/users/users.service.ts`
- `modules/permissions/permissions.service.ts` (seed)
- Test files (existing & new)

**Frontend:**
- `features/hardware-request/api/installation.api.ts`
- `features/hardware-request/types/index.ts`
- `features/hardware-request/hooks/usePermissions.ts`
- `features/hardware-request/utils/permission.util.ts`
- `features/hardware-request/components/detail/ActionPanel.tsx`
- `features/hardware-request/components/calendar/InstallationCalendarPage.tsx` (status union)
- `features/hardware-request/components/calendar/UnscheduledList.tsx` (jika ada referensi role tier)
- Test files

---

## 10. Open Items

- Helper baru di `PermissionsService.listIctStaff()` vs union 3 calls — pilih saat implementasi (planning phase).
- Apakah pakai `hardware_requests` page access sebagai filter teknisi atau cukup role union — pilih di planning.
- Spec lama `2026-04-17` perlu banner partial-supersede di header (note pasca-merge).

---

**Approvals:**
- Brainstorming phase: ✅ user-approved 2026-04-19.
- Next step: invoke `writing-plans` skill untuk implementation plan terinci.
