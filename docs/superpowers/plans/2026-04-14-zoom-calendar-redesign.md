# Zoom Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Zoom Calendar feature with modern UI, add My Bookings view, lock booked time slots visually, and replace duration free-input with a fixed dropdown.

**Architecture:** Extend `CalendarView` type to include `'my-bookings'` as a 4th view; render a dedicated `ZoomMyBookingsView` when active. Improve overlap rendering in week/day views by computing side-by-side column positions. Month view gains a day-popover for many events. Duration becomes a Select dropdown. Time options in the booking form show visual lock indicators for already-booked slots.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, date-fns, Tailwind CSS, shadcn/ui (Button, Select, Badge, Popover)

---

## File Map

### Files to Create
| Path | Responsibility |
|------|----------------|
| `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx` | Full "My Bookings" list with past/upcoming tabs, cancel/reschedule |
| `apps/frontend/src/features/zoom-booking/components/ZoomMonthDayPopover.tsx` | Floating popover for "+N more" in month view |

### Files to Modify
| Path | What changes |
|------|-------------|
| `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts` | Add `'my-bookings'` to `CalendarView` type; skip dateRange computation for that view |
| `apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx` | Add "My Bookings" tab button |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx` | Hide prev/next/today nav when view is `my-bookings` |
| `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx` | Render `ZoomMyBookingsView` for `my-bookings` view; skip calendar data fetch |
| `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx` | Duration → Select dropdown; lock booked start times with visual indicator |
| `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx` | Day popover for "+N more"; modern compact event pills |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx` | `processBookingsForDay` → add `columnIndex`/`totalColumns` for overlap layout |
| `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx` | Use columnIndex/totalColumns for side-by-side booking rendering; modern styling |
| `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx` | Same overlap fix; modern styling |
| `apps/frontend/src/features/zoom-booking/components/index.ts` | Export new components |

---

## Task 1: Duration Field → Fixed Dropdown

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx:273-293`

- [ ] **Step 1: Replace duration Input with Select**

Find the duration section in `ZoomBookingForm.tsx` (lines 273–293) and replace it:

```tsx
// Replace the entire duration div (space-y-1.5) with:
const DURATION_OPTIONS = [
    { value: 30,  label: '30 menit (0.5 jam)' },
    { value: 60,  label: '60 menit (1 jam)' },
    { value: 90,  label: '90 menit (1.5 jam)' },
    { value: 120, label: '120 menit (2 jam)' },
    { value: 180, label: '180 menit (3 jam)' },
    { value: 240, label: '240 menit (4 jam)' },
];

// In the JSX (replacing the Input block):
<div className="space-y-1.5">
    <Label className="text-xs font-semibold">
        <Clock className="h-3.5 w-3.5 inline mr-1" />
        Durasi *
    </Label>
    <Select
        value={String(duration)}
        onValueChange={(v) => setDuration(Number(v))}
    >
        <SelectTrigger className="h-9">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
</div>
```

Also change the `useState` default from `useState<number>(60)` — it's already 60, no change needed.

- [ ] **Step 2: Remove unused imports after change**

Remove `min`, `max`, `step` — no longer used. The `Input` import can stay (used elsewhere in the form).

- [ ] **Step 3: Verify build passes**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -40
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx
git commit -m "feat: replace duration free-input with fixed dropdown options"
```

---

