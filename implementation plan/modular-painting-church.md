# Zoom Calendar — Bug Fix, Sticky Headers & Design Improvements

## Context

The Zoom Calendar page has three issues to address:

1. **Bug: False positive conflict warning** — When User A books at 08:00 then cancels, and User B tries to book the same slot, a "Konflik dengan booking..." warning appears in the BookingModal even though the booking was cancelled (hard-deleted from DB). The Zoom link works fine — the error is purely a frontend false-positive from stale React Query cache data.

2. **Missing sticky headers** — When scrolling the calendar grid vertically, the day headers (Senin, Selasa, etc.) scroll away. The Time column already has `sticky left-0` for horizontal scroll, but no vertical pinning exists for the header row.

3. **Design polish** — Minor layout and UX improvements to make the calendar more intuitive.

---

## Critical Files

| File | Purpose |
|------|---------|
| `apps/frontend/src/features/zoom-booking/components/BookingModal.tsx` | Booking form + conflict detection (BUG) |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx` | Calendar grid (STICKY + DESIGN) |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendar.tsx` | Main container (DESIGN) |
| `apps/frontend/src/features/zoom-booking/components/UpcomingMeetingsPanel.tsx` | Right panel (DESIGN) |
| `apps/frontend/src/features/zoom-booking/hooks/useZoomBooking.ts` | API hooks (reference only) |

---

## Step 1 — Fix False Positive Conflict Warning (BookingModal.tsx)

### Root Cause

The BookingModal fetches calendar data via `useZoomCalendar()` (30s staleTime). After a cancellation:
- The cancel mutation's `onSettled` invalidates all `zoom-calendar` queries
- But if User B's BookingModal mounts before the refetch completes, the `useMemo` conflict detection runs against **stale cached data** that still shows the old booking
- Result: false "Konflik" warning banner appears

The backend is correct — it hard-deletes cancelled bookings and filters conflict queries by `status IN ('PENDING', 'CONFIRMED')`.

### Fix

Two changes in `BookingModal.tsx`:

**1a. Suppress conflict warning while data is refreshing:**

```tsx
// Line 135: Also destructure isFetching and dataUpdatedAt
const { data: calendarData, isFetching: isCalendarFetching } = useZoomCalendar(
    selectedAccountId,
    bookingDate || format(new Date(), 'yyyy-MM-dd'),
    bookingDate || format(new Date(), 'yyyy-MM-dd')
);
```

```tsx
// Line 142: Add isFetching check to suppress warning during refresh
const conflictWarning = useMemo(() => {
    if (isCalendarFetching || !calendarData || !startTime || !duration || !bookingDate) return null;
    // ... rest stays the same
}, [calendarData, bookingDate, startTime, duration, isCalendarFetching]);
```

**1b. Force fresh data when modal opens or date/account changes:**

```tsx
// Add import
import { useQueryClient } from '@tanstack/react-query';

// Inside the component:
const queryClient = useQueryClient();

// Force refetch whenever the modal opens or key inputs change
useEffect(() => {
    if (isOpen && selectedAccountId && bookingDate) {
        queryClient.invalidateQueries({
            queryKey: ['zoom-calendar', selectedAccountId, bookingDate, bookingDate]
        });
    }
}, [isOpen, selectedAccountId, bookingDate, queryClient]);
```

This ensures the BookingModal always gets fresh server data, and doesn't show a warning while that data is loading.

---

## Step 2 — Sticky Day Headers & Time Column (ZoomCalendarGrid.tsx)

### Current State
- Time label cells: `sticky left-0 z-10` (horizontal only)
- Day header cells: NO sticky (scroll away vertically)
- Corner cell (Time header): `sticky left-0 z-10` (horizontal only)

### Changes

**2a. Corner cell (Time header) — pin both axes:**

```tsx
// Line 182: Add sticky top-0 and raise z-index
<div className="bg-slate-50 dark:bg-slate-800/50 p-2 grid-separator-h grid-separator-v
    text-center text-sm font-medium sticky left-0 top-0 z-30
    text-slate-600 dark:text-slate-300">
    Time
</div>
```
Change: Add `top-0`, change `z-10` → `z-30`

**2b. Day header cells — pin vertically:**

