# Zoom Calendar Page Redesign — Design Spec

**Date:** 2026-06-17
**Status:** Draft — pending user review
**Author:** Brainstorming session output
**Scope:** `apps/frontend/src/features/zoom-booking/` — the Zoom Calendar page and its dependent components.

---

## 1. TL;DR

Redesign the Zoom Calendar page from a 400-px slide-in side panel + top-strip "NEXT" layout into a **Command Center** layout: compact header + sub-bar + full-height time grid + 280-px persistent right column. Add **Gabungan** (Combined) account mode that lets users book without picking an account. Solve the "10 simultaneous meetings" rendering problem with vertical stacking + cap-at-4 + popover. Eliminate scroll on 17-24" monitors. Replace all emojis with Lucide icons.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal | Source |
|---|------|--------|
| G1 | No vertical scroll on 17" (1366×768) — fit header + 10 hours of grid + sidebar | User pain point |
| G2 | Support 10 Zoom accounts without overflow or scroll | User has 10 accounts |
| G3 | Book without thinking about which account (Gabungan mode) | User pain point |
| G4 | Color legend always visible (Saya/Tim/External/Blokir) | Problem #3 |
| G5 | Search bar visible in header, filter meetings live | Problem #2 |
| G6 | Quick book with one primary action (1 hour) + Custom… | User direction |
| G7 | Show recurring options up front, not hidden in form | Problem #9 |
| G8 | Show sync/system status inline | Problem #11 |
| G9 | Keyboard shortcuts discoverable | Problem #10 |
| G10 | Right column persistent — Upcoming + Quick Book + Tasks + System | Problem #5 |
| G11 | Booking modal centered, calendar stays visible | User direction |
| G12 | Render 10 simultaneous meetings without horizontal squeeze | New edge case |
| G13 | Enterprise-grade Lucide icons, no emoji | User direction |

### Non-Goals (this redesign)

- Backend changes — UI only.
- New API endpoints — reuse existing `useZoomCalendar`, `useZoomAccounts`, `useMyUpcomingBookings`, etc.
- Mobile-specific redesign — current bottom-sheet behavior is acceptable; this redesign optimizes for desktop.
- New view types beyond Month/Week/Day/My Bookings.
- Calendar drag-and-drop reschedule (deferred to a future spec).
- AI features / smart suggestions beyond auto-pick-by-load.

---

## 3. User Personas

| Persona | Goals | Key Behaviors |
|---------|-------|---------------|
| **Power Booker (Bagas)** | Book meetings across 10 accounts without micro-managing which account to use | Logs in → opens Gabungan → clicks 14:00 → books. Wants 1-click flow. |
| **Account Manager (Sari)** | Manage a specific account's calendar (e.g. Marketing) | Filters to single account, sees all team meetings, makes admin decisions. |
| **External Client Viewer** | Join a scheduled meeting | Goes to "My Bookings" tab → finds meeting → clicks Join. (Current My Bookings flow retained.) |

The redesign optimizes for **Power Booker** (highest-frequency flow) and keeps **Account Manager** + **External Client Viewer** flows intact.

---

## 4. Information Architecture