## Task 2: Lock Booked Time Slots in Booking Form

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`

- [ ] **Step 1: Compute booked time set from calendar data**

Add this `useMemo` after `const timeOptions = useMemo(...)` in `ZoomBookingForm.tsx`:

```tsx
// Set of start times that are NOT available for the selected date
const unavailableStartTimes = useMemo(() => {
    const unavailable = new Set<string>();
    if (!calendarData || !bookingDate) return unavailable;

    const dayData = calendarData.find((d) => d.date === bookingDate);
    if (!dayData) return unavailable;

    for (const slot of dayData.slots) {
        if (slot.status === 'booked' || slot.status === 'my_booking' || slot.status === 'blocked') {
            unavailable.add(slot.time);
        }
    }
    return unavailable;
}, [calendarData, bookingDate]);
```

- [ ] **Step 2: Apply disabled state and visual indicator to time SelectItems**

Replace the time `<SelectContent>` block in `ZoomBookingForm.tsx` (the Waktu Mulai Select):

```tsx
<SelectContent>
    {timeOptions.map((time) => {
        const isUnavailable = unavailableStartTimes.has(time);
        return (
            <SelectItem
                key={time}
                value={time}
                disabled={isUnavailable}
                className={isUnavailable ? 'opacity-50 line-through text-red-400' : ''}
            >
                <span className="flex items-center gap-2">
                    {isUnavailable && (
                        <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    )}
                    {time}
                    {isUnavailable && (
                        <span className="text-[10px] text-red-400 ml-1">Terpakai</span>
                    )}
                </span>
            </SelectItem>
        );
    })}
</SelectContent>
```

- [ ] **Step 3: Verify — open the booking form, select a date with existing bookings, confirm those times show as red/disabled**

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx
git commit -m "feat: lock and visually mark booked time slots in booking form"
```

---

## Task 3: My Bookings View — Hook & View State

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts`

- [ ] **Step 1: Extend CalendarView type**

In `useCalendarView.ts`, change line 5:

```tsx
// Before:
export type CalendarView = 'month' | 'week' | 'day';

// After:
export type CalendarView = 'month' | 'week' | 'day' | 'my-bookings';
```

- [ ] **Step 2: Handle `my-bookings` in `getDateRange` and navigation**

In the `getDateRange` function, add a case for `'my-bookings'` that returns today's range (it won't be used for fetching but satisfies the type):

```tsx
function getDateRange(view: CalendarView, date: Date): { start: string; end: string } {
    switch (view) {
        // ... existing cases ...
        case 'my-bookings': {
            const today = format(new Date(), 'yyyy-MM-dd');
            return { start: today, end: today };
        }
    }
}
```

Also handle `'my-bookings'` in `navigatePrev` and `navigateNext` (just return without changing date — no-op):

```tsx
const navigatePrev = useCallback(() => {
    if (view === 'my-bookings') return;
    let newDate: Date;
    switch (view) { /* existing cases */ }
    updateParams(view, newDate);
}, [view, currentDate, updateParams]);

const navigateNext = useCallback(() => {
    if (view === 'my-bookings') return;
    // ... same pattern ...
}, [view, currentDate, updateParams]);
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts
git commit -m "feat: add my-bookings to CalendarView type"
```

---

## Task 4: My Bookings View — Component

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`

- [ ] **Step 1: Create ZoomMyBookingsView component**

