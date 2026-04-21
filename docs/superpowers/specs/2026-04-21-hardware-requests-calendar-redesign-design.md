# Hardware Requests Calendar — Redesign Spec

**Date:** 2026-04-21  
**Status:** Approved  
**Scope:** `apps/frontend/src/features/hardware-request/components/calendar/`

---

## Context

Halaman `/hardware-requests/calendar` dikeluhkan kurang user-friendly karena:
- Info event terlalu padat / sulit dibaca sekilas
- Sidebar (Today + Unscheduled) terlalu kecil dan tersembunyi
- Filter technician tidak intuitif
- Tampilan kalender terlalu plain tanpa visual hierarchy
- Popover detail event kurang informatif

Redesign bertujuan membuat halaman ini terasa seperti **ops dashboard** yang fungsional — informasi penting langsung terlihat, aksi penting mudah dijangkau, tanpa membuka halaman baru.

---

## Design Decisions

| Aspek | Keputusan |
|-------|-----------|
| Layout | Calendar full-width (tidak ada sidebar permanen) |
| Visual style | Clean Light / Enterprise — white/light gray, card shadow, status color terang |
| Event chip | Medium card: nomor HR + badge status + nama teknisi + jam mulai |
| Interaksi detail | Bottom Drawer slide-up saat klik event/tanggal |
| Sidebar pengganti | Badge pill buttons di header (Today / Unscheduled / Overdue) → panel slide-down |
| Technician filter | Chip pills (bukan dropdown) |

---

## Architecture

### Component Tree (Admin View)

```
InstallationCalendarPage
├── PageHeader
│   ├── StatsStrip                    [NEW]
│   ├── TechnicianFilterChips         [MODIFY: dropdown → chip pills]
│   ├── BadgePanelButton (Today)      [NEW — replaces MyTodayPanel in sidebar]
│   ├── BadgePanelButton (Unscheduled)[NEW — replaces UnscheduledList in sidebar]
│   └── BadgePanelButton (Overdue)    [NEW]
├── CalendarNav                       [MODIFY: extract from inline JSX]
├── FullCalendar (full-width)         [MODIFY: remove col-span-9 grid]
│   └── EventChipMedium               [NEW — custom eventContent render]
├── AgendaBottomDrawer                [NEW — replaces EventPopover]
│   ├── DrawerHandle
│   ├── DrawerHeader (tanggal + count)
│   └── AgendaEventCards (horizontal scroll)
│       └── AgendaEventCard           [NEW — selected=expanded, others=compact]
└── RescheduleConfirmModal            [MODIFY: restyled only, logic unchanged]
```

### Component Tree (User View)

```
UserInstallationCalendar
├── InfoBanner                        [MODIFY: restyled]
├── StatusLegend                      [MODIFY: restyled as pill row]
├── FullCalendar (read-only)          [MODIFY: clean light style]
└── UpcomingList                      [MODIFY: border-left colored cards]
```

---

## Components Detail

### StatsStrip `[NEW]`
- File: `components/calendar/StatsStrip.tsx`
- Props: `{ scheduled: number, today: number, unscheduled: number, rescheduleRequested: number }`
- Layout: horizontal flex row, 4 stat cards
- Stats: Total Scheduled (blue), Today (green), Unscheduled (amber), Reschedule Requested (red)
- Data: derived dari `useInstallationCalendar` hook yang sudah ada

### BadgePanelButton `[NEW]`
- File: `components/calendar/BadgePanelButton.tsx`
- Props: `{ label, count, color, children: ReactNode }`
- Behavior: pill button di header → klik toggle panel slide-down (absolute positioned, z-index layered)
- Only one panel open at a time (shared state di parent)
- Panel Today: list `useMySchedules` data, sorted by time, item clickable → open drawer
- Panel Unscheduled: list `fetchUnscheduledRequests` data, tiap item ada tombol "+ Jadwalkan" → buka scheduling modal
- Panel Overdue: subset dari `fetchUnscheduledRequests` data dimana `createdAt` > 7 hari yang lalu (client-side derived, tidak perlu endpoint baru)

### TechnicianFilterChips `[MODIFY]`
- File: `components/calendar/TechnicianFilter.tsx` (rename ke `TechnicianFilterChips.tsx`)
- UI: chip pills per teknisi (bukan `<select>` dropdown)
- "+ Tambah teknisi" chip → open popover multi-select
- Selected chips tampil warna biru (eff6ff border bfdbfe), ada tombol × untuk deselect

### EventChipMedium `[NEW]`
- File: `components/calendar/EventChipMedium.tsx`
- Digunakan sebagai `eventContent` di FullCalendar
- Content: status dot + nomor HR + badge status (abbreviated) + nama teknisi + jam
- Color per status:
  - PROPOSED: purple (ede9fe / 8b5cf6)
  - CONFIRMED: blue (eff6ff / 3b82f6)
  - IN_PROGRESS: amber (fffbeb / f59e0b)
  - DONE: green (f0fdf4 / 10b981)
  - RESCHEDULED / RESCHEDULE_REQUESTED: red (fee2e2 / ef4444)
  - CANCELLED: gray (f8fafc / 94a3b8)
