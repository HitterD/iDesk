# Zoom Calendar Auto-Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zoom Calendar default memilih akun paling kosong untuk day/week/month dan booking form, sambil menjaga manual override dan Gabungan sebagai mode eksplisit.

**Architecture:** Tambah scope eksplisit `auto` untuk smart default, reuse `useMostFreeAccount`, dan tetap gunakan endpoint batch existing. Calendar page jadi source of truth untuk selection mode: `auto`, `manual` (account id), atau `combined` (`gabungan`). Diff kecil: tidak tambah endpoint, tidak tambah dependency, tidak buat dashboard baru.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, React Testing Library, existing Zoom booking hooks/components.

---

## File Structure

- Modify: `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts`
  - Tambah `AUTO_ACCOUNT_SCOPE`.
  - Default first-time account scope jadi `auto`, bukan `gabungan`.
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx`
  - Tambah kartu `Otomatis: akun paling tersedia`.
  - Gabungan tetap eksplisit.
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`
  - Gunakan `auto` scope untuk memilih `mostFreeAccount` di day/week/month.
  - `gabungan` hanya dipakai saat user pilih Gabungan.
  - Booking form prefill akun efektif sama dengan calendar.
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useAllAccountsAvailability.ts`
  - Memoize `accountIds`.
  - Guard batch limit `<=20`.
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts`
  - Memoize `accountIds`.
  - Guard batch limit `<=20`.
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useZoomSocket.ts`
  - Hindari socket reconnect karena array deps berubah.
- Modify: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx`
  - Update default scope test.