```tsx
/**
 * ZoomMyBookingsView — shows all of the current user's bookings
 * (upcoming and past) without needing to navigate the calendar.
 */
import { useState, useMemo } from 'react';
import { format, parseISO, isPast, isFuture, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Video, Calendar, Clock, ExternalLink, Copy,
    CalendarClock, Trash2, Search, ChevronRight,
    CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMyBookings, useCancelOwnBooking } from '../hooks';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import type { ZoomBooking } from '../types';
import { formatZoomAccountName } from '../utils';

type BookingTab = 'upcoming' | 'past' | 'all';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    confirmed: { label: 'Confirmed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    cancelled: { label: 'Dibatalkan', color: 'text-red-500 bg-red-50 border-red-200', icon: XCircle },
    pending:   { label: 'Pending',    color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertCircle },
};

export function ZoomMyBookingsView({ onBookingClick }: { onBookingClick?: (id: string) => void }) {
    const { data: bookings, isLoading } = useMyBookings();
    const cancelOwnBooking = useCancelOwnBooking();

    const [tab, setTab] = useState<BookingTab>('upcoming');
    const [search, setSearch] = useState('');
    const [cancelTarget, setCancelTarget] = useState<ZoomBooking | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<ZoomBooking | null>(null);

    const filtered = useMemo(() => {
        const all = bookings ?? [];
        const byTab = all.filter((b) => {
            const date = parseISO(b.bookingDate);
            if (tab === 'upcoming') return isFuture(date) || isToday(date);
            if (tab === 'past')     return isPast(date) && !isToday(date);
            return true;
        });
        if (!search.trim()) return byTab;
        const q = search.toLowerCase();
        return byTab.filter(
            (b) =>
                b.title.toLowerCase().includes(q) ||
                b.zoomAccount?.name?.toLowerCase().includes(q)
        );
    }, [bookings, tab, search]);

    const grouped = useMemo(() => {
        const map = new Map<string, ZoomBooking[]>();
        for (const b of filtered) {
            const key = b.bookingDate;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(b);
        }
        // Sort dates ascending for upcoming, descending for past/all
        const entries = [...map.entries()];
        entries.sort(([a], [b]) => (tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
        return entries;
    }, [filtered, tab]);

    if (isLoading) {
        return (
            <div className="flex-1 p-6 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Sticky toolbar */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur space-y-3">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                    {(['upcoming', 'past', 'all'] as BookingTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                tab === t
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            {t === 'upcoming' ? 'Mendatang' : t === 'past' ? 'Selesai' : 'Semua'}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                        placeholder="Cari booking..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                    />
                </div>
            </div>

            {/* Booking list */}
            <div className="flex-1 overflow-auto custom-scrollbar px-4 py-3 space-y-4">
                {grouped.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Tidak ada booking
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {tab === 'upcoming' ? 'Belum ada meeting yang akan datang' : 'Belum ada riwayat booking'}
                        </p>
                    </div>
                )}

                {grouped.map(([date, dayBookings]) => {
                    const parsedDate = parseISO(date);
                    const isDateToday = isToday(parsedDate);
                    return (
                        <div key={date}>
                            {/* Date header */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={cn(
                                    "text-xs font-bold px-2 py-0.5 rounded-full",
                                    isDateToday
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-500 dark:text-slate-400"
                                )}>
                                    {isDateToday
                                        ? 'Hari ini'
                                        : format(parsedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })
                                    }
                                </span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>

                            {/* Bookings for this date */}
                            <div className="space-y-2">
                                {dayBookings.map((booking) => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onView={() => onBookingClick?.(booking.id)}
                                        onReschedule={() => setRescheduleTarget(booking)}
                                        onCancel={() => setCancelTarget(booking)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            <RescheduleModal
                booking={rescheduleTarget}
                isOpen={!!rescheduleTarget}
                onClose={() => setRescheduleTarget(null)}
            />
            <CancelBookingModal
                booking={cancelTarget}
                isOpen={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                onSuccess={() => setCancelTarget(null)}
                isOwner
            />
        </div>
    );
}

interface BookingCardProps {
    booking: ZoomBooking;
    onView: () => void;
    onReschedule: () => void;
    onCancel: () => void;
}

function BookingCard({ booking, onView, onReschedule, onCancel }: BookingCardProps) {
    const status = booking.status ?? 'confirmed';
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
    const StatusIcon = cfg.icon;
    const isPastBooking = isPast(parseISO(booking.bookingDate)) && !isToday(parseISO(booking.bookingDate));
    const hasLink = !!booking.meeting?.joinUrl;

    return (
        <div
            className={cn(
                "group relative rounded-2xl border bg-white dark:bg-slate-900 p-4",
                "shadow-sm hover:shadow-md transition-all duration-200",
                "border-slate-200 dark:border-slate-700",
                isPastBooking && "opacity-70"
            )}
        >
            {/* Color accent */}
            <div
                className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                style={{ backgroundColor: booking.zoomAccount?.colorHex ?? '#3b82f6' }}
            />

            <div className="pl-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {booking.title}
                        </h4>
                        <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                            cfg.color
                        )}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {cfg.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.startTime} – {booking.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                            <Video className="h-3 w-3" />
                            {formatZoomAccountName(booking.zoomAccount?.name)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={onView}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Lihat detail"
                >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
            </div>

            {/* Actions for upcoming bookings */}
            {!isPastBooking && status !== 'cancelled' && (
                <div className="pl-3 mt-3 flex items-center gap-2">
                    {hasLink && (
                        <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Join
                        </Button>
                    )}
                    {hasLink && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                                navigator.clipboard.writeText(booking.meeting!.joinUrl);
                                toast.success('Link disalin');
                            }}
                        >
                            <Copy className="h-3 w-3" />
                            Copy Link
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 ml-auto"
                        onClick={onReschedule}
                    >
                        <CalendarClock className="h-3 w-3" />
                        Reschedule
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-red-500 border-red-200 hover:bg-red-50"
                        onClick={onCancel}
                    >
                        <Trash2 className="h-3 w-3" />
                        Batal
                    </Button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Export from index.ts**

Add to `apps/frontend/src/features/zoom-booking/components/index.ts`:

```ts
export { ZoomMyBookingsView } from './ZoomMyBookingsView';
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx \
        apps/frontend/src/features/zoom-booking/components/index.ts