```tsx
// Line 192-228: Add sticky top-0 z-20 and ensure solid background
<div
    key={day.date}
    className={cn(
        'p-3 grid-separator-h text-center transition-colors sticky top-0 z-20',
        dayIsToday
            ? 'bg-blue-50 dark:bg-blue-950/30 border-b-2 border-b-primary'
            : 'bg-slate-50 dark:bg-slate-800/80',
        !day.isWorkingDay && 'opacity-70'
    )}
>
```
Changes: Add `sticky top-0 z-20`, change `dark:bg-slate-800/50` → `dark:bg-slate-800/80` (more opaque so content doesn't bleed through)

**2c. Time label cells — ensure opaque backgrounds for sticky:**

The time cells at lines 238-247 already have `sticky left-0 z-10`. But their backgrounds use `bg-muted/40` and `bg-muted/20` which are semi-transparent — content bleeds through when scrolling.

Change to solid backgrounds:
- Hour marks: `bg-muted/40` → `bg-slate-100 dark:bg-slate-800`
- Half-hour marks: `bg-muted/20` → `bg-slate-50 dark:bg-slate-800/90`

---

## Step 3 — Design Improvements

### 3a. ZoomCalendarGrid.tsx — Better day header typography

Currently the day name uses generic `text-sm font-medium`. Make the header more scannable:

```tsx
// Day name: slightly bolder
<div className={cn(
    'text-sm font-semibold capitalize',
    dayIsToday && 'text-blue-600 dark:text-blue-400'
)}>
    {format(new Date(day.date), 'EEEE', { locale: idLocale })}
</div>
```

### 3b. ZoomCalendarGrid.tsx — Better half-hour time label visibility

Currently half-hour labels use `opacity-60` which is too faint. Change to `opacity-75` for better readability while still differentiating from hour marks.

### 3c. ZoomCalendar.tsx — Better scroll container structure

Currently the calendar grid container at line 214 uses `overflow-hidden` on the outer div and `overflow-auto` on the inner div. This is correct for sticky positioning.

Add a subtle inner shadow to hint at scroll capability:
```tsx
<div className="overflow-auto h-full custom-scrollbar scroll-smooth">
```

### 3d. BookingModal.tsx — Improve conflict warning UX

When the calendar is still loading, show a subtle loading indicator near where the conflict warning would appear:

```tsx
{isCalendarFetching && bookingDate && startTime && (
    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span className="text-sm">Memeriksa ketersediaan...</span>
    </div>
)}
```

Add `Loader2` to the lucide-react imports.

### 3e. ZoomCalendarGrid.tsx — Booking overlay improvements

Currently bookings that span only 1 row (30-min) show title + time but the text can overflow. Add `overflow-hidden` and tighter padding for short bookings:

For `booking.rowSpan === 1`:
```tsx
<div className="p-1.5 h-full flex flex-col min-w-0 flex-1 overflow-hidden">
    <div className="font-bold text-[11px] truncate flex items-center gap-1">
        <Video className="h-3 w-3 shrink-0" />
        <span className="truncate">{booking.title}</span>
    </div>
</div>
```

Currently the padding is `p-2` for all booking sizes. Change to conditional:
```tsx
<div className={cn(
    "h-full flex flex-col min-w-0 flex-1 overflow-hidden",
    booking.rowSpan === 1 ? "p-1.5" : "p-2"
)}>
```

And for rowSpan === 1, hide the time subtitle to prevent overflow:
```tsx
{booking.rowSpan >= 2 && (
    <div className="text-[11px] font-medium opacity-90 truncate">
        {booking.startTime} - {booking.endTime}
    </div>
)}
```

Currently the time is always shown. Change this to only show for rowSpan >= 2.

---

## What Does NOT Change

- Backend: All conflict detection, cancellation, and booking logic is correct
- WebSocket integration: Real-time updates work as designed
- Routing, authentication, permissions
- AccountSidebar, CancelBookingModal, RescheduleModal
- API hooks (useZoomBooking.ts) — no changes needed

---

## Verification

1. **Conflict bug fix:**
   - Book a slot at any time → confirm it appears on calendar
   - Cancel the booking → confirm slot becomes available
   - Open BookingModal and select the same time → NO conflict warning should appear
   - If testing with two browser sessions: User A books & cancels, User B books same slot → no false conflict warning

2. **Sticky headers:**
   - Open Zoom Calendar on a narrow viewport or zoom in
   - Scroll the calendar grid **horizontally** → Time column stays pinned on left
   - Scroll the calendar grid **vertically** → Day headers (Senin, Selasa, etc.) stay pinned at top
   - Corner "Time" cell stays visible when scrolling both ways
   - No content bleeding through sticky elements (solid backgrounds)

3. **Design improvements:**
   - Half-hour time labels are readable (not too faint)
   - Short bookings (30 min) display cleanly without text overflow
   - Loading indicator appears in BookingModal while checking availability
   - Calendar grid scrolls smoothly

4. **Regression check:**
   - Create a new booking → works, appears on calendar
   - Reschedule a booking → works
   - Cancel a booking → works, slot freed
   - Real-time updates across tabs → still working
