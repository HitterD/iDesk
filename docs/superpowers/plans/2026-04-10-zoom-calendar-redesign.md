# Zoom Calendar Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full redesign of ZoomCalendarPage — unified calendar shell with side panel, month/week/day views, URL state management, and mobile-responsive bottom sheet. Replace modal-based booking flow with side panel pattern. No backend changes required.

**Architecture:** Frontend-only redesign. New shell architecture wraps calendar content + side panel. URL params sync view/date/account state via react-router `useSearchParams`. Side panel replaces all booking modals (BookingModal, BookingDetailsModal, RescheduleModal, BookingTooltip). All existing API hooks retained unchanged.

**Tech Stack:** React 18, react-router-dom (useSearchParams), @tanstack/react-query, TailwindCSS, Radix UI (Sheet for mobile), date-fns, lucide-react, Socket.IO (existing)

**Spec:** `docs/superpowers/specs/2026-04-10-zoom-calendar-redesign.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts` | URL param sync for view/date/account state |
| `apps/frontend/src/features/zoom-booking/hooks/useBookingPanel.ts` | Panel open/close/state management |
| `apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx` | Month/Week/Day view toggle |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx` | Toolbar: title, account selector, view switcher, navigation, actions |
| `apps/frontend/src/features/zoom-booking/components/ZoomBookingPanel.tsx` | Side panel wrapper (desktop: slide-in right, mobile: bottom sheet) |
| `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx` | Booking form extracted from BookingModal |
| `apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx` | Layout manager: content area + side panel |
| `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx` | Month grid calendar (extracted from ZoomCalendarGrid) |
| `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx` | Weekly time grid (NEW) |
| `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx` | Daily time grid detailed (NEW) |

### Files to Modify

| File | Change |
|------|--------|
| `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx` | Rewrite to use new shell architecture |
| `apps/frontend/src/features/zoom-booking/pages/ZoomSettingsPage.tsx` | Refactor tab layout (already has Radix Tabs — minor UX improvements) |
| `apps/frontend/src/features/zoom-booking/components/UpcomingMeetingsPanel.tsx` | Add quick actions (Join, Detail, Cancel) |
| `apps/frontend/src/features/zoom-booking/components/AccountSidebar.tsx` | Compact mode for shell integration |
| `apps/frontend/src/features/zoom-booking/components/ZoomSkeletons.tsx` | Add week/day view skeleton states |
| `apps/frontend/src/features/zoom-booking/components/index.ts` | Update exports |

### Files to Deprecate (after migration complete)

| File | Replacement |
|------|------------|
| `BookingModal.tsx` | `ZoomBookingPanel` + `ZoomBookingForm` |
| `BookingTooltip.tsx` | Side panel detail view |
| `RescheduleModal.tsx` | Reschedule mode within `ZoomBookingPanel` |
| `ZoomCalendarGrid.tsx` | `ZoomMonthView` / `ZoomWeekView` / `ZoomDayView` |
| `BookingDetailsModal.tsx` | Detail view within `ZoomBookingPanel` |

> **Note:** `CancelBookingModal.tsx` is RETAINED — destructive action confirmation still requires modal dialog.

---

## Phase 1: Foundation — Hooks & State Management

### Task 1: Create `useCalendarView` Hook

**File:** Create `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts`

This hook syncs view mode, selected date, and account ID to URL search params via `useSearchParams`. Enables shareable links, browser back/forward, and bookmarkable views.

- [ ] **Step 1: Create the hook file**

```typescript
// apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parse, isValid } from 'date-fns';

export type ViewMode = 'month' | 'week' | 'day';

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day'];

function isValidViewMode(value: string | null): value is ViewMode {
    return value !== null && VIEW_MODES.includes(value as ViewMode);
}

function parseDateParam(value: string | null): Date {
    if (value) {
        const parsed = parse(value, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) return parsed;
    }
    return new Date();
}

