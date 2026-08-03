# Zoom Booking Calendar — 3 Fixes (Day View Mode + Overflow Pill + Dropdown)

**Date:** 2026-06-19
**Status:** Draft — pending user review
**Author:** Brainstorming session output
**Scope:** Mixed (UI bug fix + UX behavior change + form data filtering)

---

## 1. TL;DR

Tiga fix UX/UI di zoom-booking calendar:

1. **Tombol "+N lainnya" tidak bisa dipencet** — overflow pill di week/day view punya z-index konflik dengan cell underlying; perlu dinaikkan z-index dan dijamin pointer-events aktif.
2. **Day view harus single-account** — user prefer day view menampilkan satu akun spesifik (auto-pick paling sedikit meeting jika di Gabungan mode). Gabungan SEMUA booking hanya untuk week/month view.
3. **Dropdown time options harus filter available** — di form Book Meeting, time select dropdown hanya menampilkan slot yang AVAILABLE dari akun yang sedang dipilih (exclude booked slots).

---

## 2. Goals & Non-Goals

### Goals

| # | Goal |
|---|------|
| G1 | Tombol "+N lainnya" di week/day view clickable; click buka popover dengan list booking |
| G2 | Day view SELALU single-account; jika di Gabungan mode, auto-pick akun paling sedikit meeting + tampil banner info |
| G3 | Week/Month view tetap support Gabungan mode (semua booking dari semua akun di satu slot) |
| G4 | Time dropdown di form Book Meeting filter available slots saja (exclude booked) untuk akun yang dipilih |
| G5 | Tidak ada regression di existing flows (My Bookings, Settings, dll) |

### Non-Goals

- Redesain layout day view (di luar scope).
- Backend API changes (semua perubahan frontend, kecuali jika ditemukan backend bug).
- Migration data (semua perubahan runtime, tidak butuh schema change).

---

## 3. Issue A — Overflow pill clickable

### Current state

[ZoomWeekView.tsx:301-322](apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx#L301):

```tsx
// Overflow pill at bottom of stack when count > visible
if (overflowCount > 0) {
    const pillTopPx =
        (rowStart - 2) * SLOT_HEIGHT + 2 + MAX_VISIBLE_ROWS * 16;
    const cellLeft = `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + 4px)`;
    const cellWidth = `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} - 8px)`;
    cells.push(
        <button
            type="button"
            key={`overflow-${dateStr}-${rowStart}`}
            data-testid="overflow-pill"
            className="absolute h-4 rounded-sm bg-slate-800 text-white text-[9px] font-semibold flex items-center justify-center hover:bg-slate-900 z-20"
            style={{ top: pillTopPx, left: cellLeft, width: cellWidth }}
            onClick={(e) => {
                e.stopPropagation();
                openOverflow(e.currentTarget, dateStr, rowStart, calDay, group);
            }}
        >
            +{overflowCount} lainnya
        </button>,
    );
}
```

Pill z-index = `z-20`. Cell underlying dari `timeLabels.map` punya default z-index (auto). Bookings punya `z-20` di hover (`hover:z-20`). Saat overflow pill di-render, ia overlap dengan row cell di bawahnya. Cell underlying bisa capture pointer events di area pill.

### Changes

1. Naikkan z-index pill ke `z-40` (lebih tinggi dari cell + hover booking z-20).
2. Tambah `pointer-events-auto` eksplisit.
3. Tambah `cursor-pointer` (meskipun button default, untuk konsistensi).

### Acceptance

- Klik pill "+N lainnya" membuka popover dengan list semua booking di slot itu.
- Hover pill mengubah warna.
- Pill tetap terlihat di atas semua cell lain.

---

## 4. Issue B — Day view force single-account

### Current state

`ZoomCalendarPage.tsx:128-141`:
```tsx
const singleCalendar = useZoomCalendar(
    view !== 'my-bookings' && !useGabungan ? activeAccountId : undefined,
    dateRange.start,
    dateRange.end,
);
const mergedCalendar = useZoomMergedCalendar(
    view !== 'my-bookings' && useGabungan ? dateRange.start : undefined,
    view !== 'my-bookings' && useGabungan ? dateRange.end : undefined,
);

const calendar = useGabungan
    ? mergedCalendarToCalendar(mergedCalendar.data as MergedCalendarDay[] | undefined)
    : singleCalendar.data;
```

