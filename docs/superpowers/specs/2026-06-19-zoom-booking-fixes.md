# Zoom Booking Fixes — 5 Critical Issues

**Date:** 2026-06-19
**Status:** Draft — pending user review
**Author:** Brainstorming session output
**Scope:** Mixed (backend settings, frontend hook bug, frontend UI label)
**Related spec:** [2026-06-17-zoom-calendar-page-redesign.md](./2026-06-17-zoom-calendar-page-redesign.md)

---

## 1. TL;DR

Lima fix yang dilaporkan user pada 2026-06-19:

1. **Max booking/user/day** — buka default 50/hari, hapus hard cap yang tidak bisa di-config.
2. **Weekend (Sabtu/Minggu)** — buka default, hapus hardcoded weekend-block di frontend.
3. **Slot start/end 24 jam** — default 00:00–23:59.
4. **Load % selalu 0%** — bug di `useAccountLoadSummary.ts` filter `slot.status` terlalu ketat.
5. **Account identification di grid** — tambah visual hint (color dot + nama akun) supaya user tahu meeting dari akun mana, terutama saat overlap.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal | Source |
|---|------|--------|
| G1 | Default `maxBookingPerUserPerDay = 50`, tidak ada hard cap di DTO | Issue #1 user |
| G2 | Default `workingDays` termasuk Sabtu (6) dan Minggu (0) | Issue #2 user |
| G3 | Default `slotStartTime = 00:00`, `slotEndTime = 23:59` | Issue #3 user |
| G4 | Frontend **tidak** hardcode weekend-disabled — baca dari settings | Issue #2 user |
| G5 | Load % menghitung meeting dengan benar (bug fix + test) | Issue #4 user |
| G6 | Booking cell di week/day view menampilkan **color dot + nama akun truncated** supaya user tahu akun mana | Issue #5 user |
| G7 | Overflow popover menampilkan list dengan **color dot + nama akun** per item | Issue #5 user |

### Non-Goals

- Redesign besar halaman calendar (sudah di spec 2026-06-17).
- Mobile-specific fix (deferred).
- New backend endpoint.
- Custom user-defined labels per akun (di-defer, cukup nama akun default).
- Menghapus konfigurasi `workingDays` / `slotStartTime` / `slotEndTime` — admin masih bisa set custom value.

---

## 3. Issue 1 — Max booking per user per day

### Current state

**File:** `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts:37-38`
```ts
@Column({ type: 'int', default: 5 })
maxBookingPerUserPerDay: number;
```

**File:** `apps/backend/src/modules/zoom-booking/dto/zoom-settings.dto.ts:64-69`
```ts
@IsInt()
@Min(1)
@Max(50)        // ← hard cap
@IsOptional()
maxBookingPerUserPerDay?: number;
```

**File:** `apps/backend/src/modules/zoom-booking/services/zoom-settings.service.ts:34` (default factory)
```ts
maxBookingPerUserPerDay: 5,
```

**File:** `apps/backend/src/modules/zoom-booking/seeders/zoom-bootstrap.seeder.ts` — perlu di-cek apakah ada default `5` juga.

### Changes

1. **Entity default**: ubah `default: 5` → `default: 50`.
2. **DTO**: hapus `@Max(50)`. Validasi hanya `@Min(1)`.
3. **Service `getSettings()` default factory**: ubah `maxBookingPerUserPerDay: 5` → `50`.
4. **Seeder**: samakan ke `50`.
5. **Existing rows**: tambah migration kecil `UPDATE zoom_settings SET maxBookingPerUserPerDay = 50 WHERE maxBookingPerUserPerDay < 50` agar existing DB naik ke default baru (opsional, dengan backup note).

### Acceptance

- `GET /zoom-booking/settings` mengembalikan `maxBookingPerUserPerDay: 50` setelah fresh seed.
- Admin bisa set nilai berapa pun via `PATCH /zoom-booking/settings` (no upper bound).
- `ZoomBookingService.createBooking` enforce limit dari settings, bukan hardcoded.

---

## 4. Issue 2 — Working days include weekend

### Current state

**File:** `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts:31-32`
```ts
@Column({ type: 'jsonb', default: '[1,2,3,4,5]' })
workingDays: number[]; // 0=Sunday, 1=Monday, etc.
```

**File:** `apps/backend/src/modules/zoom-booking/services/zoom-settings.service.ts:32`
```ts
workingDays: [1, 2, 3, 4, 5], // Mon-Fri
```

**File:** `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx:208-214`
```tsx
(day.getDay() === 0 || day.getDay() === 6) && 'bg-slate-100/80 ... cursor-not-allowed'
...
onClick={() => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
}}
```