export function useCalendarView() {
    const [searchParams, setSearchParams] = useSearchParams();

    const viewMode: ViewMode = useMemo(() => {
        const param = searchParams.get('view');
        return isValidViewMode(param) ? param : 'month';
    }, [searchParams]);

    const selectedDate = useMemo(() => {
        return parseDateParam(searchParams.get('date'));
    }, [searchParams]);

    const selectedAccountId = searchParams.get('account') || undefined;

    const setViewMode = useCallback((mode: ViewMode) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('view', mode);
                return next;
            },
            { replace: true }
        );
    }, [setSearchParams]);

    const setSelectedDate = useCallback((date: Date) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('date', format(date, 'yyyy-MM-dd'));
                return next;
            },
            { replace: true }
        );
    }, [setSearchParams]);

    const setSelectedAccountId = useCallback((accountId: string | undefined) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (accountId) {
                    next.set('account', accountId);
                } else {
                    next.delete('account');
                }
                return next;
            },
            { replace: true }
        );
    }, [setSearchParams]);

    const navigateDate = useCallback((delta: number, mode: ViewMode) => {
        const { addMonths, addWeeks, addDays } = require('date-fns');
        const addFn = mode === 'month' ? addMonths : mode === 'week' ? addWeeks : addDays;
        const newDate = addFn(selectedDate, delta);
        setSelectedDate(newDate);
    }, [selectedDate, setSelectedDate]);

    const goToToday = useCallback(() => {
        setSelectedDate(new Date());
    }, [setSelectedDate]);

    return {
        viewMode,
        selectedDate,
        selectedAccountId,
        setViewMode,
        setSelectedDate,
        setSelectedAccountId,
        navigateDate,
        goToToday,
    };
}
```

- [ ] **Step 2: Export from hooks index**

Add `useCalendarView` to `apps/frontend/src/features/zoom-booking/hooks/index.ts`.

- [ ] **Step 3: Verify** — URL params `?view=week&date=2026-04-10&account=abc123` parse correctly.

---

### Task 2: Create `useBookingPanel` Hook

**File:** Create `apps/frontend/src/features/zoom-booking/hooks/useBookingPanel.ts`

Manages panel state (closed/booking/detail/reschedule), selected booking context, and pre-filled data from slot clicks.

- [ ] **Step 1: Create the hook file**

```typescript
// apps/frontend/src/features/zoom-booking/hooks/useBookingPanel.ts
import { useState, useCallback } from 'react';
import type { ZoomBooking } from '../types';

export type PanelMode = 'closed' | 'booking' | 'detail' | 'reschedule';

export interface BookingPanelContext {
    mode: PanelMode;
    bookingId: string | null;
    prefilledDate: string | null;
    prefilledTime: string | null;
    prefilledEndTime: string | null;
    isReadOnly: boolean;
}

export function useBookingPanel() {
    const [context, setContext] = useState<BookingPanelContext>({
        mode: 'closed',
        bookingId: null,
        prefilledDate: null,
        prefilledTime: null,
        prefilledEndTime: null,
        isReadOnly: false,
    });

    const isOpen = context.mode !== 'closed';

    const openBooking = useCallback((prefilledDate?: string, prefilledTime?: string, prefilledEndTime?: string) => {
        setContext({
            mode: 'booking',
            bookingId: null,
            prefilledDate: prefilledDate ?? null,
            prefilledTime: prefilledTime ?? null,
            prefilledEndTime: prefilledEndTime ?? null,
            isReadOnly: false,
        });
    }, []);

    const openDetail = useCallback((bookingId: string, isReadOnly: boolean = false) => {
        setContext({
            mode: 'detail',
            bookingId,
            prefilledDate: null,
            prefilledTime: null,
            prefilledEndTime: null,
            isReadOnly,
        });
    }, []);

    const openReschedule = useCallback((bookingId: string) => {
        setContext((prev) => ({
            ...prev,
            mode: 'reschedule',
            bookingId,
        }));
    }, []);

    const closePanel = useCallback(() => {
        setContext({
            mode: 'closed',
            bookingId: null,
            prefilledDate: null,
            prefilledTime: null,
            prefilledEndTime: null,
            isReadOnly: false,
        });
    }, []);

    return {
        context,
        isOpen,
        openBooking,
        openDetail,
        openReschedule,
        closePanel,
    };
}
```

- [ ] **Step 2: Export from hooks index**

Add `useBookingPanel` to `apps/frontend/src/features/zoom-booking/hooks/index.ts`.

- [ ] **Step 3: Verify** — Panel state transitions work: closed → booking → detail → reschedule → closed.

---

## Phase 2: Calendar Shell & Header

### Task 3: Create `ZoomViewSwitcher` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx`