### Page zones (1366×768)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ZONE A · HEADER (48px)                                               │
│  Logo | Date nav + Today | Search | Account switcher | Book btn     │
├──────────────────────────────────────────────────────────────────────┤
│ ZONE B · SUB-BAR (36px)                                              │
│  View switcher | Quick Book 1h + Custom | Legend | Live | Help | SET │
├──────────────────────────────────┬───────────────────────────────────┤
│ ZONE C · CALENDAR (flex-1)       │ ZONE D · RIGHT SIDEBAR (280px)    │
│                                  │                                   │
│  Time grid                       │  D1 · Account Load (top 5)        │
│  7 day columns                   │  D2 · Upcoming meetings           │
│  10 hours visible (8-18)         │  D3 · Quick Book                  │
│  Per-cell overflow: 4 stack +    │  D4 · My Tasks                    │
│  popover for rest                │  D5 · System status               │
│                                  │                                   │
└──────────────────────────────────┴───────────────────────────────────┘
```

### Pixel math (17" 1366×768)

| Zone | Height | Width | Notes |
|------|--------|-------|-------|
| A · Header | 48 | 1366 | Single line, fixed |
| B · Sub-bar | 36 | 1366 | Single line, fixed |
| C · Calendar | 684 | 1086 | flex-1, scroll disabled |
| D · Sidebar | 684 | 280 | Persistent, internal scroll if needed |

For 18-22" (1920×1080): C = 996 × 1640, D same 280.
For 24" QHD (2560×1440): C = 1356 × 2280, D same 280.
For ≤1024px (tablet): D collapses to bottom sheet, C = full width with horizontal scroll per day.

---

## 5. Component Specifications

### 5.1 `ZoomCalendarHeader` (replaces current `ZoomCalendarHeader.tsx`)

**Purpose:** Single-line compact header with all navigation + search + account + book.

**Layout:** `[Logo+Title] [Date Nav+Today] [Search] [Account Switcher] [Book Meeting]`

**Behaviors:**
- `Search` focuses on `/` keypress. Filters meetings live across current view.
- `Account Switcher` opens `ZoomAccountSwitcher` modal (see 5.6).
- `Book Meeting` opens `ZoomBookingModal` (see 5.5).
- Logo click → navigate to `/zoom-calendar`.

**Removed from current header:**
- Account pills (moved to switcher).
- View switcher (moved to sub-bar).
- `format(date, 'MMMM yyyy')` text — replaced by `9 – 15 Jun 2026` compact format.

### 5.2 `ZoomCalendarSubBar` (new)

**Purpose:** Second compact row with view switcher, quick book, legend, system status.

**Layout:** `[View switcher] | [Quick Book: 1h] [Custom…] | [Legend] [Live] [Help] [Settings]`

**View switcher:** Same `Month | Week | Day | My` pill group as current `ZoomViewSwitcher.tsx`.

**Quick Book buttons:**
- Primary: `1 hour meeting` — opens `ZoomBookingModal` with duration=60min, no recurring.
- Secondary: `Custom…` — opens `ZoomBookingModal` with all fields editable.

**Legend:** Inline chips (Saya / Tim / External / Blokir) — always visible.

**Live indicator:** Green dot + "Live" text. Tapping shows last sync timestamp + manual sync button.

**Help (`?`):** Opens `ZoomShortcutsModal` with all keyboard shortcuts.

**Settings:** Navigates to `/zoom-calendar/settings` (existing `ZoomSettingsPage`).

### 5.3 `ZoomCalendarGrid` (refactor of `ZoomCalendarGrid.tsx`)

**Purpose:** Time grid with overflow handling for the Gabungan view.

**Algorithm change (vs. current column-split):**

Current: `processBookingsForDay` returns `columnIndex` + `totalColumns` — splits horizontally. Breaks when totalColumns > 4.

New: `processBookingsForDay` returns `rowIndex` + `totalRows` + `slotStart` + `slotEnd` — stacks vertically within each time cell. Cap `totalRows` at 4; overflow rendered as pill.

**Per-cell rendering:**
```
cellHeight = SLOT_HEIGHT * durationSlots
rows = min(totalRows, MAX_VISIBLE = 4)
rowHeight = (cellHeight - 4 - PILL_HEIGHT) / rows
if totalRows > 4: render pill "+N lainnya" below
```

**Visible row content:** `[3px color border] [Title truncate] [Account badge]`.

**Sort priority:** my-meetings first → by startTime → by accountName.

### 5.4 `ZoomRightSidebar` (new component, replaces side-panel slide-in)

**Purpose:** Persistent 280px right column with 5 sections.

**Sections (top to bottom):**
1. **D1 · Account Load** — Top 5 accounts by load percentage, with colored bar. "+5 lainnya" link to expand.
2. **D2 · Upcoming** — Next 3 user's meetings (compact, 1 line each).
3. **D3 · Quick Book** — Same 2 buttons as sub-bar (1 hour + Custom…).
4. **D4 · My Tasks** — Inline checklist, "+" to add task. Local state, persisted in localStorage.
5. **D5 · System** — Sync status, logged-in user, keyboard hint.

**Layout:** Each section separated by `border-b` 1px. D5 pinned to bottom via `margin-top: auto`.

### 5.5 `ZoomBookingModal` (refactor of `ZoomBookingForm.tsx` + `ZoomBookingPanel.tsx`)

**Purpose:** Centered modal, calendar remains 100% visible in background.

**New auto-pick banner** (only shown in Gabungan mode):
- Green left border, "AUTO-PICKED" badge.
- Text: "Paling luang di jam ini ({N} mtg / {M} available)".
- Dropdown button on right with selected account; click → show list of all available accounts at that time, sorted by load (ascending).

**Recurring section** (replaces inline form):
- Switch on/off (matches `ZoomRecurringOptions.tsx` exactly).
- When on: `freq` select (Hari/Minggu/Bulan) + `interval` input (1-30) + `until` date picker (optional).
- When off: section collapsed, only shows the switch.

**Form fields:** Title, Date, Time, Duration, Peserta, Agenda. Same as current.

**Account field** (Gabungan mode only): Replaced by auto-pick banner.

### 5.6 `ZoomAccountSwitcher` (new component)

**Purpose:** Dropdown modal for selecting account, optimized for 10+ accounts.

**Layout:**
```
[Search input]
[ Gabungan (highlighted, DEFAULT badge) ]
— Akun Individual (10) —
[ 2-col grid: 10 account cards ]
```

**Each account card:** color dot + name + meeting count + load %.

**Gabungan card:** Distinct gradient background, Globe icon, "DEFAULT" badge, "Lihat & book di semua akun · auto-pilih paling kosong" subtitle.

**Search:** Filters accounts by name (case-insensitive substring match).

**Keyboard nav:** `↑↓` between cards, `Enter` to select, `Esc` to close.

### 5.7 `ZoomOverflowPopover` (new component)

**Purpose:** Shows when user clicks a "+N lainnya" pill in a time cell with > 4 meetings.

**Layout:** Floating panel anchored to the pill. 380px wide, max-height 340px (scroll).

**Content:** List of all bookings at that time. Each item:
- 4px color bar (account color)
- Title (truncate)
- Time range
- Account name (with color dot)
- "SAYA" badge if it's user's booking
- Chevron icon → click navigates to detail.

**Header:** "10 Meeting · 14:00 – 15:00" + date subtitle.

**Footer:** "Book slot kosong" button (opens booking modal at that time, Gabungan mode auto-pick).

### 5.8 `ZoomShortcutsModal` (new component)

**Purpose:** Lists all keyboard shortcuts. Opens with `?`.

**Shortcuts:**

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `T` | Jump to today |
| `N` | Next period (week/day/month) |
| `P` | Previous period |
| `M` | Month view |
| `W` | Week view |
| `D` | Day view |
| `B` | Open Book Meeting modal |
| `G` | Toggle Gabungan |
| `?` | Open this shortcuts modal |
| `Esc` | Close modal / panel |
| Arrow keys | Navigate cells in grid |
| `Enter` | Open detail of focused cell |
| `Cmd/Ctrl + Enter` | Submit current form |

---

## 6. Data Flow & State

### 6.1 State ownership

| State | Owner | Notes |
|-------|-------|-------|
| `view` (month/week/day/my) | URL search param | Backed by `useCalendarView` hook (existing) |
| `currentDate` | URL search param | Same |
| `selectedAccountId` | URL search param + localStorage | `"gabungan"` for combined, account ID otherwise |
| `panel.isOpen`, `panel.mode` | `useBookingPanel` (existing) | Reused, no change |
| `searchQuery` | Local component state | Lives in `ZoomCalendarHeader` |
| `shortcutsModalOpen` | Local component state | Lives in `ZoomCalendarSubBar` |
| `overflowPopover` (date+time anchor) | Local component state | Lives in `ZoomCalendarGrid` |
| `myTasks` | Local component state + localStorage | Persist across sessions |

### 6.2 Hook changes

- `useCalendarView` — extend to support `view === 'gabungan'`. Or: keep current `view` enum (month/week/day/my) and add separate `accountScope: 'gabungan' | accountId` state.
- `useZoomCalendar` — already accepts accountId + date range. Pass `undefined` for accountId when in Gabungan mode → backend returns merged view.
- `useMyUpcomingBookings` — no change. Reused in D2.
- `useZoomAccounts` — no change. Reused in switcher.
- `useSyncMeetings` — no change. Triggered from Live indicator tap.

### 6.3 URL scheme

```
/zoom-calendar
  ?view=week
  &date=2026-06-11
  &account=gabungan          # or account ID like "acc-123"
  &booking=booking-456       # optional: open specific booking on load