git commit -m "feat: add ZoomMyBookingsView component for My Bookings tab"
```

---

## Task 5: Wire My Bookings into Header & Page

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Read ZoomViewSwitcher.tsx first before editing**

```bash
cat apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx
```

- [ ] **Step 2: Add My Bookings button to ZoomViewSwitcher**

Extend the view switcher to include a 4th option. Add `ListTodo` icon from lucide-react. The button should be visually separated from Month/Week/Day (those are calendar views, My Bookings is different):

```tsx
import { LayoutGrid, CalendarDays, CalendarRange, ListTodo } from 'lucide-react';

// In the switcher JSX, after the existing Month/Week/Day buttons, add a divider + My Bookings:
<div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
<button
    onClick={() => onViewChange('my-bookings')}
    className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
        view === 'my-bookings'
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    )}
>
    <ListTodo className="h-3.5 w-3.5" />
    My Bookings
</button>
```

- [ ] **Step 3: Hide nav controls in ZoomCalendarHeader when view is my-bookings**

In `ZoomCalendarHeader.tsx`, wrap the left nav block with a condition:

```tsx
{/* Left: navigation — hidden for my-bookings view */}
{view !== 'my-bookings' && (
    <div className="flex items-center gap-2">
        {/* ... existing Today/prev/next/title ... */}
    </div>
)}
{view === 'my-bookings' && (
    <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-blue-600/10">
            <ListTodo className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">My Bookings</span>
    </div>
)}
```

- [ ] **Step 4: Render ZoomMyBookingsView in ZoomCalendarPage**

In `ZoomCalendarPage.tsx`, import `ZoomMyBookingsView`:

```tsx
import { ZoomMyBookingsView } from '../components/ZoomMyBookingsView';
```

In `calendarContent()`, add the my-bookings case before the existing views:

```tsx
if (view === 'my-bookings') {
    return (
        <ZoomMyBookingsView
            onBookingClick={(id) => panel.openDetail(id)}
        />
    );
}
```

Also skip the calendar data fetch when view is `my-bookings`. In `useZoomCalendar`, add a guard:

```tsx
const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
    view !== 'my-bookings' ? selectedAccountId : undefined,
    dateRange.start,
    dateRange.end
);
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx \
        apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat: wire My Bookings view into calendar header and page"
```

---

## Task 6: Month View — Day Popover for Many Events

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomMonthDayPopover.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx`

- [ ] **Step 1: Create ZoomMonthDayPopover component**