Segmented control for Month/Week/Day view switching. Syncs with `useCalendarView`.

- [ ] **Step 1: Create the component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomViewSwitcher.tsx
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '../hooks/useCalendarView';

interface ZoomViewSwitcherProps {
    viewMode: ViewMode;
    onViewChange: (mode: ViewMode) => void;
}

const views: { mode: ViewMode; label: string; icon: typeof Calendar }[] = [
    { mode: 'month', label: 'Month', icon: Calendar },
    { mode: 'week', label: 'Week', icon: CalendarRange },
    { mode: 'day', label: 'Day', icon: CalendarDays },
];

export function ZoomViewSwitcher({ viewMode, onViewChange }: ZoomViewSwitcherProps) {
    return (
        <div className="inline-flex items-center rounded-lg border border-[hsl(var(--border))] bg-muted p-0.5">
            {views.map(({ mode, label, icon: Icon }) => (
                <button
                    key={mode}
                    onClick={() => onViewChange(mode)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                        viewMode === mode
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Verify** — View switcher renders 3 segments, active state highlighted.

---

### Task 4: Create `ZoomCalendarHeader` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx`

Consolidates title, account selector, view switcher, navigation (prev/next/today), and action buttons (sync, new booking).

- [ ] **Step 1: Create the component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw,
    Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import type { ViewMode } from '../hooks/useCalendarView';
import type { ZoomAccount } from '../types';

interface ZoomCalendarHeaderProps {
    viewMode: ViewMode;
    selectedDate: Date;
    selectedAccountId: string | undefined;
    accounts: ZoomAccount[];
    isSyncing: boolean;
    canBook: boolean;
    onViewChange: (mode: ViewMode) => void;
    onNavigate: (delta: number) => void;
    onGoToToday: () => void;
    onAccountChange: (accountId: string) => void;
    onSync: () => void;
    onNewBooking: () => void;
}

function getViewTitle(viewMode: ViewMode, date: Date): string {
    switch (viewMode) {
        case 'month':
            return format(date, 'MMMM yyyy', { locale: idLocale });
        case 'week':
            return format(date, "'Week' w, MMMM yyyy", { locale: idLocale });
        case 'day':
            return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
    }
}

export function ZoomCalendarHeader({
    viewMode,
    selectedDate,
    selectedAccountId,
    accounts,
    isSyncing,
    canBook,
    onViewChange,
    onNavigate,
    onGoToToday,
    onAccountChange,
    onSync,
    onNewBooking,
}: ZoomCalendarHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold min-w-[200px]">
                    {getViewTitle(viewMode, selectedDate)}
                </h2>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => onNavigate(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onGoToToday}>
                        Hari ini
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onNavigate(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Account Selector */}
                {accounts.length > 1 && (
                    <Select value={selectedAccountId} onValueChange={onAccountChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pilih akun" />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <ZoomViewSwitcher viewMode={viewMode} onViewChange={onViewChange} />

                <Button
                    variant="outline"
                    size="icon"
                    onClick={onSync}
                    disabled={isSyncing}
                    title="Sinkronisasi dengan Zoom"
                >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>

                {canBook && (
                    <Button size="sm" onClick={onNewBooking}>
                        <Plus className="h-4 w-4 mr-1" />
                        Booking
                    </Button>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify** — Header renders with all controls, responsive layout on mobile.

---

### Task 5: Create `ZoomBookingPanel` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomBookingPanel.tsx`

Side panel wrapper that adapts to desktop (slide-in right, 380px) and mobile (bottom sheet via Radix Sheet). Renders BookingForm, BookingDetail, or RescheduleForm based on panel mode.

- [ ] **Step 1: Create the component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomBookingPanel.tsx
import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { BookingPanelContext } from '../hooks/useBookingPanel';
import type { ZoomAccount, ZoomBooking } from '../types';

interface ZoomBookingPanelProps {
    context: BookingPanelContext;
    onClose: () => void;
    onReschedule: (bookingId: string) => void;
    accounts: ZoomAccount[];
    children: React.ReactNode;
}

export function ZoomBookingPanel({
    context,
    onClose,
    onReschedule,
    accounts,
    children,
}: ZoomBookingPanelProps) {
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const isOpen = context.mode !== 'closed';

    // Close on Escape
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        },
        [isOpen, onClose]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const panelTitle = {
        booking: 'Booking Baru',
        detail: 'Detail Booking',
        reschedule: 'Reschedule Booking',
        closed: '',
    }[context.mode];

    // Mobile: Radix Sheet (bottom sheet)
    if (!isDesktop) {
        return (
            <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b">
                        <SheetTitle>{panelTitle}</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto custom-scrollbar p-4 h-[calc(85vh-4rem)]">
                        {children}
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    // Desktop: Slide-in panel
    return (
        <div
            className={cn(
                'w-[380px] flex-shrink-0 border-l border-[hsl(var(--border))] bg-background transition-all duration-300 ease-in-out overflow-hidden',
                isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full w-0 border-0'
            )}
        >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">{panelTitle}</h3>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Panel Content */}
            <div className="overflow-y-auto custom-scrollbar p-4 h-[calc(100%-3rem)]">
                {children}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify** — Panel slides in on desktop, shows bottom sheet on mobile (<768px), Escape closes panel.

---

### Task 6: Create `ZoomCalendarShell` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx`

Layout manager that renders calendar content area + optional side panel. Content area expands when panel is closed.

- [ ] **Step 1: Create the component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx
import { cn } from '@/lib/utils';

interface ZoomCalendarShellProps {
    isPanelOpen: boolean;
    calendarContent: React.ReactNode;
    panelContent: React.ReactNode;
    bottomStrip?: React.ReactNode;
}

export function ZoomCalendarShell({
    isPanelOpen,
    calendarContent,
    panelContent,
    bottomStrip,
}: ZoomCalendarShellProps) {
    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Main area: Calendar + Side Panel */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Calendar Content */}
                <div className={cn(
                    'flex-1 min-w-0 overflow-auto custom-scrollbar transition-all duration-300',
                    isPanelOpen && 'md:mr-0'
                )}>
                    {calendarContent}
                </div>

                {/* Side Panel (desktop only — mobile uses Sheet from ZoomBookingPanel) */}
                <div className="hidden md:block">
                    {panelContent}
                </div>
            </div>

            {/* Bottom Strip: Upcoming Meetings */}
            {bottomStrip && (
                <div className="flex-shrink-0 border-t border-[hsl(var(--border))]">
                    {bottomStrip}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify** — Calendar takes full width when panel closed, shrinks when panel open. Bottom strip renders below.

---

## Phase 3: View Components

### Task 7: Create `ZoomMonthView` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx`

Month grid calendar extracted from existing `ZoomCalendarGrid`. Renders 7-column grid with colored pill indicators. Single-click opens side panel with slot list, double-click switches to Day View.

- [ ] **Step 1: Create the component**

Key behaviors:
- 7-column grid (Mon-Sun, following `workingDays` from settings)
- Booking slots as colored pill/chip indicators (blue=booked, green=my_booking, gray=available, red-stripe=blocked)
- Click date → open side panel with slot list for that date
- Double-click date → switch to Day View for that date
- Click slot → open side panel with booking detail or booking form

Extract the grid rendering logic from `ZoomCalendarGrid.tsx`, restructure as month-view specific component. The existing component renders a week-based grid; the new month view should render a traditional month calendar layout.

```typescript
// Key interface for ZoomMonthView
interface ZoomMonthViewProps {
    calendar: CalendarDay[];
    selectedDate: Date;
    currentTime: Date;
    canBook: boolean;
    onSlotClick: (date: string, time: string, status: string, bookingId?: string) => void;
    onDateDoubleClick: (date: Date) => void;
}
```

Implementation approach:
1. Calculate month grid: get first day of month, pad start with empty cells
2. Render each day cell with mini slot indicators (colored pills)
3. Max 3 visible indicators per day, "+N more" overflow indicator
4. Click handler differentiates single-click (panel) vs double-click (switch view)

- [ ] **Step 2: Verify** — Month grid renders correctly, indicators match slot statuses, double-click switches to day view.

---

### Task 8: Create `ZoomWeekView` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`

Weekly time grid — 7 columns (days) × time rows (08:00-18:00, 30-min intervals). Bookings rendered as blocks spanning duration. Current time indicator (red line). Drag-to-create on empty slots.

- [ ] **Step 1: Create the component**

```typescript
// Key interface for ZoomWeekView
interface ZoomWeekViewProps {
    calendar: CalendarDay[];
    selectedDate: Date;
    currentTime: Date;
    canBook: boolean;
    timeLabels: string[];
    onSlotClick: (date: string, time: string, endTime: string) => void;
    onBookingClick: (bookingId: string) => void;
    onDragCreate?: (date: string, startTime: string, endTime: string) => void;
}
```

Implementation approach:
1. Time column on the left (08:00-18:00, 30-min rows)
2. 7 day columns showing the week containing `selectedDate`
3. Bookings rendered as positioned blocks (absolute positioning within column, top/height based on time)
4. Current time indicator: red horizontal line at current time position
5. Click empty slot → open side panel with pre-filled time
6. Click booking block → open side panel with detail
7. Optional: drag across slots to select range (MVP: click only)

Reuse `SLOT_INTERVAL`, `SLOT_HEIGHT`, `SLOT_BG`, `ProcessedBooking` from existing `ZoomCalendarGrid.tsx`.

- [ ] **Step 2: Verify** — Week grid renders 7 day columns, bookings appear as blocks, current time line shows, click handlers work.

---

### Task 9: Create `ZoomDayView` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`

Single-day detailed time grid. Similar to week view but single column with more detail (participant info, join link). Mini prev/next day navigation in header.

- [ ] **Step 1: Create the component**

```typescript
// Key interface for ZoomDayView
interface ZoomDayViewProps {
    calendar: CalendarDay[];
    selectedDate: Date;
    currentTime: Date;
    canBook: boolean;
    timeLabels: string[];
    onSlotClick: (date: string, time: string, endTime: string) => void;
    onBookingClick: (bookingId: string) => void;
    onNavigateDay: (delta: number) => void;
}
```

Implementation approach:
1. Single column time grid (08:00-18:00, same time rows as week view)
2. More detailed booking blocks: show title, host, duration, participant count
3. Join button rendered inline for user's own bookings
4. Header with day title + prev/next arrows
5. Click empty slot → open side panel with pre-filled time
6. Click booking → open side panel detail

- [ ] **Step 2: Verify** — Day view renders single column, detailed booking info shows, join button works, navigation works.

---

## Phase 4: Booking Panel Forms

### Task 10: Create `ZoomBookingForm` Component

**File:** Create `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`

Booking form extracted from `BookingModal.tsx`. Adapts from Dialog-based to panel-based layout. Same validation rules, same API calls.

- [ ] **Step 1: Create the component**

Extract form logic from `BookingModal.tsx`:
- Title input (required, min 3 chars)
- Zoom account selector
- Duration selector (15/30/45/60 min, default 30)
- Date picker (pre-filled from context)
- Time selector (pre-filled from context)
- Description (optional)
- Submit → optimistic update → toast
- Cancel → close panel

Key differences from BookingModal:
- No Dialog wrapper (panel is the wrapper)
- Pre-filled values come from `BookingPanelContext` instead of props
- On success: show confirmation with join link in panel, auto-close after 5 seconds
- Layout adapted for narrow panel width (380px)

```typescript
// Key interface
interface ZoomBookingFormProps {
    prefilledDate: string | null;
    prefilledTime: string | null;
    prefilledEndTime: string | null;
    accountId: string;
    accounts: ZoomAccount[];
    onSuccess: (booking: ZoomBooking) => void;
    onCancel: () => void;
}
```

- [ ] **Step 2: Verify** — Form validates correctly, submits booking, shows confirmation with join link, auto-closes.

---

### Task 11: Integrate Detail & Reschedule into ZoomBookingPanel

**Files:** Modify `apps/frontend/src/features/zoom-booking/components/ZoomBookingPanel.tsx`

Render the appropriate content based on `context.mode`:
- `booking` → `ZoomBookingForm`
- `detail` → Detail view (extracted from `BookingDetailsModal.tsx`)
- `reschedule` → Reschedule form (extracted from `RescheduleModal.tsx`)

- [ ] **Step 1: Add detail view content**

Extract booking detail rendering from `BookingDetailsModal.tsx` into an inline section within `ZoomBookingPanel`. Shows:
- Title, time, duration, host
- Join link (clickable)
- Status badge
- Actions: Reschedule / Cancel (only for own bookings)

- [ ] **Step 2: Add reschedule form content**

Extract reschedule form from `RescheduleModal.tsx` into an inline section within `ZoomBookingPanel`. Pre-fills current booking data, allows changing date/time/duration.

- [ ] **Step 3: Add panel mode routing logic**

```typescript
// Inside ZoomBookingPanel's content area:
{context.mode === 'booking' && (
    <ZoomBookingForm ... />
)}
{context.mode === 'detail' && context.bookingId && (
    <BookingDetailView bookingId={context.bookingId} isReadOnly={context.isReadOnly} ... />
)}
{context.mode === 'reschedule' && context.bookingId && (
    <RescheduleForm bookingId={context.bookingId} ... />
)}
```

- [ ] **Step 4: Verify** — All three modes render correctly in the panel. Cancel button in detail view opens `CancelBookingModal`.

---

## Phase 5: Page Integration

### Task 12: Rewrite `ZoomCalendarPage`

**File:** Modify `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

Full rewrite to use new shell architecture. This is the main integration task.

- [ ] **Step 1: Rewrite the page component**

```typescript
// apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ZoomErrorBoundary } from '../components';
import { ZoomCalendarHeader } from '../components/ZoomCalendarHeader';
import { ZoomCalendarShell } from '../components/ZoomCalendarShell';
import { ZoomBookingPanel } from '../components/ZoomBookingPanel';
import { ZoomMonthView } from '../components/ZoomMonthView';
import { ZoomWeekView } from '../components/ZoomWeekView';
import { ZoomDayView } from '../components/ZoomDayView';
import { UpcomingMeetingsPanel } from '../components/UpcomingMeetingsPanel';
import { AccountSidebar } from '../components/AccountSidebar';
import {
    useCalendarView,
    useBookingPanel,
    useZoomAccounts,
    useZoomCalendar,
    useZoomSocket,
    useSyncMeetings,
} from '../hooks';
import { useHasPageAccess } from '@/hooks/usePermissions';

export function ZoomCalendarPage() {
    const { hasAccess: canBook } = useHasPageAccess('zoom_calendar');
    const {
        viewMode, selectedDate, selectedAccountId,
        setViewMode, setSelectedDate, setSelectedAccountId,
        navigateDate, goToToday,
    } = useCalendarView();
    const panel = useBookingPanel();

    // Data fetching
    const { data: accounts, isLoading: accountsLoading } = useZoomAccounts();
    const syncMeetings = useSyncMeetings();
    useZoomSocket(selectedAccountId);

    // Calculate date range based on view mode
    const dateRange = useMemo(() => {
        switch (viewMode) {
            case 'month': {
                const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
                const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
                return { start, end };
            }
            case 'week': {
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
                return {
                    start: format(weekStart, 'yyyy-MM-dd'),
                    end: format(weekEnd, 'yyyy-MM-dd'),
                };
            }
            case 'day': {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                return { start: dateStr, end: dateStr };
            }
        }
    }, [viewMode, selectedDate]);

    const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
        selectedAccountId,
        dateRange.start,
        dateRange.end
    );

    // Time labels from calendar data
    const timeLabels = useMemo(() => {
        if (calendar && calendar.length > 0 && calendar[0].slots.length > 0) {
            return calendar[0].slots.map((s) => s.time);
        }
        const labels: string[] = [];
        for (let h = 8; h < 18; h++) {
            labels.push(`${h.toString().padStart(2, '0')}:00`);
            labels.push(`${h.toString().padStart(2, '0')}:30`);
        }
        return labels;
    }, [calendar]);

    // Handlers
    const handleSlotClick = (date: string, time: string, endTime?: string, status?: string, bookingId?: string) => {
        if (bookingId) {
            panel.openDetail(bookingId, status === 'booked');
        } else if (status === 'available' && canBook) {
            panel.openBooking(date, time, endTime);
        }
    };

    const handleBookingClick = (bookingId: string, isReadOnly: boolean = false) => {
        panel.openDetail(bookingId, isReadOnly);
    };

    const handleDateDoubleClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day');
    };

    const handleSync = async () => {
        try {
            await syncMeetings.mutateAsync();
        } catch {
            // Error handled by mutation
        }
    };

    const handleNewBooking = () => {
        panel.openBooking(format(selectedDate, 'yyyy-MM-dd'));
    };

    // Render calendar view based on mode
    const calendarContent = (() => {
        if (calendarLoading || accountsLoading) {
            return <ZoomCalendarSkeletonView viewMode={viewMode} />;
        }
        if (!calendar) return null;

        switch (viewMode) {
            case 'month':
                return (
                    <ZoomMonthView
                        calendar={calendar}
                        selectedDate={selectedDate}
                        currentTime={new Date()}
                        canBook={canBook}
                        onSlotClick={handleSlotClick}
                        onDateDoubleClick={handleDateDoubleClick}
                    />
                );
            case 'week':
                return (
                    <ZoomWeekView
                        calendar={calendar}
                        selectedDate={selectedDate}
                        currentTime={new Date()}
                        canBook={canBook}
                        timeLabels={timeLabels}
                        onSlotClick={(date, time, endTime) => handleSlotClick(date, time, endTime, 'available')}
                        onBookingClick={(id) => handleBookingClick(id)}
                    />
                );
            case 'day':
                return (
                    <ZoomDayView
                        calendar={calendar}
                        selectedDate={selectedDate}
                        currentTime={new Date()}
                        canBook={canBook}
                        timeLabels={timeLabels}
                        onSlotClick={(date, time, endTime) => handleSlotClick(date, time, endTime, 'available')}
                        onBookingClick={(id) => handleBookingClick(id)}
                        onNavigateDay={(delta) => navigateDate(delta, 'day')}
                    />
                );
        }
    })();

    return (
        <div className="min-h-0 h-auto lg:h-[calc(100vh-2rem)] flex flex-col gap-4 animate-fade-in-up overflow-hidden p-2 pb-4">
            <ZoomErrorBoundary>
                {/* Header */}
                <ZoomCalendarHeader
                    viewMode={viewMode}
                    selectedDate={selectedDate}
                    selectedAccountId={selectedAccountId}
                    accounts={accounts || []}
                    isSyncing={syncMeetings.isPending}
                    canBook={canBook}
                    onViewChange={setViewMode}
                    onNavigate={(delta) => navigateDate(delta, viewMode)}
                    onGoToToday={goToToday}
                    onAccountChange={setSelectedAccountId}
                    onSync={handleSync}
                    onNewBooking={handleNewBooking}
                />

                {/* Shell: Calendar + Panel */}
                <ZoomCalendarShell
                    isPanelOpen={panel.isOpen}
                    calendarContent={calendarContent}
                    panelContent={
                        <ZoomBookingPanel
                            context={panel.context}
                            onClose={panel.closePanel}
                            onReschedule={panel.openReschedule}
                            accounts={accounts || []}
                        >
                            {/* Panel content rendered based on mode */}
                        </ZoomBookingPanel>
                    }
                    bottomStrip={
                        <UpcomingMeetingsPanel maxItems={5} compact />
                    }
                />
            </ZoomErrorBoundary>
        </div>
    );
}
```

- [ ] **Step 2: Verify** — Page renders with all new components integrated. URL state syncs. Panel opens/closes. View switching works.

---

### Task 13: Enhance `UpcomingMeetingsPanel`

**File:** Modify `apps/frontend/src/features/zoom-booking/components/UpcomingMeetingsPanel.tsx`

Add quick actions and compact mode for bottom strip usage.

- [ ] **Step 1: Add compact mode prop**

Add `compact?: boolean` prop. When `compact=true`, render horizontal strip layout instead of vertical card list.

- [ ] **Step 2: Add quick action buttons**

Each meeting item gets:
- **Join** — opens Zoom join link in new tab
- **Detail** — opens side panel with booking detail
- **Cancel** — opens CancelBookingModal

- [ ] **Step 3: Add collapsible behavior**

Strip can be collapsed/expanded. Default: expanded on desktop, collapsed on mobile.

- [ ] **Step 4: Verify** — Strip renders compactly at bottom, quick actions work, collapse/expand works.

---

### Task 14: Refactor `ZoomSettingsPage`

**File:** Modify `apps/frontend/src/features/zoom-booking/pages/ZoomSettingsPage.tsx`

Minor UX improvements. Already has Radix Tabs, just needs polish.

- [ ] **Step 1: Improve tab layout**

Current state: already uses Radix Tabs with accounts, settings, audit logs. Minor improvements:
- Add save-per-section (currently one giant form)
- Add sync button in header with last sync timestamp
- Improve account card layout with status indicator

- [ ] **Step 2: Verify** — Settings page tabs work, save-per-section works.

---

## Phase 6: Cleanup & Migration

### Task 15: Update Component Exports

**File:** Modify `apps/frontend/src/features/zoom-booking/components/index.ts`

- [ ] **Step 1: Add new component exports**

Add all new components to the barrel export file:
- `ZoomCalendarHeader`
- `ZoomCalendarShell`
- `ZoomBookingPanel`
- `ZoomBookingForm`
- `ZoomViewSwitcher`
- `ZoomMonthView`
- `ZoomWeekView`
- `ZoomDayView`

- [ ] **Step 2: Mark deprecated components**

Add deprecation comments to old component exports:
- `BookingModal` — deprecated, use `ZoomBookingPanel`
- `BookingTooltip` — deprecated, use side panel detail
- `RescheduleModal` — deprecated, use panel reschedule mode
- `ZoomCalendarGrid` — deprecated, use view components
- `BookingDetailsModal` — deprecated, use panel detail mode

Do NOT remove these yet — keep them importable for gradual migration.

---

### Task 16: Add Skeleton States for New Views

**File:** Modify `apps/frontend/src/features/zoom-booking/components/ZoomSkeletons.tsx`

- [ ] **Step 1: Add WeekView skeleton**

Skeleton matching the 7-column time grid layout.

- [ ] **Step 2: Add DayView skeleton**

Skeleton matching the single-column time grid layout.

- [ ] **Step 3: Verify** — Skeletons render during loading states for all view modes.

---

## Execution Notes

### Dependency Order

```
Phase 1 (Tasks 1-2) → Phase 2 (Tasks 3-6) → Phase 3 (Tasks 7-9) → Phase 4 (Tasks 10-11) → Phase 5 (Tasks 12-14) → Phase 6 (Tasks 15-16)
```

Tasks within each phase can be parallelized (e.g., Task 3 + Task 4 can run in parallel).

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| `useMediaQuery` hook may not exist | Check if exists; create if needed (simple `window.matchMedia` wrapper) |
| Radix `Sheet` component may not exist in UI lib | Check `@/components/ui/sheet`; create if needed using `@radix-ui/react-dialog` |
| Existing `ZoomCalendarGrid` has complex booking rendering logic | Extract carefully; don't rewrite from scratch |
| Drag-to-create interaction (week/day view) | Mark as MVP-optional; start with click-only |
| URL state may conflict with existing route params | Verify router config; use `replace: true` to avoid history pollution |

### No-Backend Verification

All API hooks in `useZoomBooking.ts` are retained unchanged. The spec explicitly states no backend changes. Verify by checking:
- `useZoomCalendar` accepts same params: `accountId, startDate, endDate`
- `useCreateBooking` accepts same `CreateBookingDto`
- `useRescheduleBooking` accepts same `{ bookingId, data }` shape
- All mutation invalidation keys remain the same