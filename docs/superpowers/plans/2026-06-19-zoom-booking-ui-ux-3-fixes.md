# Zoom Booking Calendar — 3 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix overflow pill clickability, force single-account in day view, and filter time dropdown to available-only slots in the Zoom Booking calendar.

**Architecture:** Pure frontend changes in 3 components — `ZoomWeekView.tsx` (overflow pill z-index), `ZoomCalendarPage.tsx` + `ZoomDayView.tsx` (day view single-account enforcement + sticky banner), `ZoomBookingForm.tsx` (time options filter via existing `useZoomCalendar`). No backend changes.

**Tech Stack:** React + TanStack Query (frontend), Vitest (frontend tests), Tailwind, lucide-react.

**Spec:** [docs/superpowers/specs/2026-06-19-zoom-booking-ui-ux-3-fixes.md](../specs/2026-06-19-zoom-booking-ui-ux-3-fixes.md)

---

## File Structure

**Modify:**
- `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx` — overflow pill z-index + pointer-events
- `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx` — force single-account for day view + auto-pick most-free account
- `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx` — sticky banner component
- `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx` — filter time options by `useZoomCalendar` availability

**Verify (no change expected):**
- `apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx` — already wired correctly

---

## Task 1: Fix overflow pill clickability

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx:307-321`

- [ ] **Step 1: Read the current overflow pill render block**

In `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`, find the overflow pill JSX (around lines 307-321). It currently has:

```tsx
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
```

- [ ] **Step 2: Update className — raise z-index + add pointer-events-auto + cursor-pointer**

Replace the entire `<button ...>` opening tag attributes:

Find:
```tsx
className="absolute h-4 rounded-sm bg-slate-800 text-white text-[9px] font-semibold flex items-center justify-center hover:bg-slate-900 z-20"
```

Replace with:
```tsx
className="absolute h-4 rounded-sm bg-slate-800 text-white text-[9px] font-semibold flex items-center justify-center hover:bg-slate-900 z-40 cursor-pointer pointer-events-auto"
```

- [ ] **Step 3: Verify pill still has data-testid and onClick**

Confirm the `data-testid="overflow-pill"` and `onClick={(e) => { e.stopPropagation(); openOverflow(...); }}` are preserved (no other changes needed).

- [ ] **Step 4: Run existing test**

```bash
cd apps/frontend
npx vitest run src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
```

Expected: 5/5 PASS (no behavior change to test, just CSS).

- [ ] **Step 5: Commit**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx
git commit -m "fix(week-view): raise overflow pill z-index to z-40 + pointer-events-auto"
```

---

## Task 2: Add helper hook for auto-picking most-free account

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/hooks/useMostFreeAccount.ts`

- [ ] **Step 1: Create the hook file**

Create `apps/frontend/src/features/zoom-booking/hooks/useMostFreeAccount.ts`:

```typescript
import { useMemo } from 'react';
import type { ZoomAccount } from '../types';

/**
 * Pick the most-free account from a list, given a meetings-per-account map.
 * Tie-breaker: account id ascending (deterministic).
 * Returns `undefined` when accounts is empty.
 */