```tsx
/**
 * ZoomMonthDayPopover — floating card showing all events for a day cell.
 * Appears when user clicks "+N more" in month view.
 */
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { X, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayEvent {
    bookingId: string;
    status: string;
    title: string;
    startTime?: string;
    endTime?: string;
}

const PILL_BG: Record<string, string> = {
    booked:     'bg-amber-500 text-white',
    my_booking: 'bg-blue-600 text-white',
    blocked:    'bg-red-500 text-white',
    external:   'bg-slate-500 text-white',
};

interface ZoomMonthDayPopoverProps {
    date: string;
    events: DayEvent[];
    onClose: () => void;
    onEventClick: (bookingId: string) => void;
    anchorRef: React.RefObject<HTMLElement>;
}

export function ZoomMonthDayPopover({
    date,
    events,
    onClose,
    onEventClick,
    anchorRef,
}: ZoomMonthDayPopoverProps) {
    const parsedDate = parseISO(date);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Popover card */}
            <div
                className={cn(
                    "absolute z-50 w-56 rounded-2xl shadow-xl border",
                    "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                    "animate-in fade-in-0 zoom-in-95 duration-150"
                )}
                style={{ top: '110%', left: 0 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {format(parsedDate, 'd MMMM', { locale: idLocale })}
                    </span>
                    <button
                        onClick={onClose}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                </div>

                {/* Events list */}
                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {events.map((event) => (
                        <button
                            key={event.bookingId}
                            onClick={() => {
                                onEventClick(event.bookingId);
                                onClose();
                            }}
                            className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium",
                                "flex items-center gap-2 transition-opacity hover:opacity-80",
                                PILL_BG[event.status] ?? 'bg-slate-200 text-slate-800'
                            )}
                        >
                            <Video className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.title}</span>
                            {event.startTime && (
                                <span className="ml-auto text-[10px] opacity-80 shrink-0">
                                    {event.startTime}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
```

- [ ] **Step 2: Update ZoomMonthView to use popover + modern styling**

Replace the `+{overflow} more` text span in `ZoomMonthView.tsx` with a clickable button that shows the popover:

```tsx
// Add state at top of ZoomMonthView component:
const [popoverDate, setPopoverDate] = useState<string | null>(null);

// Replace overflow span:
{overflow > 0 && (
    <div className="relative">
        <button
            className="text-[10px] text-blue-600 dark:text-blue-400 px-1 font-semibold hover:underline"
            onClick={(e) => {
                e.stopPropagation();
                setPopoverDate(popoverDate === dateStr ? null : dateStr);
            }}
        >
            +{overflow} lainnya
        </button>
        {popoverDate === dateStr && (
            <ZoomMonthDayPopover
                date={dateStr}
                events={events.map((ev) => ({
                    bookingId: ev.bookingId ?? '',
                    status: ev.status,
                    title: ev.title,
                }))}
                onClose={() => setPopoverDate(null)}
                onEventClick={(id) => {
                    if (calDay) onBookingClick(id, calDay);
                }}
                anchorRef={{ current: null }}
            />
        )}
    </div>
)}
```

Also improve the event pills styling for a more modern look:

```tsx
// Replace PILL_BG constant:
const PILL_BG: Record<string, string> = {
    available:  'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
    booked:     'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200',
    my_booking: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200',
    blocked:    'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-sm',
    external:   'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300',
};
```

- [ ] **Step 3: Add useState import to ZoomMonthView.tsx**

```tsx
import { useState, useMemo } from 'react';
```

- [ ] **Step 4: Export ZoomMonthDayPopover from index.ts**

```ts
export { ZoomMonthDayPopover } from './ZoomMonthDayPopover';
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomMonthDayPopover.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx \
        apps/frontend/src/features/zoom-booking/components/index.ts
git commit -m "feat: month view day popover for many bookings + modern pill styling"
```

---

