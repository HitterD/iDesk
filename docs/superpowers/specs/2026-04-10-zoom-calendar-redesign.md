# Zoom Calendar Page Redesign — Design Spec

**Date**: 2026-04-10
**Status**: Approved
**Scope**: Full redesign — ZoomCalendarPage, ZoomSettingsPage, all modals, all supporting panels
**Approach**: Unified Calendar Shell + Side Panel (Approach A)

---

## 1. Problem Statement

Halaman ZoomCalendar saat ini memiliki 3 masalah utama:

1. **Kurangnya view options** — hanya ada month view, tidak ada week/day view
2. **Flow booking membingungkan** — modal booking tanpa konteks kalender, user kehilangan posisi
3. **UX/UI kurang baik** — layout tidak optimal, navigasi terbatas

## 2. Architecture & Layout

### Page Structure

```
┌──────────────────────────────────────────────────────┐
│ Header: Title + Account Selector + View Switcher     │
│         + Navigation (prev/next/today) + Actions     │
├────────────────────────────┬─────────────────────────┤
│                            │                         │
│   Calendar Content Area    │   Side Panel (optional) │
│   (Month/Week/Day view)    │   - Booking Form        │
│                            │   - Booking Detail       │
│   Responsive: full width   │   - Reschedule Form      │
│   when panel closed        │   Width: ~380px          │
│                            │   Mobile: bottom sheet    │
│                            │                         │
├────────────────────────────┴─────────────────────────┤
│ Upcoming Meetings Strip (collapsible, bottom)        │
└──────────────────────────────────────────────────────┘
```

### Component Tree

```
ZoomCalendarPage (shell)
├── ZoomCalendarHeader       — toolbar, view switcher, navigation
├── ZoomCalendarShell        — layout manager (content + panel)
│   ├── ZoomMonthView        — monthly grid calendar
│   ├── ZoomWeekView         — weekly time grid
│   ├── ZoomDayView          — daily time grid (detailed)
│   └── ZoomBookingPanel     — side panel (slide-in right)
│       ├── BookingForm      — new booking form
│       ├── BookingDetail     — existing booking detail
│       └── RescheduleForm   — reschedule form
├── UpcomingMeetingsPanel    — upcoming meetings strip
└── AccountSidebar           — Zoom accounts (left, collapsible)
```

## 3. View Options

### Month View (existing, enhanced)

- Grid calendar 7 columns (Sun-Sat)
- Booking slots as colored pill/chip indicators
- Color coding: booked (blue), my_booking (green), available (gray), blocked (red stripe)
- Click date → open side panel with slot list for that date (single-click does NOT switch view)
- Double-click date → switch to Day View for that date
- Click slot → open side panel booking

### Week View (NEW)

- 7 columns (days) × time rows (08:00 - 18:00, configurable via settings)
- 30-minute slot rows
- Bookings rendered as blocks spanning duration
- Current time indicator (red horizontal line)
- Click empty slot → open side panel with pre-filled time
- Click booking → open side panel detail

### Day View (NEW)

- Single column time grid (08:00 - 18:00)
- More detail than week view: participant info, join link
- Mini navigation: prev/next day in header
- Click slot → open side panel booking

### Shared Behavior

- **URL state**: `?view=week&date=2026-04-10&account=abc123` — shareable & bookmarkable
- **Drag-to-create** (week/day view): drag across time slots → side panel opens with range pre-filled
- **Smooth transitions** between views: fade animation, no full re-render
- **View state synced** to URL params via react-router `useSearchParams`

## 4. Booking Flow (Side Panel)

### Flow Diagram

```
State: Panel Closed
  │
  ├─ User clicks empty slot → Panel opens: BookingForm (pre-filled time)
  │                          ├─ Select Zoom account
  │                          ├─ Input meeting title (required, min 3 chars)
  │                          ├─ Select duration (15/30/45/60 min, default 30)
  │                          ├─ Participants/notes (optional)
  │                          ├─ Submit → optimistic update → toast success
  │                          └─ Cancel → panel closes
  │
  ├─ User clicks own booking → Panel opens: BookingDetail
  │                          ├─ Full info (title, time, host, join link)
  │                          ├─ Actions: Reschedule / Cancel
  │                          └─ Close panel
  │
  └─ User clicks others' booking → Panel opens: BookingDetail (read-only)
                                 ├─ Info (title, time, host, status)
                                 └─ Close panel
```

### Side Panel Behavior

- **Opening**: slide-in from right (380px desktop, bottom sheet on screens < 768px)
- **Mobile breakpoint**: `md:` (768px) — below this threshold, side panel becomes a bottom sheet
- **Closing**: X button, click empty calendar area, or Escape key
- **Booking success**: panel stays open showing confirmation + join link, auto-close after 5 seconds
- **Optimistic update**: calendar updates immediately before server response, rollback on failure
- **Reschedule**: panel stays open, form transitions to reschedule mode with pre-filled data

### Form Validation

- Title required (min 3 characters)
- Duration default: 30 minutes
- Cannot book in the past
- Cannot overlap with own bookings
- Real-time availability check via `useZoomCalendar` hook

## 5. Supporting Components

### Upcoming Meetings Panel (Bottom Strip)

- Horizontal strip below calendar, collapsible
- Shows 5 nearest meetings: time, title, host, status badge
- Quick actions: Join (open Zoom link), Detail (open panel), Cancel
- Empty state: "Tidak ada meeting mendatang" with illustration
- Auto-refresh via WebSocket (`useZoomSocket`)