```

Back/forward navigation must work for all four params.

**Default landing state:** When `account` param is absent, default to `gabungan` (combined view). Persist user's last selection in `localStorage` so refresh keeps their choice.

---

## 7. Screen Compatibility

| Screen | Viewport | Calendar Width | Time Visible | Scroll |
|--------|----------|----------------|--------------|--------|
| 17" entry | 1366×768 | 1086px | 8-18 (10h) | None |
| 18-22" FHD | 1920×1080 | 1640px | 8-18 (10h) | None |
| 24" FHD | 1920×1080+ | 1640px+ | 8-19 (11h) | None |
| 24" QHD | 2560×1440 | 2280px | 8-20 (12h) | None |
| ≤1024px tablet | various | full | scroll Y | Yes, time axis only |
| Mobile | <768px | full | scroll Y + bottom sheet | Yes |

**Implementation:** Use `useMediaQuery` hook (already in project) to switch layout variants. `lg:` Tailwind breakpoint at 1024px matches "tablet and up gets persistent sidebar".

---

## 8. Edge Cases

### 8.1 10 simultaneous meetings at same time

Handled by `ZoomOverflowPopover` — see 5.7. Vertical stack cap = 4.

### 8.2 All 10 accounts fully booked at user's preferred time

Show banner in booking modal: "Semua akun penuh di jam ini. Pilih slot lain atau override dengan blokir."

### 8.3 User has no `canBook` permission

Hide: `Book Meeting` button, `Quick Book` buttons, all clickable slots, view switcher to My Bookings remains.

### 8.4 Account color not set (newly created account)

Fallback to deterministic color from account ID hash. Avoid monochrome clash with theme.

### 8.5 Sync failure

Live indicator turns red. Tapping → toast "Gagal sinkronisasi · coba lagi" + retry button.

### 8.6 Empty state (no accounts configured)

Full-page empty state: "Belum ada akun Zoom. Hubungi admin untuk setup." + CTA "Request Account".

### 8.7 Recurring booking creates conflicts in some occurrences

For now: surface warning, allow user to continue. Future: split into individual bookings or skip conflicting occurrences.

### 8.8 Search returns no results

Inline message in calendar area: "Tidak ada meeting '{query}' di periode ini." Clear button.

---

## 9. Implementation Phases

### Phase 1 — Foundations (no behavior change yet)
1. Replace all emoji with Lucide icons in existing files.
2. Add `useMediaQuery` breakpoint check for sidebar-vs-bottom-sheet.
3. Extract design tokens for new colors (account load bars, etc.).

### Phase 2 — Layout shell
1. Refactor `ZoomCalendarShell` to 3-zone layout (header / main / sidebar).
2. Build `ZoomCalendarSubBar` (new).
3. Build `ZoomRightSidebar` (new).
4. Move `UpcomingMeetingsPanel` from top-strip into D2 of right sidebar.

### Phase 3 — Gabungan mode
1. Add `"gabungan"` as a valid value in `useCalendarView` account scope.
2. Update `useZoomCalendar` query to pass `undefined` for accountId in Gabungan.
3. Add `selectedAccountId === 'gabungan'` branch in `ZoomWeekView` / `ZoomDayView` / `ZoomMonthView`.
4. Build `ZoomAccountSwitcher` modal.
5. Update `useZoomCalendar` to handle merged accounts (backend may need to support this — verify with backend team).

### Phase 4 — Overflow handling
1. Refactor `processBookingsForDay` in `ZoomCalendarGrid` to return `rowIndex` + `totalRows` instead of `columnIndex` + `totalColumns`.
2. Update `ZoomWeekView` and `ZoomDayView` to use vertical stack.
3. Build `ZoomOverflowPopover` component.
4. Wire up popover anchor logic.

### Phase 5 — Booking modal
1. Refactor `ZoomBookingForm` and `ZoomBookingPanel` into a single `ZoomBookingModal`.
2. Add auto-pick banner (Gabungan mode only).
3. Refactor recurring section to match `ZoomRecurringOptions.tsx` exactly.
4. Add `1 hour` default duration in modal.

### Phase 6 — Quick actions
1. Add `1 hour` button to sub-bar.
2. Add `Custom…` button to sub-bar.
3. Wire both to open `ZoomBookingModal` with preset values.

### Phase 7 — Polish
1. Add `ZoomShortcutsModal` and wire keyboard handlers.
2. Add `My Tasks` widget to D4 with localStorage persistence.
3. Add search filter to calendar.
4. Add `Live` indicator tap-to-sync.
5. Empty state for no accounts.

### Phase 8 — Verification
1. Run smoke test on 17" viewport — no scroll.
2. Run smoke test on 24" QHD — no scroll, generous whitespace.
3. E2E test: book meeting in Gabungan mode → auto-picks least-loaded account.
4. E2E test: 10 simultaneous meetings render correctly, popover works.
5. A11y: keyboard navigation, focus traps in modals, aria-labels.
6. Visual regression: screenshot compare for Month/Week/Day in 3 viewport sizes.

---

## 10. Acceptance Criteria

1. Page fits in 1366×768 viewport with no vertical scroll in any state.
2. All 10 accounts visible in account switcher without additional scrolling.
3. Clicking any empty time slot in Gabungan mode opens modal with auto-picked account.
4. Switching to a single account filters calendar to that account only.
5. Color legend always visible; matches booking color bands.
6. Search filters meetings live (debounce 200ms).
7. Quick Book `1 hour` creates a 60-minute meeting without opening custom form.
8. `?` opens keyboard shortcuts modal.
9. 10 simultaneous meetings at same time: 4 visible + "+6 lainnya" pill, popover lists all 10.
10. No emoji in any visible UI; all icons are Lucide.
11. Page works in dark mode without color clashes (account colors must pass contrast checks against both backgrounds).
12. Existing flows (My Bookings, Settings, Audit Logs) still work without regression.

---

## 11. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | Does backend `useZoomCalendar` already support merged (all-accounts) query, or do we need backend changes? | Backend team | TBD |
| Q2 | Should `My Tasks` persist per-user server-side, or localStorage-only? | Product | TBD — default localStorage |
| Q3 | Can we hide a "primary" account for `1 hour` quick book (favorite account shortcut)? | Product | TBD — defer to v2 |
| Q4 | Color palette for 10 accounts: use 10-color spectrum or let admin define per-account? | Backend | TBD — default 10-color spectrum |
| Q5 | Should booking in Gabungan mode also offer "block instead of book" quick action? | Product | Out of scope |

---

## 12. Out-of-Scope (deferred)

- Drag-and-drop reschedule on calendar grid.
- AI-suggested meeting times.
- Voice booking ("Hey, schedule a meeting tomorrow at 10").
- Multi-day view in single screen.
- Inline meeting edit (vs. detail modal).
- Calendar export to Google/Outlook.

---

*End of spec.*