- Modify: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts`
  - Tambah guard test untuk >20 akun.
- Modify: `apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx`
  - Tambah tests auto-pick default, manual override, Gabungan explicit.

---

### Task 1: Add explicit auto account scope

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts:6-38`
- Test: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx:15-18`

- [ ] **Step 1: Write failing test for default auto scope**

Replace test at `apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx:15-18`:

```ts
it('defaults account scope to "auto"', () => {
    const { result } = renderHook(() => useCalendarView(), { wrapper });
    expect(result.current.accountScope).toBe('auto');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx
```

Expected: FAIL because current default is `gabungan`.

- [ ] **Step 3: Implement explicit auto scope**

Edit `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts`.

Replace lines 6-10:

```ts
/** Special account scopes; otherwise value is a Zoom account id */
export const AUTO_ACCOUNT_SCOPE = 'auto';
export const GABUNGAN_ACCOUNT_SCOPE = 'gabungan';
export type AccountScope = typeof AUTO_ACCOUNT_SCOPE | typeof GABUNGAN_ACCOUNT_SCOPE | string;

const ACCOUNT_STORAGE_KEY = 'zoom-calendar-account';
```

Replace `readInitialScope` return fallback:

```ts
function readInitialScope(searchParams: URLSearchParams): AccountScope {
    const fromUrl = searchParams.get('account');
    if (fromUrl) return fromUrl;
    if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (stored) return stored;
    }
    return AUTO_ACCOUNT_SCOPE;
}
```

Replace URL sync block at lines 145-149:

```ts
if (accountScope === AUTO_ACCOUNT_SCOPE) {
    next.delete('account');
} else {
    next.set('account', accountScope);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx
rtk git commit -m "feat: add auto scope for zoom calendar"
```

---

### Task 2: Add Auto option to account switcher

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx:19-85`

- [ ] **Step 1: Add constants**

Edit `apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx`.

Replace line 19:

```ts
export const AUTO_ID = 'auto';
export const GABUNGAN_ID = 'gabungan';
```

- [ ] **Step 2: Replace Gabungan card section with Auto + Gabungan cards**

Replace lines 58-85:

```tsx
{/* Auto + Gabungan cards */}
<div className="p-2 space-y-1.5">
    <button
        type="button"
        onClick={() => onSelect(AUTO_ID)}
        data-testid="auto-account-card"
        className={`w-full p-2.5 rounded-lg text-left flex items-center gap-2.5 border-2 transition-colors ${
            currentAccountId === AUTO_ID
                ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/30'
                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50'
        }`}
    >
        <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <div className="flex-1">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Otomatis: Akun Paling Tersedia
            </div>
            <div className="text-[10px] text-slate-500">
                Default untuk day, week, month, dan booking baru
            </div>
        </div>
        {currentAccountId === AUTO_ID ? (
            <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                AUTO
            </span>
        ) : null}
    </button>

    <button
        type="button"
        onClick={() => onSelect(GABUNGAN_ID)}
        data-testid="gabungan-card"
        className={`w-full p-2.5 rounded-lg text-left flex items-center gap-2.5 border-2 transition-colors ${
            currentAccountId === GABUNGAN_ID
                ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/30'
                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50'
        }`}
    >
        <Globe className="h-4 w-4 text-blue-600" aria-hidden="true" />
        <div className="flex-1">
            <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                Gabungan (Semua Akun)
            </div>
            <div className="text-[10px] text-slate-500">
                Lihat semua akun sekaligus
            </div>
        </div>
    </button>
</div>
```

- [ ] **Step 3: Fix imports**

Replace line 1:

```ts
import { Globe, Search, Sparkles } from 'lucide-react';
```

- [ ] **Step 4: Run focused component tests**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx
```

Expected: PASS. If existing snapshot/text expects `DEFAULT` on Gabungan, update it to `AUTO` on `auto-account-card` only.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx
rtk git commit -m "feat: add automatic zoom account option"
```

---

### Task 3: Make calendar default single-account through auto-pick

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx:14-160,196-214,245-252,409-443,472-479`
- Test: `apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx`

- [ ] **Step 1: Write failing tests**

Edit `apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx`.

Change `useMyUpcomingBookings` mock from:

```ts
useMyUpcomingBookings: () => ({ data: [] }),
```

to:

```ts
useMyUpcomingBookings: () => ({
    data: mocks.upcomingBookings,
}),
```

Add field in `mocks` object:

```ts
upcomingBookings: [] as Array<{ zoomAccountId: string }>,
```

Update `beforeEach`:

```ts
mocks.accountScope = 'auto';
mocks.upcomingBookings = [];
```

Add tests after existing `fetches calendar data for selected account scope` test:

```tsx
it('auto-picks the least busy account for calendar and booking', async () => {
    const user = userEvent.setup();
    mocks.accountScope = 'auto';
    mocks.upcomingBookings = [
        { zoomAccountId: 'zoom-1' },
        { zoomAccountId: 'zoom-1' },
    ];

    render(<ZoomCalendarPage />, { wrapper });

    expect(mocks.calendarAccountIds).toContain('zoom-2');

    await user.click(screen.getByRole('button', { name: /book meeting/i }));

    expect(screen.getByTestId('zoom-booking-modal')).toHaveTextContent(
        /booking:zoom-2:2026-06-18:\d{2}:00/
    );
});

it('does not override manual account scope with auto-pick', async () => {
    const user = userEvent.setup();
    mocks.accountScope = 'zoom-1';
    mocks.upcomingBookings = [
        { zoomAccountId: 'zoom-1' },
        { zoomAccountId: 'zoom-1' },
    ];

    render(<ZoomCalendarPage />, { wrapper });

    expect(mocks.calendarAccountIds).toContain('zoom-1');

    await user.click(screen.getByRole('button', { name: /book meeting/i }));

    expect(screen.getByTestId('zoom-booking-modal')).toHaveTextContent(
        /booking:zoom-1:2026-06-18:\d{2}:00/
    );
});

it('loads merged calendar only when Gabungan is explicit', () => {
    mocks.accountScope = 'gabungan';

    render(<ZoomCalendarPage />, { wrapper });

    expect(mocks.calendarAccountIds).not.toContain('zoom-1');
    expect(mocks.calendarAccountIds).not.toContain('zoom-2');
});
```

- [ ] **Step 2: Run page tests to verify failure**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx
```

Expected: FAIL because `auto` is not handled yet.

- [ ] **Step 3: Import auto scope constant**

Edit `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`.

Replace import block lines 14-16:

```ts
    useCalendarView,
    AUTO_ACCOUNT_SCOPE,
    GABUNGAN_ACCOUNT_SCOPE,
    useBookingPanel,
```

- [ ] **Step 4: Replace active account selection logic**

Replace lines 101-135:

```ts
const safeAccounts = accounts ?? [];

// Per-account meeting count derived from my upcoming bookings (best-effort load).
const meetingsPerAccount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const booking of upcomingBookings) {
        counts.set(booking.zoomAccountId, (counts.get(booking.zoomAccountId) ?? 0) + 1);
    }
    return counts;
}, [upcomingBookings]);

const mostFreeAccount = useMostFreeAccount(safeAccounts, meetingsPerAccount);
const isAutoScope = accountScope === AUTO_ACCOUNT_SCOPE;
const useGabungan = accountScope === GABUNGAN_ACCOUNT_SCOPE;
const manualAccountId = !isAutoScope && !useGabungan ? accountScope : undefined;
const effectiveActiveAccountId = manualAccountId && safeAccounts.some((account) => account.id === manualAccountId)
    ? manualAccountId
    : mostFreeAccount?.id ?? selectedAccountId ?? safeAccounts[0]?.id;

// Real-time updates.
// Subscribe to all accounts only when Gabungan is explicitly selected.
const socketAccountId = useGabungan ? undefined : effectiveActiveAccountId;
const gabunganAccountIds = useMemo(
    () => useGabungan ? safeAccounts.map((a) => a.id) : undefined,
    [safeAccounts, useGabungan],
);
useZoomSocket(socketAccountId, gabunganAccountIds);
```

- [ ] **Step 5: Replace merged calendar condition**

Replace lines 125-140 comments and condition with:

```ts
// Calendar data source — merged endpoint only when Gabungan is explicitly selected.
const shouldLoadMerged = view !== 'my-bookings' && useGabungan;
```

Keep existing `useZoomCalendar` and `useZoomMergedCalendar`, but make sure they use `effectiveActiveAccountId` and `shouldLoadMerged` exactly:

```ts
const singleCalendar = useZoomCalendar(
    view !== 'my-bookings' && !shouldLoadMerged ? effectiveActiveAccountId : undefined,
    dateRange.start,
    dateRange.end,
);
const mergedCalendar = useZoomMergedCalendar(
    shouldLoadMerged ? dateRange.start : undefined,
    shouldLoadMerged ? dateRange.end : undefined,
);
```

- [ ] **Step 6: Replace first-account auto-select effect**

Replace lines 155-160:

```ts
// Keep a stable fallback account for first render before load summary settles.
useEffect(() => {
    if (safeAccounts.length && !selectedAccountId) {
        setSelectedAccountId(safeAccounts[0].id);
    }
}, [safeAccounts, selectedAccountId]);
```

- [ ] **Step 7: Update booking open context**

Replace lines 202-214:

```ts
const zoomAccountId = effectiveActiveAccountId;
if (!zoomAccountId) {
    toast.error('Tidak ada akun Zoom yang tersedia untuk booking');
    return;
}

panel.openBooking({
    date: format(currentDate, 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:00'),
    zoomAccountId,
    isGabungan: useGabungan,
});
```

Update dependency array:

```ts
}, [canBook, currentDate, effectiveActiveAccountId, panel, useGabungan]);
```

- [ ] **Step 8: Update keyboard Gabungan toggle**

Replace lines 248-252:

```ts
setAccountScope(
    accountScope === GABUNGAN_ACCOUNT_SCOPE
        ? AUTO_ACCOUNT_SCOPE
        : GABUNGAN_ACCOUNT_SCOPE,
);
```

- [ ] **Step 9: Update slot click guards**

Replace lines 263-281:

```ts
const handleSlotClick = (day: CalendarDay, slotOrIndex: CalendarSlot | number) => {
    if (!canBook || !effectiveActiveAccountId) return;

    let time: string;
    if (typeof slotOrIndex === 'number') {
        const slot = day.slots[slotOrIndex];
        if (!slot || slot.status !== 'available') return;
        time = slot.time;
    } else {
        if (slotOrIndex.status !== 'available') return;
        time = slotOrIndex.time;
    }

    panel.openBooking({
        date: day.date,
        time,
        zoomAccountId: effectiveActiveAccountId,
        isGabungan: useGabungan,
    });
};
```

- [ ] **Step 10: Update header props**

Replace `selectedAccountId` prop line 412:

```tsx
selectedAccountId={effectiveActiveAccountId ?? 'all'}
```

Replace `onAccountChange` line 419:

```tsx
onAccountChange={(id) => setAccountScope(id === 'all' ? AUTO_ACCOUNT_SCOPE : id)}
```

- [ ] **Step 11: Update subbar props**

Replace lines 431-443:

```tsx
accountScope={accountScope}
activeAccountName={
    (effectiveActiveAccountId && safeAccounts.find((a) => a.id === effectiveActiveAccountId)?.name) ||
    safeAccounts[0]?.name ||
    'Zoom'
}
activeAccountColor={
    (effectiveActiveAccountId &&
        safeAccounts.find((a) => a.id === effectiveActiveAccountId)?.colorHex) ||
    safeAccounts[0]?.colorHex ||
    '#3b82f6'
}
showAutoPickHint={isAutoScope}
```

- [ ] **Step 12: Update day view forced banner props**

Replace lines 368-369:

```tsx
forceSingleAccountMode={isAutoScope}
forceSingleAccountName={mostFreeAccount?.name}
```

- [ ] **Step 13: Run page tests**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx
```

Expected: PASS.

- [ ] **Step 14: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx
rtk git commit -m "feat: auto-pick least busy zoom account"
```

---

### Task 4: Stabilize batch account IDs and enforce 20-account guard

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useAllAccountsAvailability.ts:1-38`
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts:28-48`
- Test: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts:118`

- [ ] **Step 1: Add failing guard test**

Append to `apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts`:

```ts
it('does not call batch endpoint when account count exceeds 20', async () => {
    const manyAccounts = Array.from({ length: 21 }, (_, index) => ({
        id: `acc-${index + 1}`,
        name: `Account ${index + 1}`,
        colorHex: '#3b82f6',
    })) as ZoomAccount[];

    const { result } = renderHook(
        () => useAccountLoadSummary(manyAccounts, '2026-06-19', '2026-06-19'),
        { wrapper: makeWrapper() },
    );

    expect(result.current).toHaveLength(21);
    expect(mockedApi.post).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts
```

Expected: FAIL because current hook still calls API with 21 accounts.

- [ ] **Step 3: Update useAllAccountsAvailability**

Edit `apps/frontend/src/features/zoom-booking/hooks/useAllAccountsAvailability.ts`.

Replace import line:

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
```

Add after imports:

```ts
const MAX_BATCH_ACCOUNTS = 20;
```

Replace line 21:

```ts
const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
const canQueryBatch = enabled && !!date && accountIds.length > 0 && accountIds.length <= MAX_BATCH_ACCOUNTS;
```

Replace `enabled` line:

```ts
enabled: canQueryBatch,
```

- [ ] **Step 4: Update useAccountLoadSummary**

Edit `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts`.

Add after imports:

```ts
const MAX_BATCH_ACCOUNTS = 20;
```

Replace line 34:

```ts
const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
const canQueryBatch = enabled && accountIds.length > 0 && accountIds.length <= MAX_BATCH_ACCOUNTS && !!startDate && !!endDate;
```

Replace `enabled` line:

```ts
enabled: canQueryBatch,
```

Keep return mapping as-is so UI still renders all accounts with `meetingsInRange: 0` when query disabled.

- [ ] **Step 5: Run hook tests**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/hooks/useAllAccountsAvailability.ts apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts
rtk git commit -m "fix: guard zoom calendar batch account limit"
```

---

### Task 5: Prevent socket reconnect churn from Gabungan account array

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useZoomSocket.ts:96-152`

- [ ] **Step 1: Replace subscription loop to use stable key**

Edit `apps/frontend/src/features/zoom-booking/hooks/useZoomSocket.ts`.

Replace effect body from line 96 through cleanup with:

```ts
useEffect(() => {
    const idsToSubscribe = subscribedIds
        ? subscribedIds.split(',').filter(Boolean)
        : [];

    // Connect to Zoom namespace
    const socket = io(`${SOCKET_URL}/zoom`, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
        if (idsToSubscribe.length > 0) {
            for (const id of idsToSubscribe) {
                socket.emit('subscribe:account', id);
            }
        }
    });

    socket.on('disconnect', () => {
        // no-op; socket.io will auto-reconnect via reconnection defaults.
    });

    socket.on('calendar:updated', handleCalendarUpdate);
    socket.on('settings:updated', handleSettingsUpdate);
    socket.on('booking:created', handleBookingCreated);
    socket.on('booking:cancelled', handleBookingCancelled);
    socket.on('sync:completed', handleSyncCompleted);

    return () => {
        for (const id of idsToSubscribe) {
            socket.emit('unsubscribe:account', id);
        }
        socket.disconnect();
    };
}, [
    subscribedIds,
    handleCalendarUpdate,
    handleSettingsUpdate,
    handleBookingCreated,
    handleBookingCancelled,
    handleSyncCompleted,
]);
```

This removes raw `gabunganAccountIds` array from deps. Effect now reruns only when sorted `subscribedIds` changes.

- [ ] **Step 2: Run TypeScript build check**

Run:

```bash
rtk npm --prefix apps/frontend run build
```

Expected: TypeScript stage passes. If Vite bundle later fails for unrelated existing issues, capture exact error and continue to focused test step.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/hooks/useZoomSocket.ts
rtk git commit -m "fix: stabilize zoom socket subscriptions"
```

---

### Task 6: Update microcopy for Auto vs Gabungan

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx:110-119`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx:34-66`

- [ ] **Step 1: Update header label**

Edit `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx`.

Add import constants by replacing line 7:

```ts
import { ZoomAccountSwitcher, AUTO_ID, GABUNGAN_ID } from './ZoomAccountSwitcher';
```

Replace `currentLabel` block lines 110-115:

```ts
const currentLabel =
    accountScope === undefined
        ? null
        : accountScope === AUTO_ID
            ? 'Otomatis'
            : accountScope === GABUNGAN_ID
                ? 'Gabungan'
                : accounts.find((a) => a.id === accountScope)?.name ?? accountScope;
```

Replace `currentColor` block lines 116-119:

```ts
const currentColor =
    accountScope && accountScope !== GABUNGAN_ID && accountScope !== AUTO_ID
        ? accounts.find((a) => a.id === accountScope)?.colorHex
        : undefined;
```

- [ ] **Step 2: Update subbar auto wording**

Edit `apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx`.

Replace `const isGabungan` line 34:

```ts
const isAuto = accountScope === 'auto';
const isGabungan = accountScope === 'gabungan';
```

Replace lines 41-66:

```tsx
{/* Mode / active-account indicator */}
{isGabungan || isAuto ? (
    <div
        data-testid={isGabungan ? 'gabungan-indicator' : 'auto-account-indicator'}
        className={cn(
            'flex items-center gap-1.5 text-[11px] font-semibold',
            isGabungan
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-emerald-700 dark:text-emerald-300',
        )}
    >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isGabungan ? 'Gabungan' : 'Otomatis'}</span>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">·</span>
        <span
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 pl-1 pr-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
            data-testid="active-account-chip"
        >
            <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: activeAccountColor }}
                aria-hidden="true"
            />
            {activeAccountName}
        </span>
        {showAutoPickHint && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                (akun paling tersedia)
            </span>
        )}
    </div>
) : (
```

- [ ] **Step 3: Run subbar tests**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
```

Expected: PASS. If test expects `gabungan-active-chip`, update selector to `active-account-chip`.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
rtk git commit -m "fix: clarify zoom calendar account mode labels"
```

---

### Task 7: Final focused verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused Zoom tests**

Run:

```bash
rtk npm --prefix apps/frontend test -- --run apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.tsx apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts apps/frontend/src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
rtk npm --prefix apps/frontend run build
```

Expected: PASS. If fail, use `build-error-resolver` agent and fix only build errors.

- [ ] **Step 3: Review diff**

Run:

```bash
rtk git diff -- apps/frontend/src/features/zoom-booking docs/superpowers/plans/2026-06-22-zoom-calendar-auto-pick.md
```

Expected checks:
- No new dependency.
- No new backend endpoint.
- `auto` default exists.
- Gabungan only loads merged calendar when explicit.
- Manual account scope remains account id.
- Batch hooks do not query >20 accounts.

- [ ] **Step 4: Commit verification fixes if needed**

If Step 1 or 2 required fixes:

```bash
rtk git add apps/frontend/src/features/zoom-booking
rtk git commit -m "fix: verify zoom calendar auto-pick flow"
```

If no fixes required, skip commit.

---

## Self-Review

- Spec coverage: covered default auto-pick, manual override, Gabungan explicit, booking prefill, batch 10-account performance, 20-account guard, stable tie-breaker through existing `useMostFreeAccount` and `autoPickAccount` id sort.
- Placeholder scan: no TBD/TODO/fill-in placeholders.
- Type consistency: `AccountScope` uses string literal constants; `auto` and `gabungan` flow through header, page, switcher, subbar.
- YAGNI check: no new endpoint, no new dependency, no dashboard, no global store.