## Task 7: Week/Day View — Side-by-Side Overlap Rendering

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`

- [ ] **Step 1: Extend ProcessedBooking interface with column info**

In `ZoomCalendarGrid.tsx`, extend the interface:

```tsx
export interface ProcessedBooking {
    id: string;
    title: string;
    bookedBy: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    rowStart: number;
    rowSpan: number;
    isMyBooking: boolean;
    isExternal: boolean;
    // NEW: for side-by-side overlap rendering
    columnIndex: number;
    totalColumns: number;
}
```

- [ ] **Step 2: Implement overlap column assignment in processBookingsForDay**

Replace the `processBookingsForDay` function in `ZoomCalendarGrid.tsx`:

```tsx
export function processBookingsForDay(day: CalendarDay): ProcessedBooking[] {
    const bookings: ProcessedBooking[] = [];
    const processedSlots = new Set<string>();

    day.slots.forEach((slot, index) => {
        if (slot.booking && !processedSlots.has(slot.booking.id)) {
            const rowSpan = Math.max(1, Math.ceil(slot.booking.durationMinutes / SLOT_INTERVAL));
            bookings.push({
                id: slot.booking.id,
                title: slot.booking.title,
                bookedBy: slot.booking.bookedBy,
                startTime: slot.booking.startTime || slot.time,
                endTime: slot.booking.endTime || slot.endTime,
                durationMinutes: slot.booking.durationMinutes,
                rowStart: index + 2,
                rowSpan,
                isMyBooking: slot.status === 'my_booking',
                isExternal: slot.booking.isExternal || false,
                columnIndex: 0,
                totalColumns: 1,
            });
            processedSlots.add(slot.booking.id);
        }
    });

    // Compute overlap groups — simple interval overlap detection
    for (let i = 0; i < bookings.length; i++) {
        const a = bookings[i];
        const aStart = a.rowStart;
        const aEnd = a.rowStart + a.rowSpan;

        // Find all bookings that overlap with booking[i]
        const overlappingGroup = bookings.filter((b) => {
            const bStart = b.rowStart;
            const bEnd = b.rowStart + b.rowSpan;
            return aStart < bEnd && aEnd > bStart;
        });

        // Assign columns within the group
        overlappingGroup.sort((x, y) => x.rowStart - y.rowStart);
        const total = overlappingGroup.length;
        overlappingGroup.forEach((b, colIdx) => {
            b.columnIndex = colIdx;
            b.totalColumns = total;
        });
    }

    return bookings;
}
```

- [ ] **Step 3: Use columnIndex/totalColumns in ZoomWeekView booking overlay rendering**

In `ZoomWeekView.tsx`, update the booking overlay `style` to account for columns:

```tsx
// Replace the style computation for the booking div:
style={{
    top: topPx + 2,
    height: heightPx,
    left: `calc(${TIME_COL_WIDTH}px + ${colIdx} * ((100% - ${TIME_COL_WIDTH}px) / ${numCols}) + ${4 + (booking.columnIndex * ((100 / numCols - 8) / booking.totalColumns))}px)`,
    width: `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} / ${booking.totalColumns} - 8px)`,
}}
```

Simplified version (cleaner, using percentage):

```tsx
const dayColWidthPct = (100 - (TIME_COL_WIDTH / windowWidth * 100));
// Use inline style:
style={{
    top: topPx + 2,
    height: heightPx,
    left: `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + ${booking.columnIndex} / ${booking.totalColumns} * (100% - ${TIME_COL_WIDTH}px) / ${numCols} + 4px)`,
    width: `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} / ${booking.totalColumns} - 8px)`,
}}
```

- [ ] **Step 4: Apply same fix to ZoomDayView.tsx**

Read `ZoomDayView.tsx` first, then apply the same `columnIndex`/`totalColumns` width/left calculation for its booking overlays.

- [ ] **Step 5: Verify layout in browser — create 2 overlapping bookings on same day and check they render side-by-side**

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx
git commit -m "feat: side-by-side overlap rendering for week/day view bookings"
```

---

## Task 8: Modern UI Polish — Header, Shell, Booking Cards

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`

- [ ] **Step 1: Modernize ZoomCalendarShell header border & background**

In `ZoomCalendarShell.tsx`, update the header container:

```tsx
// Before:
<div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