Frontend **hardcoded** weekend block, tidak baca dari `useZoomSettings`. Ini root cause kenapa setting tidak bisa di-config.

### Changes

1. **Entity default**: `[1,2,3,4,5]` → `[0,1,2,3,4,5,6]`.
2. **Service factory default**: samakan ke `[0,1,2,3,4,5,6]`.
3. **Seeder**: samakan.
4. **Frontend `ZoomWeekView.tsx`**:
   - Hapus hardcoded weekend check.
   - Baca `workingDays` dari `useZoomSettings` hook.
   - Jika `workingDays.includes(day.getDay()) === false`, render cell dengan disabled style (configurable, tidak hardcoded weekend).
5. **Frontend `ZoomDayView.tsx`**: cek apakah ada hardcode yang sama — fix.
6. **Frontend `ZoomBookingForm.tsx`**: cek apakah ada validasi weekend hardcoded — fix.
7. **Existing rows**: migration `UPDATE zoom_settings SET workingDays = '[0,1,2,3,4,5,6]'` untuk baris existing.

### Acceptance

- Default calendar buka weekend (Sabtu/Minggu bisa di-click dan di-book).
- Admin bisa set working days custom via settings UI.
- Frontend tidak lagi hardcode `day.getDay() === 0 || === 6`.

---

## 5. Issue 3 — 24-hour slot range

### Current state

**File:** `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts:19-23`
```ts
@Column({ type: 'time', default: '08:00' })
slotStartTime: string;

@Column({ type: 'time', default: '18:00' })
slotEndTime: string;
```

**File:** `apps/backend/src/modules/zoom-booking/services/zoom-settings.service.ts:28-29`
```ts
slotStartTime: '08:00',
slotEndTime: '18:00',
```

DTO regex `/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/` sudah support `00:00` dan `23:59`.

### Changes

1. **Entity default**: `08:00` → `00:00`, `18:00` → `23:59`.
2. **Service factory default**: samakan.
3. **Seeder**: samakan.
4. **Frontend `ZoomTimeSelect.tsx`**: render slot 00:00, 00:30, ..., 23:30. Pastikan 48 slot, bukan 20.
5. **Existing rows**: migration `UPDATE zoom_settings SET slotStartTime = '00:00', slotEndTime = '23:59'`.
6. **Performance note**: 48 slot × 7 hari = 336 cells per minggu. Untuk week view, time grid mungkin lebih panjang. Pertimbangkan virtual scroll atau collapse half-hour slot ke 1px height. **Untuk fix ini cukup render normal; optimasi visual di-defer ke spec redesign 2026-06-17.**

### Acceptance

- `GET /zoom-booking/settings` mengembalikan `slotStartTime: '00:00'`, `slotEndTime: '23:59'` setelah fresh seed.
- Time select dropdown menampilkan opsi 00:00 sampai 23:30 dengan interval 30 menit.
- Calendar grid menampilkan 48 rows untuk satu hari.

---

## 6. Issue 4 — Load % selalu 0% (bug fix)

### Root cause

**File:** `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts:62-77`
```ts
const meetingsInRange = days
    ? days.reduce((sum, day) => {
          const seen = new Set<string>();
          for (const slot of day.slots) {
              if (
                  slot.booking &&                                       // ← ada booking
                  (slot.status === 'booked' || slot.status === 'my_booking') &&  // ← status filter terlalu ketat
                  !seen.has(slot.booking.id)
              ) {
                  seen.add(slot.booking.id);
                  sum += 1;
              }
          }
          return sum;
      }, 0)
    : 0;
```

`slot.status` adalah status slot, bukan status booking. Slot status bisa `'booked' | 'available' | 'blocked' | 'my_booking' | 'past'`. Tapi di backend (per `ZoomCalendarGrid` + types), status aktual mungkin `'confirmed' | 'pending' | 'cancelled' | 'blocked'` atau `'available' | 'booked' | 'mine'`. **Tanpa baca types.ts secara definitif, filter ini rapuh.**

**Fix**: cukup cek `slot.booking` ada (truthy) — itu sudah mengimplikasikan slot terisi. Hapus `slot.status` filter.

### Changes

1. **`useAccountLoadSummary.ts`**: rewrite counting logic:
   ```ts
   const meetingsInRange = days
       ? days.reduce((sum, day) => {
             const seen = new Set<string>();
             for (const slot of day.slots) {
                 if (slot.booking && !seen.has(slot.booking.id)) {
                     seen.add(slot.booking.id);
                     sum += 1;
                 }
             }
             return sum;
         }, 0)
       : 0;
   ```