- Month view: medium card (seperti mockup Section 1)
- Week/Day view: lebih tinggi, tampilkan info lengkap

### AgendaBottomDrawer `[NEW]`
- File: `components/calendar/AgendaBottomDrawer.tsx`
- State: `open: boolean`, `selectedDate: Date | null`, `selectedEventId: string | null`
- Trigger: klik event → set selectedEventId + open drawer; klik tanggal kosong → set selectedDate + open drawer
- Menggantikan `EventPopover.tsx` sepenuhnya
- Layout:
  - Handle bar (32px wide, 3px height, abu-abu)
  - Header: tanggal terpilih + jumlah event + tombol tutup
  - Body: horizontal scroll row of `AgendaEventCard`
- `AgendaEventCard` expanded (selected): info lengkap + 3 action buttons (Konfirmasi / Reschedule / → Detail)
- `AgendaEventCard` compact (others): status dot + nomor HR + item + teknisi + jam + "Klik untuk detail ▸"
- Animation: `transform: translateY` transition 300ms ease-out (gunakan `micro-animations.css` pattern)

### RescheduleConfirmModal `[MODIFY]`
- File: `components/calendar/RescheduleConfirmModal.tsx`
- Logic: **tidak berubah** — hanya restyled
- Style changes: rounded-12px, from/to visual diff (strikethrough lama, hijau baru), alasan textarea styled

---

## Data Flow

Tidak ada perubahan pada data fetching layer:
- `useInstallationCalendar(range, technicianIds)` → events untuk FullCalendar + StatsStrip
- `useMySchedules(range)` → Panel Today
- `fetchUnscheduledRequests()` → Panel Unscheduled
- `rescheduleSchedule(requestId, payload)` → dari AgendaBottomDrawer action → RescheduleConfirmModal

---

## Files to Create

| File | Aksi |
|------|------|
| `components/calendar/StatsStrip.tsx` | Create |
| `components/calendar/BadgePanelButton.tsx` | Create |
| `components/calendar/EventChipMedium.tsx` | Create |
| `components/calendar/AgendaBottomDrawer.tsx` | Create |

## Files to Modify

| File | Perubahan |
|------|-----------|
| `components/calendar/InstallationCalendarPage.tsx` | Restructure layout, remove grid col-span, integrate new components |
| `components/calendar/UserInstallationCalendar.tsx` | Restyled — banner, legend pills, upcoming cards |
| `components/calendar/TechnicianFilter.tsx` | Replace dropdown UI dengan chip pills |
| `components/calendar/RescheduleConfirmModal.tsx` | Restyled only |

## Files to Delete

| File | Alasan |
|------|--------|
| `components/calendar/EventPopover.tsx` | Digantikan `AgendaBottomDrawer` |
| `components/calendar/MyTodayPanel.tsx` | Digantikan `BadgePanelButton` (Today) |
| `components/calendar/UnscheduledList.tsx` | Digantikan `BadgePanelButton` (Unscheduled) |

---

## Status Color Reference

```ts
const STATUS_COLORS = {
  PROPOSED:              { bg: '#ede9fe', border: '#c4b5fd', dot: '#8b5cf6', text: '#4c1d95', badge: 'PRP' },
  PROPOSED_AWAITING_USER:{ bg: '#ede9fe', border: '#c4b5fd', dot: '#8b5cf6', text: '#4c1d95', badge: 'PAU' },
  CONFIRMED:             { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#1d4ed8', badge: 'CFM' },
  IN_PROGRESS:           { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e', badge: 'IP'  },
  DONE:                  { bg: '#f0fdf4', border: '#bbf7d0', dot: '#10b981', text: '#065f46', badge: 'DONE'},
  RESCHEDULED:           { bg: '#fee2e2', border: '#fecaca', dot: '#ef4444', text: '#991b1b', badge: 'RSC' },
  RESCHEDULE_REQUESTED:  { bg: '#fee2e2', border: '#fecaca', dot: '#ef4444', text: '#991b1b', badge: 'RRQ' },
  CANCELLED:             { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', badge: 'CXL' },
}
```

---

## Verification

1. **Render check**: buka `/hardware-requests/calendar` — stats strip tampil, calendar full-width, badge pills di header
2. **Badge panel**: klik "Today" → panel slide-down muncul, list jadwal hari ini benar
3. **Badge panel**: klik "Unscheduled" → panel muncul, tombol "+ Jadwalkan" ada per item
4. **Event chip**: event di calendar tampil medium card (nomor HR + teknisi + jam + warna status)
5. **Drawer**: klik event → bottom drawer slide-up, selected event expanded, others compact
6. **Drawer**: klik event compact → swap ke expanded state
7. **Drag & drop**: drag event ke tanggal lain → RescheduleConfirmModal muncul dengan from/to yang benar
8. **Reschedule**: isi alasan → submit → event pindah di calendar
9. **Technician filter**: chip pills tampil, × untuk deselect, "+ Tambah teknisi" buka multi-select
10. **User view**: non-ICT user lihat UserInstallationCalendar — info banner + legend + calendar + upcoming list
11. **Dark mode**: semua komponen baru support `dark:` variant (ikuti pola komponen existing)
12. **Responsif**: drawer tidak overlap stats strip di layar ≤1280px