// After:
<div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
```

- [ ] **Step 2: Modernize ZoomBookingForm — card-style sections**

Replace the form container `<form ... className="p-5 space-y-4">` with a more modern layout:

```tsx
<form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
    {/* Scrollable fields */}
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* ... all existing fields ... */}
    </div>

    {/* Sticky action bar */}
    <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Batal
            </Button>
            <Button
                type="submit"
                disabled={createBooking.isPending || !!conflictWarning}
                className="flex-1 font-semibold"
                style={{ backgroundColor: selectedAccount?.colorHex }}
            >
                <Video className="h-4 w-4 mr-2" />
                {createBooking.isPending ? 'Membuat...' : 'Book Meeting'}
            </Button>
        </div>
    </div>
</form>
```

- [ ] **Step 3: Modernize week view booking card appearance**

In `ZoomWeekView.tsx`, update the booking overlay class for a more polished look:

```tsx
// Replace booking div className:
className={cn(
    "absolute rounded-xl cursor-pointer select-none",
    "transition-all duration-150 ease-out",
    "hover:brightness-110 hover:shadow-lg hover:z-20 hover:-translate-y-px",
    "ring-1 ring-black/10 overflow-hidden flex flex-col",
    booking.isExternal
        ? "bg-slate-200/80 dark:bg-slate-700/80 border-l-[3px] border-l-slate-400"
        : booking.isMyBooking
            ? "bg-gradient-to-br from-blue-500 to-blue-600 border-l-[3px] border-l-blue-300 text-white"
            : "bg-gradient-to-br from-amber-400 to-amber-500 border-l-[3px] border-l-amber-200 text-white"
)}
```

- [ ] **Step 4: Add subtle hover effect to month view day cells**

In `ZoomMonthView.tsx`, update the day cell hover:

```tsx
// Update the day cell className:
inMonth
    ? "bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:shadow-inner"
    : "bg-slate-50/40 dark:bg-slate-800/20",
```

- [ ] **Step 5: Add today indicator with gradient in week view header**

In `ZoomWeekView.tsx`, update the today column header style:

```tsx
// today && "bg-blue-50 dark:bg-blue-950/30 border-b-2 border-b-blue-500"
// Replace with:
today && "bg-gradient-to-b from-blue-50 to-blue-50/0 dark:from-blue-950/30 dark:to-blue-950/0 border-b-2 border-b-blue-500"
```

- [ ] **Step 6: Verify visually in browser across month/week/day views**

- [ ] **Step 7: TypeScript check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx \
        apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx
git commit -m "feat: modern UI polish — glassmorphism header, gradient booking cards, sticky form actions"
```

---

## Self-Review Checklist

### Spec Coverage
| Requirement | Task |
|-------------|------|
| Banyak booking per hari → tidak menumpuk/overflow | Task 6 (month popover) + Task 7 (side-by-side week/day) |
| My Bookings menu — lihat semua booking tanpa navigasi tanggal | Task 3 + 4 + 5 |
| Jam booked dikunci di form, ada tanda visual | Task 2 |
| Durasi default 1 jam, dropdown fixed options | Task 1 |
| Tampilan modern | Task 8 |

### Placeholder Scan
- No TBD or TODO markers — all code blocks are complete.
- `ZoomDayView.tsx` overlap fix in Task 7 Step 4 says "read first then apply" — this is intentional because the file wasn't read at plan time. The implementer must read it and apply the same `columnIndex`/`totalColumns` pattern from `ZoomWeekView.tsx`.

### Type Consistency
- `ProcessedBooking` extended with `columnIndex: number` and `totalColumns: number` in Task 7 Step 1.
- All references to `processBookingsForDay` return `ProcessedBooking[]` which now includes the new fields — backward compatible since week/day views just ignore the fields until Task 7 Step 3–4.
- `CalendarView` extended with `'my-bookings'` in Task 3 Step 1 — used consistently in header, switcher, page.
- `ZoomMyBookingsView` uses `useMyBookings()` (existing hook, returns `ZoomBooking[]`) — matches the `booking.status`, `booking.meeting`, `booking.zoomAccount` fields used in `BookingCard`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-zoom-calendar-redesign.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints

**Which approach?**