2. **Tambah unit test** `useAccountLoadSummary.test.ts` dengan fixture:
   - 2 meetings dalam 1 hari range → `loadPercent === 13` (2/16*100, rounded).
   - 0 meetings → `loadPercent === 0`.
   - 8 meetings dalam 1 hari → `loadPercent === 50`.
   - Same `booking.id` muncul di 2 slots (recurring) → counted once.

### Acceptance

- 2 meetings di range 1 hari = load 13% (bukan 0%).
- 8 meetings = load 50%.
- Test passed.

---

## 7. Issue 5 — Account identification di grid

### Current state

**File:** `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx:257-288`
```tsx
<div
    className="absolute h-3.5 rounded-sm cursor-pointer select-none ring-1 ring-black/10 flex items-center px-1.5 gap-1 overflow-hidden"
    style={{
        ...
        backgroundColor: booking.accountColorHex,  // ← color sudah ada
        color: '#fff',
    }}
>
    <Video className="h-2.5 w-2.5 shrink-0" />
    <span className="text-[10px] font-bold truncate">{booking.title}</span>  // ← cuma title
</div>
```

Warna background adalah account color, tapi:
- Tidak ada **nama akun** di cell.
- Saat 2 meeting overlap di jam sama (mis. Marketing 14:00 + Sales 14:00), user cuma lihat 2 bar berbeda — tidak ada text identifier.
- Cell sangat kecil (14px) — text truncate langsung hilang.

**Spec 2026-06-17** tidak punya requirement untuk account label di grid. Spec hanya menyebut "3px color border" di section 5.3. Butuh update requirement ini.

### Changes

1. **`ZoomWeekView.tsx`**: per-cell render:
   ```
   [● color dot 6px] [Video 10px] [accountName truncate 8 char] [title truncate]
   ```
   - Color dot = `accountColorHex` (border 1px ring untuk kontras).
   - Account name: ambil dari `booking.accountName` (perlu dicek apakah `ProcessedBookingV2` punya field ini; jika belum, tambahkan di `ZoomCalendarGrid.tsx` `processBookingsForDayV2` return).
   - Title truncate setelah account name.

2. **`ZoomDayView.tsx`**: pattern sama.

3. **`ZoomMonthView.tsx`**: per-cell tetap ringkas, tapi tambahkan 1 baris kecil di bawah title: `● accountName`.

4. **`ZoomOverflowPopover.tsx`**: per-item list, sudah ada `accountColorHex` dan `accountName` di `OverflowBooking` type. Pastikan render: `●  accountName · time · title · SAYA badge if mine`.

5. **Test update**:
   - `ZoomWeekView.test.tsx` — tambahkan assertion: cell mengandung `accountName` text.
   - `ZoomOverflowPopover.test.tsx` — sudah ada, cek coverage.

6. **Spec 2026-06-17** — tambahkan patch note: section 5.3 visible row content di-update dari `[3px color border] [Title truncate] [Account badge]` menjadi `[color dot] [Account name truncate] [Title truncate] [Account badge]`. (Spec existing tidak di-overwrite; cukup tambahkan "Patch 2026-06-19" note atau buat addendum.)

### Acceptance

- User bisa baca nama akun di setiap booking cell (walaupun truncated 8 char).
- Saat 2 meeting overlap, jelas beda karena ada 2 baris dengan 2 nama akun berbeda + 2 color dot.
- Hover tooltip tetap menampilkan detail lengkap (title, time, booked by).
- Pop overflow menampilkan list dengan `color dot + accountName` per item.

---

## 8. Migration & Data Safety

Untuk existing rows di `zoom_settings`:

```sql
-- Migration: 1779000000000-UpdateZoomSettingsDefaults
UPDATE zoom_settings
SET
    maxBookingPerUserPerDay = 50,
    workingDays = '[0,1,2,3,4,5,6]'::jsonb,
    slotStartTime = '00:00',
    slotEndTime = '23:59',
    updated_at = NOW()
WHERE
    maxBookingPerUserPerDay < 50
    OR workingDays = '[1,2,3,4,5]'::jsonb
    OR slotStartTime = '08:00'
    OR slotEndTime = '18:00';
```

**Safety**: migration cek `WHERE` clause agar **hanya update baris yang masih punya default lama** — tidak override nilai custom admin.

**File:** `apps/backend/src/migrations/1779000000000-UpdateZoomSettingsDefaults.ts`

---

## 9. Testing

### Backend