Saat `useGabungan=true` dan `view='day'`, calendar yang dipakai adalah merged (semua akun). User lihat SEMUA booking di satu hari, susah dibaca.

### Changes

1. **Force single-account untuk day view**: Jika `view === 'day'`, paksa `useGabungan=false`. Pakai `activeAccountId`; jika user di Gabungan mode, fallback ke akun dengan meeting paling sedikit (auto-pick).
2. **Auto-pick logic** (jawaban Q2): Di day view + Gabungan mode, pilih akun dengan `meetingsPerAccount` paling sedikit (paling luang). Jika ties, pilih akun dengan id terkecil (deterministic). TIDAK pakai last-used — supaya konsisten dengan konsep "auto-pick paling luang" yang sudah ada di Gabungan booking flow.

### Acceptance

- Pilih day view dari Gabungan mode → otomatis switch ke single-account (akun paling luang).
- Banner muncul menjelaskan behavior.
- Pilih week/month → kembali ke Gabungan mode (jika sebelumnya Gabungan).
- My Bookings tetap berfungsi seperti sebelumnya.

---

## 5. Issue C — Dropdown filter available slots

### Current state

`ZoomBookingForm.tsx:120-150` (perkiraan): form generate time options dari settings, tapi tidak filter berdasarkan availability akun yang dipilih. User lihat SEMUA 48 slot (00:00-23:30), padahal beberapa mungkin booked di akun yang dipilih.

### Changes

1. **Fetch calendar** untuk akun yang sedang dipilih (single-account mode): `useZoomCalendar(selectedAccountId, bookingDate, bookingDate)`.
2. **Filter time options**: hanya slot dengan `!slot.booking` (available).
3. **Empty state**: jika tidak ada slot available di hari itu, tampilkan pesan "Tidak ada slot tersedia di tanggal ini. Coba tanggal lain."
4. **Gabungan mode behavior**: tetap auto-pick (existing logic), tapi dropdown hanya show slot yang available di SEMUA akun (intersection) — atau tampilkan per-akun availability.

### Acceptance

- Pilih Zoom 1 + tanggal X → dropdown hanya jam yang Zoom 1 belum booked.
- Pilih jam yang booked → tidak ada di list.
- Pilih hari libur (no working days) → dropdown kosong + pesan.

---

## 6. Implementation Phases

### Phase 1 — Overflow pill clickable
1. Update `ZoomWeekView.tsx` pill z-index.
2. Test manual: cell dengan 5+ bookings → klik pill "+N lainnya" → popover buka.

### Phase 2 — Day view single-account enforcement
1. Update `ZoomCalendarPage.tsx`: detect day view + Gabungan → force single.
2. Tambah banner component di `ZoomDayView.tsx`.
3. Auto-pick logic di hook atau inline.

### Phase 3 — Dropdown filter
1. Update `ZoomBookingForm.tsx`: integrate `useZoomCalendar` untuk availability.
2. Filter time options array.
3. Empty state UI.

### Phase 4 — Verification
1. Manual smoke: overflow click, day view auto-pick, dropdown filter.
2. Existing tests pass (no regression).

---

## 7. Acceptance Criteria

1. Klik pill "+N lainnya" di week/day view membuka popover.
2. Day view SELALU menampilkan satu akun, bukan gabungan.
3. Banner info muncul saat user di day view.
4. Time dropdown di Book Meeting form hanya menampilkan slot available dari akun dipilih.
5. Existing flows (My Bookings, booking detail, cancel) tidak regression.

---

## 8. Resolved Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Banner day view dismissible atau sticky? | **Sticky** — selalu muncul, tidak dismissible |
| Q2 | Auto-pick pakai last-used atau paling sedikit meeting? | **Paling sedikit meeting** — konsisten dengan auto-pick Gabungan |

---

*End of spec.*
