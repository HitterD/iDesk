# Zoom Meeting Detail UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish both Zoom meeting detail views into consistent Quiet Record UI while preserving every data, permission, and action behavior.

**Architecture:** Keep the existing `BookingDetailsModal` dialog wrapper and `ZoomBookingDetailView` panel body separate. Replace only their presentational JSX/classes; retain `useBookingDetails`, `useAuth`, `STAFF_ROLES`, copy helpers, `window.open`, and modal wiring. No shared abstraction is added because two existing files remain independently mounted and this scope changes only markup.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Lucide React, Radix Dialog, date-fns, Vitest, Testing Library.

## Global Constraints

- Preserve blue/slate palette, dark mode tokens, and all existing data/permission/action contracts.
- Do not add dependencies, API calls, hooks, global state, DTO changes, or backend changes.
- Keep `canManage`, external-meeting restriction, cancelled-meeting restriction, `copyToClipboard`, `generateInvitationText`, `window.open`, `RescheduleModal`, `CancelBookingModal`, and close behavior unchanged.
- Remove gradient banners, decorative blur/blob elements, overlapping status badges, icon-square metadata cards, and nested generic borders.
- Metadata is two columns at `md` and one column below `md`; action footer wraps below `md`.
- Do not add blur to scrolling content or animations that change layout.

---

## File Structure

### Modified files

- `apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx` — Quiet Record dialog detail view.
- `apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx` — Quiet Record modal-panel detail view.

### Created tests

- `apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx` — dialog detail visual-state and action wiring regression coverage.
- `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx` — panel detail visual-state and action wiring regression coverage.

---

### Task 1: Add detail view regression coverage

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx`
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx`

**Interfaces:**
- Consumes: `BookingDetailsModalProps` (`isOpen`, `onClose`, `bookingId`) and `ZoomBookingDetailViewProps` (`bookingId`, `onClose`, `onReschedule`).
- Mocks: `useBookingDetails`, `useAuth`, `copyToClipboard`, `generateInvitationText`, `CancelBookingModal`, and `RescheduleModal`.
- Produces: coverage for Quiet Record heading/data, no-link notice, and permission-gated actions.

- [ ] **Step 1: Create shared mock booking fixture in each test file**

Use the same shape in both test files:

```tsx
const booking = {
    id: 'booking-1',
    title: 'Weekly Operations Sync',
    description: 'Review pekerjaan minggu ini.',
    bookingDate: '2026-07-23',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    bookedByUserId: 'user-1',
    bookedByUser: { fullName: 'Bagas Pratama' },
    isExternal: false,
    zoomAccount: { name: 'Marketing', colorHex: '#2563eb' },
    meeting: { joinUrl: 'https://zoom.us/j/8123456789', password: '123456' },
};
```

- [ ] **Step 2: Add failing dialog-detail test**

Create `BookingDetailsModal.test.tsx` with this render assertion after mocks:

```tsx
it('renders quiet record metadata and owner actions', async () => {
    vi.mocked(hooks.useBookingDetails).mockReturnValue({ data: booking, isLoading: false } as ReturnType<typeof hooks.useBookingDetails>);
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', role: 'USER' } } as ReturnType<typeof useAuth>);

    render(<BookingDetailsModal isOpen onClose={vi.fn()} bookingId="booking-1" />);

    expect(await screen.findByText('DETAIL MEETING')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: booking.title })).toBeInTheDocument();
    expect(screen.getByText('Tanggal')).toBeInTheDocument();
    expect(screen.getByText('Durasi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /batalkan/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run dialog test and verify failure**

Run:

```bash
npm --prefix apps/frontend test -- --run src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx
```

Expected: FAIL because `DETAIL MEETING` does not exist in current modal.

- [ ] **Step 4: Add failing panel-detail test**

Create `ZoomBookingDetailView.test.tsx` with this assertion after equivalent mocks:

```tsx
it('renders quiet record metadata and keeps actions for booking owner', async () => {
    vi.mocked(hooks.useBookingDetails).mockReturnValue({ data: booking, isLoading: false } as ReturnType<typeof hooks.useBookingDetails>);
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', role: 'USER' } } as ReturnType<typeof useAuth>);

    render(<ZoomBookingDetailView bookingId="booking-1" onClose={vi.fn()} onReschedule={vi.fn()} />);

    expect(await screen.findByText('DETAIL MEETING')).toBeInTheDocument();
    expect(screen.getByText('Meeting ID')).toBeInTheDocument();
    expect(screen.getByText('Passcode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /batalkan/i })).toBeInTheDocument();
});
```

- [ ] **Step 5: Run panel test and verify failure**

Run:

```bash
npm --prefix apps/frontend test -- --run src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx
```

Expected: FAIL because `DETAIL MEETING` does not exist in current panel detail.

- [ ] **Step 6: Commit test baseline**

```bash
git add apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx
git commit -m "test(zoom): cover detail meeting presentation"
```

---

### Task 2: Polish `BookingDetailsModal` into Quiet Record

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx:67-355`
- Test: `apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx`

**Interfaces:**
- Consumes: existing `booking`, `isConfirmed`, `isCancelled`, `isPending`, `isExternal`, `canManage`, `copyFullInvitation`, `onClose`, and modal state setters.
- Produces: same dialog, actions, and child modals with Quiet Record presentation.

- [ ] **Step 1: Replace loading dialog surface**

Keep `Dialog` behavior and replace `DialogContent`/spinner classes with:

```tsx
<DialogContent className="max-w-md border-0 bg-card p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:shadow-none">
    <div className="flex h-48 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary dark:border-slate-700" />
    </div>
</DialogContent>
```

- [ ] **Step 2: Replace banner/header block with Quiet Record header**

Replace the visual banner and status-overlap blocks with:

```tsx
<div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Detail meeting
        </p>
        {booking.zoomAccount && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                {formatZoomAccountName(booking.zoomAccount.name)}
            </span>
        )}
    </div>
    <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        {booking.title}
    </DialogTitle>
    <p className={cn(
        "text-xs font-medium",
        isConfirmed ? "text-emerald-700 dark:text-emerald-300" : isCancelled ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300",
    )}>
        {booking.status}
    </p>
    {booking.description && <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{booking.description}</p>}
</div>
```

- [ ] **Step 3: Replace metadata cards with definition list**

Use this block after header:

```tsx
<dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-y border-slate-100 py-4 text-sm dark:border-slate-800 md:grid-cols-2">
    <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tanggal</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{format(new Date(booking.bookingDate), 'd MMM yyyy', { locale: idLocale })}</dd></div>
    <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Waktu</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{booking.startTime}–{booking.endTime} WIB</dd></div>
    <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Durasi</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{booking.durationMinutes} menit</dd></div>
    <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Dibooking oleh</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{booking.bookedByUser?.fullName}</dd></div>
</dl>
```

- [ ] **Step 4: Replace join block with single soft-blue surface**

Keep all existing `copyToClipboard` and `window.open` handlers. Use a single `rounded-2xl bg-blue-50/70 p-4 dark:bg-blue-950/25` wrapper; remove all blue border/gradient/nested-card classes. Render URL, Meeting ID, passcode, and full invitation buttons inside it. Give every icon-only copy/open button an `aria-label`: `Salin link`, `Buka meeting`, `Salin Meeting ID`, `Salin passcode`.

- [ ] **Step 5: Replace action footer classes only**

Keep action conditions and handlers exactly unchanged. Use:

```tsx
<div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
```

Apply `rounded-full text-xs font-medium` to Reschedule, Batalkan, and Tutup buttons. Keep destructive colors for Batalkan. Do not change `showRescheduleModal`, `showCancelModal`, or their children.

- [ ] **Step 6: Run dialog regression test**

Run:

```bash
npm --prefix apps/frontend test -- --run src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit dialog polish**

```bash
git add apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx
git commit -m "refactor(zoom): polish meeting detail dialog"
```

---

### Task 3: Polish `ZoomBookingDetailView` into Quiet Record

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx:53-305`
- Test: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx`

**Interfaces:**
- Consumes: existing `booking`, status flags, permission flags, `onClose`, `onReschedule`, and cancel modal state.
- Produces: same panel detail actions in Quiet Record visual hierarchy.

- [ ] **Step 1: Replace panel loading state**

Replace loading JSX with:

```tsx
<div className="flex h-40 items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat detail meeting" />
</div>
```

- [ ] **Step 2: Apply same Quiet Record header and definition list**

Use Task 2 header order and metadata definition-list markup. Keep an `h2` for title rather than `DialogTitle`. The panel title uses:

```tsx
<h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{booking.title}</h2>
```

Keep `booking.zoomAccount` optional and `booking.description` conditional behavior unchanged.

- [ ] **Step 3: Apply same join/no-link/notices styling**

Keep exact link values, copy callbacks, invite generation, external notice text, no-link logic, cancellation reason logic, and their conditional guards. Remove gradient, `blur-3xl`, nested card borders, and icon-square wrappers. Use the same soft-blue join wrapper and compact semantic notices as Task 2.

- [ ] **Step 4: Apply action footer without behavior changes**

Replace only wrapper/button classes. Keep existing conditions:

```tsx
{canReschedule && onReschedule && ...}
{canCancel && ...}
<Button onClick={onClose}>Tutup</Button>
```

Use `flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800`; buttons use `rounded-full text-xs font-medium`. Keep `onReschedule(booking)`, cancel state update, and `onClose` unchanged.

- [ ] **Step 5: Run panel regression test**

Run:

```bash
npm --prefix apps/frontend test -- --run src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit panel polish**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx
git commit -m "refactor(zoom): polish meeting detail panel"
```

---

### Task 4: Verify detail polish contracts

**Files:**
- Review: `apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx`
- Review: `apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx`
- Review: `apps/frontend/src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx`
- Review: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx`

**Interfaces:**
- Consumes: final Tasks 1-3 files.
- Produces: verified visual polish without behavior regression.

- [ ] **Step 1: Verify prohibited patterns are absent**

Run:

```bash
rg "bg-gradient|blur-3xl|-mt-10|border-slate-100 dark:border-slate-800.*rounded|p-2\.5 bg-" apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx apps/frontend/src/features/zoom-booking/components/ZoomBookingDetailView.tsx
```

Expected: no output.

- [ ] **Step 2: Run detail tests and frontend suite**

Run:

```bash
npm --prefix apps/frontend test -- --run src/features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx src/features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx && npm --prefix apps/frontend test
```

Expected: all selected tests and complete frontend suite PASS.

- [ ] **Step 3: Build frontend**

Run:

```bash
npm --prefix apps/frontend run build
```

Expected: command exits 0.

- [ ] **Step 4: Review mobile and dark mode manually**

Verify at `<768px`: metadata has one column, action buttons wrap, and URL text does not create horizontal page overflow. Verify dark mode: status, notices, metadata values, and destructive action remain readable.

- [ ] **Step 5: Commit regression-only fix if required**

Do not make an empty commit. If verification finds a target-only defect:

```bash
git add apps/frontend/src/features/zoom-booking/components
git commit -m "fix(zoom): preserve meeting detail actions"
```

---

## Self-Review

- **Spec coverage:** Task 1 establishes detail regressions. Task 2 covers dialog Quiet Record header, metadata, join area, notices, and equal action footer. Task 3 covers the panel version with identical behavior. Task 4 covers prohibited patterns, full tests, build, responsive layout, and dark mode.
- **Placeholder scan:** no `TBD`, `TODO`, undefined type, or vague implementation step.
- **Type consistency:** no public props, hooks, callbacks, permission conditions, or DTO fields change.