| Test | File | Coverage |
|------|------|----------|
| Settings DTO accepts max 100, 500 (no cap) | `zoom-settings.dto.spec.ts` | Issue #1 |
| Settings service creates with new defaults | `zoom-settings.service.spec.ts` | Issue #1, #2, #3 |
| Migration updates only old-default rows | integration | Safety |

### Frontend

| Test | File | Coverage |
|------|------|----------|
| `useAccountLoadSummary` counts 2 meetings = 13% | `useAccountLoadSummary.test.ts` (NEW) | Issue #4 |
| `useAccountLoadSummary` deduplicates recurring | same | Issue #4 |
| Week view cell renders `accountName` | `ZoomWeekView.test.tsx` | Issue #5 |
| Weekend cell clickable when `workingDays` includes 0/6 | `ZoomWeekView.test.tsx` | Issue #2 |
| Overflow popover shows color dot + accountName | `ZoomOverflowPopover.test.tsx` | Issue #5 |

### Manual

- Fresh DB seed → `GET /zoom-booking/settings` returns 50/[0..6]/00:00/23:59.
- Open calendar → klik Sabtu 10:00 → modal buka, bisa save.
- Switch ke `maxBookingPerUserPerDay = 100` di admin → save → buat 51 booking di hari sama → success.
- Calendar cell menampilkan nama akun truncated.

---

## 10. Implementation Phases

### Phase 1 — Backend defaults + DTO (Issues #1, #2, #3)
1. Update entity default values.
2. Remove `@Max(50)` di DTO.
3. Update `ZoomSettingsService.getSettings()` factory defaults.
4. Update seeder.
5. Add migration `1779000000000-UpdateZoomSettingsDefaults.ts`.
6. Update existing tests to reflect new defaults.

### Phase 2 — Frontend config-driven working days (Issue #2)
1. Verify `useZoomSettings` hook exists (cek) — wire to component.
2. Remove hardcoded weekend check di `ZoomWeekView.tsx`.
3. Remove same check di `ZoomDayView.tsx` dan `ZoomBookingForm.tsx`.
4. Add unit test: weekend clickable when workingDays includes 0/6.

### Phase 3 — Load % bug fix (Issue #4)
1. Refactor `useAccountLoadSummary.ts` counting logic.
2. Add unit test with fixtures.
3. Verify `ZoomAccountSwitcher` and `ZoomRightSidebar` display correctly.

### Phase 4 — Account label di grid (Issue #5)
1. Verify `ProcessedBookingV2` includes `accountName` (extend jika belum).
2. Update `ZoomWeekView.tsx` cell content.
3. Update `ZoomDayView.tsx` cell content.
4. Update `ZoomMonthView.tsx` cell content.
5. Update `ZoomOverflowPopover.tsx` list item.
6. Add tests.

### Phase 5 — Verification
1. Run all backend + frontend tests.
2. Manual smoke: fresh seed, weekend book, 50 bookings, check load %, check account name visible.
3. Visual regression: cell height tetap 14px, info cukup.

---

## 11. Acceptance Criteria

1. Fresh seed → settings contains `maxBookingPerUserPerDay: 50`, `workingDays: [0,1,2,3,4,5,6]`, `slotStartTime: '00:00'`, `slotEndTime: '23:59'`.
2. Admin bisa set max booking ke 500 (no cap) dan save tanpa error.
3. Admin bisa set working days ke `[1,2,3,4,5]` (Mon-Fri only) dan weekend kembali disabled.
4. Click Sabtu 10:00 di calendar → modal buka, save sukses, booking terbuat.
5. Account dengan 2 meetings di range 1 hari → load bar menampilkan ≥ 10% (bukan 0).
6. Week view cell menampilkan text nama akun (truncated 8 char) di samping color dot.
7. 2 meetings overlap di jam sama → user bisa baca 2 nama akun berbeda.
8. Overflow popover (jika >4) menampilkan list dengan color dot + account name per item.
9. Migration tidak override custom admin values (WHERE clause cek default).

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | Apakah `processedBookingV2.accountName` sudah ada di type? Jika belum, perlu extend di `ZoomCalendarGrid.processBookingsForDayV2` | Frontend | Verify |
| Q2 | Apakah `useZoomSettings` hook sudah ada? Atau perlu buat untuk expose `workingDays` ke frontend | Frontend | Verify |
| Q3 | Migration update WHERE clause aman? Atau admin perlu fresh install saja | Backend | Decide |

---

## 13. Out-of-Scope (deferred)

- Spec redesign 2026-06-17 implementation (separate work).
- Custom label per akun (Q2 di spec 2026-06-17).
- Mobile-specific view fix.
- Drag-and-drop reschedule.
- Calendar export.

---

*End of spec.*