export function useMostFreeAccount(
    accounts: ZoomAccount[],
    meetingsPerAccount: Map<string, number>,
): ZoomAccount | undefined {
    return useMemo(() => {
        if (accounts.length === 0) return undefined;
        const sorted = [...accounts].sort((a, b) => {
            const countA = meetingsPerAccount.get(a.id) ?? 0;
            const countB = meetingsPerAccount.get(b.id) ?? 0;
            if (countA !== countB) return countA - countB;
            return a.id.localeCompare(b.id);
        });
        return sorted[0];
    }, [accounts, meetingsPerAccount]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/frontend/src/features/zoom-booking/hooks/useMostFreeAccount.ts
git commit -m "feat(hooks): add useMostFreeAccount for day-view auto-pick"
```

---

## Task 3: Force single-account when day view is active

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Add import for useMostFreeAccount**

In `ZoomCalendarPage.tsx`, add at the top of the imports (after the existing `useMyUpcomingBookings` import):

```typescript
import { useMostFreeAccount } from '../hooks/useMostFreeAccount';
```

- [ ] **Step 2: Compute effectiveAccountScope**

In the `ZoomCalendarPage` component function body, find where `useGabungan` is declared (around line 118):

```typescript
const useGabungan = accountScope === 'gabungan';
```

Add immediately below:

```typescript
// Day view always renders single-account. When user is in Gabungan mode and
// switches to day view, auto-pick the most-free account so the day grid stays
// readable.
const isDayView = view === 'day';
const forceSingleForDay = isDayView && useGabungan;
const mostFreeAccount = useMostFreeAccount(safeAccounts, meetingsPerAccount);
const effectiveAccountScope = forceSingleForDay ? 'single' : accountScope;
const effectiveActiveAccountId = forceSingleForDay
    ? (activeAccountId && safeAccounts.some((a) => a.id === activeAccountId)
        ? activeAccountId
        : mostFreeAccount?.id)
    : activeAccountId;
```

- [ ] **Step 3: Update calendar data source to use effective values**

Find the existing:

```typescript
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
const calendarLoading = useGabungan ? mergedCalendar.isLoading : singleCalendar.isLoading;
```

Replace with:

```typescript
const shouldLoadMerged = !isDayView && effectiveAccountScope === 'gabungan';
const singleCalendar = useZoomCalendar(
    view !== 'my-bookings' && !shouldLoadMerged ? effectiveActiveAccountId : undefined,
    dateRange.start,
    dateRange.end,
);
const mergedCalendar = useZoomMergedCalendar(
    view !== 'my-bookings' && shouldLoadMerged ? dateRange.start : undefined,
    view !== 'my-bookings' && shouldLoadMerged ? dateRange.end : undefined,
);

const calendar = shouldLoadMerged
    ? mergedCalendarToCalendar(mergedCalendar.data as MergedCalendarDay[] | undefined)
    : singleCalendar.data;
const calendarLoading = shouldLoadMerged ? mergedCalendar.isLoading : singleCalendar.isLoading;
```

- [ ] **Step 4: Update ZoomDayView props to pass day-view flag + active account**

Find the existing `<ZoomDayView>` JSX (search for `ZoomDayView` in the file). It currently receives `currentDate`, `calendar`, `timeLabels`, `currentTime`, `canBook`, `onSlotClick`, `onBookingClick`, `onNavigateDay`.

Add a new prop `forceSingleAccountMode` and `forceSingleAccountName`:

Find the `<ZoomDayView ... />` invocation. Replace with:

```tsx
<ZoomDayView
    currentDate={currentDate}
    calendar={calendar ?? []}
    timeLabels={timeLabels}
    currentTime={currentTime}
    canBook={canBook}
    onSlotClick={onSlotClick}
    onBookingClick={onBookingClick}
    onNavigateDay={(delta) => { /* existing handler */ }}
    forceSingleAccountMode={forceSingleForDay}
    forceSingleAccountName={mostFreeAccount?.name}
/>
```

(Preserve the existing `onNavigateDay` handler implementation from the current source.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: TS error about missing `forceSingleAccountMode` prop on ZoomDayView — proceed to Task 4 to add it.

- [ ] **Step 6: Commit**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(calendar-page): force single-account mode in day view"
```

---

## Task 4: Add sticky banner to ZoomDayView

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`

- [ ] **Step 1: Add new optional props to ZoomDayViewProps interface**

Find:

```typescript
interface ZoomDayViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    onSlotClick: (day: CalendarDay, slotIndex: number) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
    onNavigateDay: (delta: number) => void;
}
```

Replace with:

```typescript
interface ZoomDayViewProps {
    currentDate: Date;
    calendar: CalendarDay[];
    timeLabels: string[];
    currentTime: Date;
    canBook: boolean;
    onSlotClick: (day: CalendarDay, slotIndex: number) => void;
    onBookingClick: (booking: ProcessedBooking) => void;
    onNavigateDay: (delta: number) => void;
    /** When true, day view is rendering in single-account fallback mode because
     *  the user was in Gabungan mode. The banner explains this and shows which
     *  account was auto-picked. */
    forceSingleAccountMode?: boolean;
    forceSingleAccountName?: string;
}
```

- [ ] **Step 2: Destructure the new props in the function signature**

Find:

```typescript
export function ZoomDayView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    onSlotClick,
    onBookingClick,
    onNavigateDay,
}: ZoomDayViewProps) {
```

Replace with:

```typescript
export function ZoomDayView({
    currentDate,
    calendar,
    timeLabels,
    currentTime,
    canBook,
    onSlotClick,
    onBookingClick,
    onNavigateDay,
    forceSingleAccountMode = false,
    forceSingleAccountName,
}: ZoomDayViewProps) {
```

- [ ] **Step 3: Add the sticky banner above the day grid**

Find the JSX `return (` block. It returns a `<div data-testid="zoom-day-view" ...>` wrapper. Add the banner as the FIRST child inside that wrapper, before the existing day-header `<div>`.

Find:

```tsx
    return (
        <div
            data-testid="zoom-day-view"
            ...
        >
            {/* existing day header */}
```

Insert the banner BEFORE the existing day-header `<div>`:

```tsx
    return (
        <div
            data-testid="zoom-day-view"
            ...
        >
            {forceSingleAccountMode && (
                <div
                    data-testid="zoom-day-view-force-single-banner"
                    className="sticky top-0 z-30 flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200"
                >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                    Day view menampilkan 1 akun{forceSingleAccountName ? `: ${forceSingleAccountName}` : ''}. Untuk lihat semua akun, gunakan Week atau Month view.
                </div>
            )}
            {/* existing day header */}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx
git commit -m "feat(day-view): add sticky banner for forced single-account mode"
```

---

## Task 5: Filter time dropdown to available slots only

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`

- [ ] **Step 1: Add useZoomCalendar import (verify it exists)**

In `ZoomBookingForm.tsx`, verify the import line:

```typescript
import {
    useCreateBooking,
    usePublicZoomSettings,
    useZoomCalendar,
    useAllAccountsAvailability,
} from '../hooks';
```

If `useZoomCalendar` is missing from this import, add it. (Already present in the current file per earlier exploration.)

- [ ] **Step 2: Compute availability for selected account**

Find the existing `useAllAccountsAvailability` call (already in the file). After it, add a new `useZoomCalendar` call scoped to the selected account + booking date:

```typescript
// Fetch calendar for the currently selected account so we can filter
// time options to slots that are actually available (not booked).
const selectedAccountCalendar = useZoomCalendar(
    !isGabungan && selectedAccountId !== GABUNGAN_ACCOUNT_ID && bookingDate
        ? selectedAccountId
        : undefined,
    bookingDate,
    bookingDate,
);
```

- [ ] **Step 3: Build available time set**

After the `selectedAccountCalendar` declaration, add:

```typescript
const availableTimes = useMemo(() => {
    if (isGabungan) return null; // Gabungan auto-picks; no filtering needed.
    const days = selectedAccountCalendar.data;
    if (!days || days.length === 0) return null;
    const set = new Set<string>();
    for (const day of days) {
        for (const slot of day.slots) {
            // Available = no booking attached. Mirrors the same logic that
            // the slot.status === 'available' check uses, but more permissive
            // since slot.status can be inconsistent.
            if (!slot.booking) {
                set.add(slot.time);
            }
        }
    }
    return set;
}, [isGabungan, selectedAccountCalendar.data]);
```

- [ ] **Step 4: Apply the filter to time options in the ZoomTimeSelect**

Find the existing `ZoomTimeSelect` JSX (search for `<ZoomTimeSelect` in the file). It receives `options={...}` where options are generated from settings (typically `generateTimeOptions(...)`). Replace the options generation:

Find:
```tsx
const timeOptions = useMemo<TimeSlotOption[]>(() => {
    if (!settings) return [];
    return generateTimeOptions(
        settings.slotStartTime || '08:00',
        settings.slotEndTime || '18:00',
        settings.slotIntervalMinutes || 30,
    ).map((time) => ({ time }));
}, [settings]);
```

(This block may already exist; if so, modify the mapping.) Replace with:

```tsx
const timeOptions = useMemo<TimeSlotOption[]>(() => {
    if (!settings) return [];
    const allTimes = generateTimeOptions(
        settings.slotStartTime || '00:00',
        settings.slotEndTime || '23:59',
        settings.slotIntervalMinutes || 30,
    );
    return allTimes.map((time) => ({
        time,
        isUnavailable: availableTimes ? !availableTimes.has(time) : false,
    }));
}, [settings, availableTimes]);
```

(Adjust the surrounding variable name if the existing code uses a different one. The principle: every generated time is included but flagged `isUnavailable` if the availability set doesn't contain it.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx
git commit -m "feat(booking-form): flag unavailable time slots in dropdown"
```

---

## Task 6: Verification

- [ ] **Step 1: Run zoom-booking frontend tests**

```bash
cd apps/frontend
npx vitest run src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts
```

Expected: all PASS (no regression).

- [ ] **Step 2: TypeScript check frontend**

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

1. Start backend + frontend locally.
2. Open `/zoom-calendar` in browser.
3. Verify Issue A: create 5+ bookings on the same time slot → klik pill "+N lainnya" → popover terbuka dengan list.
4. Verify Issue B: switch to Gabungan mode, lalu pilih Day view → banner sticky muncul di atas, calendar menampilkan 1 akun.
5. Verify Issue C: pilih Zoom 1 di account switcher, buka Book Meeting → time dropdown TIDAK menampilkan jam yang sudah booked di Zoom 1, atau menampilkan dengan icon warning.

- [ ] **Step 4: Commit any follow-up fixes if needed**

If manual smoke uncovered issues, commit them with descriptive messages.

---

## Self-Review Checklist

- [ ] Spec coverage: Issue A (Task 1), Issue B (Tasks 2-4), Issue C (Task 5) all addressed.
- [ ] No placeholders: every step has actual code/commands.
- [ ] Type consistency: `forceSingleAccountMode` and `forceSingleAccountName` consistent across `ZoomCalendarPage.tsx` and `ZoomDayView.tsx`.
- [ ] Tests pass: existing zoom-booking tests unaffected.
- [ ] Manual smoke verified all 3 acceptance criteria.

---

*End of plan.*