### Account Sidebar (Integrated)

- Moved from separate component into calendar shell
- Compact: avatar + account name, booking count badge
- Active account highlighted with primary color
- Collapsible on mobile (toggle button)
- Default state: expanded on desktop (≥768px), collapsed on mobile
- Multi-account selector dropdown (if > 1 account)

### ZoomSettingsPage Redesign

Separate page, but with UX improvements:

- **Tab-based layout**: Accounts | Settings | Audit Logs
- **Accounts tab**: Card per account with status indicator, quick actions
- **Settings tab**: Form sections with save per section (not one giant form)
- **Audit Logs tab**: Integrated `ZoomAuditLogsViewer` with better filter/pagination
- **Sync button** stays in header with last sync timestamp

### Error Handling & Loading

- `ZoomErrorBoundary` retained (already exists)
- `ZoomSkeletons` expanded for week/day view loading states
- Toast notifications for all mutations (existing pattern)
- Offline indicator when WebSocket disconnected

## 6. Data Flow & API Integration

### Data Flow

```
ZoomCalendarPage
│
├── useZoomAccounts()          ← ['zoom-accounts'] (staleTime: 5min)
├── useZoomCalendar(id, start, end)  ← ['zoom-calendar', id, start, end] (staleTime: 30s)
├── useMyUpcomingBookings()    ← ['my-upcoming-zoom-bookings'] (refetchInterval: 60s)
├── useZoomSocket()            ← WebSocket real-time updates
│
├── Mutations (all existing):
│   ├── useCreateBooking()     → optimistic update → invalidate calendar
│   ├── useCancelBooking()     → invalidate calendar + upcoming
│   └── useRescheduleBooking() → optimistic update → invalidate
│
├── View state:
│   ├── viewMode: 'month' | 'week' | 'day'  (URL param)
│   ├── selectedDate: Date                    (URL param)
│   ├── selectedAccountId: string             (URL param / localStorage)
│   └── panelState: 'closed' | 'booking' | 'detail' | 'reschedule' (local state)
│
└── URL sync (react-router):
    /zoom-calendar?view=week&date=2026-04-10&account=abc123
```

### Key Decisions

- **All API hooks already exist** in `useZoomBooking.ts` — no new endpoints needed
- **URL params** for view/date/account — enables shareable links & browser back/forward
- **Panel state** is local (not URL) since it's ephemeral
- **WebSocket** already available via `useZoomSocket` — just needs integration to new views
- **Optimistic updates** already in `useCreateBooking` — retained

### No Backend Changes

The entire redesign is **frontend-only**. The backend `zoom-booking` module is complete and requires no modifications.

## 7. Technical Notes

### New Files to Create

```
apps/frontend/src/features/zoom-booking/
├── components/
│   ├── ZoomCalendarHeader.tsx      (NEW)
│   ├── ZoomCalendarShell.tsx      (NEW)
│   ├── ZoomMonthView.tsx          (NEW — replaces ZoomCalendarGrid content)
│   ├── ZoomWeekView.tsx           (NEW)
│   ├── ZoomDayView.tsx            (NEW)
│   ├── ZoomBookingPanel.tsx       (NEW — replaces BookingModal)
│   ├── ZoomBookingForm.tsx        (NEW — extracted from BookingModal)
│   └── ZoomViewSwitcher.tsx       (NEW)
├── hooks/
│   ├── useCalendarView.ts         (NEW — URL param sync)
│   └── useBookingPanel.ts         (NEW — panel open/close/state)
└── pages/
    ├── ZoomCalendarPage.tsx       (REWRITE)
    └── ZoomSettingsPage.tsx        (REFACTOR — tab layout)
```

### Files to Modify

- `ZoomCalendarPage.tsx` — rewrite to use new shell architecture
- `ZoomSettingsPage.tsx` — refactor to tab-based layout
- `ZoomCalendar.tsx` — adapt to work within new shell
- `UpcomingMeetingsPanel.tsx` — enhance with quick actions

### Files to Deprecate

- `BookingModal.tsx` — replaced by `ZoomBookingPanel`
- `BookingTooltip.tsx` — replaced by side panel detail view
- `RescheduleModal.tsx` — reschedule now handled within `ZoomBookingPanel`
- `ZoomCalendarGrid.tsx` — replaced by `ZoomMonthView` / `ZoomWeekView` / `ZoomDayView`

Note: `CancelBookingModal.tsx` is retained — cancel confirmation still needs a modal dialog for destructive action confirmation.

### Styling Approach

- Consistent with existing iDesk design system (TailwindCSS + Radix UI)
- Follow BentoDashboard visual patterns
- Dark mode support (existing `dark:` prefix patterns)
- CSS transitions for view switching and panel animations

### Performance Considerations

- Lazy load week/day views (React.lazy + Suspense)
- Virtualize time grid rows in day/week view for performance
- Memoize calendar cell rendering with React.memo
- Use `staleTime` from existing hooks (30s calendar, 5min accounts)

## 8. Scope Boundaries

### In Scope

- ZoomCalendarPage full redesign
- ZoomSettingsPage UX refactor (tab layout)
- All booking flows (create, detail, reschedule, cancel)
- View switching (month, week, day)
- Side panel interaction pattern
- URL state management
- Mobile responsive (bottom sheet for panel)
- Upcoming meetings strip enhancement

### Out of Scope

- Backend API changes
- New Zoom API integrations
- Notification system changes
- Google/Outlook calendar sync UI changes
- Admin-only features beyond existing
- Push notification changes