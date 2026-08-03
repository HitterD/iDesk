# Client Zoom Calendar UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `/client/zoom-calendar` into calmer, scanable UI while preserving two-column layout and all booking behavior.

**Architecture:** Keep `ClientZoomBookingPage` as composition boundary, `SimpleBookingForm` as booking form/state owner, and `ZoomMyBookingsView` as booking-list/state owner. Change only presentational Tailwind classes and semantic copy; keep hooks, callbacks, DTO construction, modal wiring, and responsive grid intact.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Lucide React, Vitest, Testing Library.

## Global Constraints

- Preserve desktop `grid-cols-1 lg:grid-cols-12`, form `lg:col-span-5`, and list `lg:col-span-7`.
- Preserve blue/slate palette, existing dark-mode tokens, and `prefers-reduced-motion` support.
- Do not add dependencies, API calls, hooks, global state, or change booking/list action behavior.
- Keep validation, availability, booking error toast, join, copy, reschedule, cancel, and detail modal behavior unchanged.
- Do not add blur to scrolling containers or decorative animation.
- Use only existing files; no new components or abstractions.

---

## File Structure

### Modified files

- `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx` — quiet title area and consistent panel surfaces while retaining current child composition.
- `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx` — calmer field hierarchy, concise time/availability feedback, primary CTA polish.
- `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx` — quiet toolbar, scanable booking rows, and consistent loading/empty states.
- `apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx` — assert replacement page heading plus both preserved child components.

No files created.

---

### Task 1: Polish page title and panel surfaces

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx:10-18`
- Modify: `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx:1-40`

**Interfaces:**
- Consumes: `SimpleBookingForm` and `ZoomMyBookingsView` exports from `../components`.
- Produces: semantic page title `Booking meeting`, section heading `Buat meeting`, unchanged child rendering and desktop/mobile grid classes.

- [ ] **Step 1: Change heading assertion before page markup**

Replace test body with:

```tsx
describe('ClientZoomBookingPage', () => {
    it('renders quiet booking header, form, and existing booking list', () => {
        render(<ClientZoomBookingPage />);

        expect(screen.getByRole('heading', { name: 'Booking meeting' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Buat meeting' })).toBeInTheDocument();
        expect(screen.getByTestId('simple-booking-form')).toBeInTheDocument();
        expect(screen.getByTestId('my-bookings-view')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx
```

Expected: FAIL because `Booking meeting` and `Buat meeting` do not exist.

- [ ] **Step 3: Replace page markup with quiet title and surfaces**

Replace `ClientZoomBookingPage.tsx` with:

```tsx
import { SimpleBookingForm, ZoomMyBookingsView } from '../components';

export function ClientZoomBookingPage() {
    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6 animate-fade-in-up">
            <header className="space-y-1 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                    Zoom
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    Booking meeting
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Buat dan kelola jadwal meeting Anda.
                </p>
            </header>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
                <section
                    aria-labelledby="booking-form-heading"
                    className="sticky top-6 rounded-2xl bg-card p-5 shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none lg:col-span-5"
                >
                    <div className="mb-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Detail meeting
                        </p>
                        <h2 id="booking-form-heading" className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                            Buat meeting
                        </h2>
                    </div>
                    <SimpleBookingForm />
                </section>

                <section
                    aria-label="Daftar meeting saya"
                    className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none lg:col-span-7"
                >
                    <ZoomMyBookingsView />
                </section>
            </div>
        </main>
    );
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run:

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx
```

Expected: PASS with 1 test.

- [ ] **Step 5: Commit page polish**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx
git commit -m "refactor(zoom): polish client booking page surface"
```

---

### Task 2: Polish form hierarchy and booking feedback

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx:158-298`

**Interfaces:**
- Consumes: existing `availability`, `createBooking`, state setters, `calculateEndTime`, and `SimpleRecurringField`.
- Produces: same form submission and validation behavior, with no changed props or hook calls.

- [ ] **Step 1: Add behavioral coverage before changing visual-only form code**

Do not add a new visual-class test. Existing page smoke test from Task 1 verifies that the form component remains mounted. Review that `handleSubmit`, `useCheckAvailability`, `useCreateBooking`, and `SimpleRecurringField` code outside lines 158-298 are untouched.

- [ ] **Step 2: Replace availability class mapping**

Replace:

```tsx
const availabilityClassName = availability.isLoading
    ? 'bg-muted/30'
    : availability.data?.available
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
        : 'border-red-500/30 bg-red-500/10 text-red-700';
```

with:

```tsx
const availabilityClassName = availability.isLoading
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    : availability.data?.available
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
```

- [ ] **Step 3: Apply exact form presentation changes without altering inputs**

Make these class/name replacements only:

```tsx
<form className="space-y-5" onSubmit={handleSubmit}>
```

```tsx
<Label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="simple-booking-title">
    Judul meeting <span aria-hidden="true">*</span>
</Label>
```

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

```tsx
<Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tanggal <span aria-hidden="true">*</span></Label>
```

```tsx
<Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Durasi <span aria-hidden="true">*</span></Label>
```

Replace time-range block at `startTime &&` with:

```tsx
<div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
    <span className="font-medium">Waktu meeting</span>
    <span className="font-mono font-semibold tabular-nums">
        {startTime}–{calculateEndTime(startTime, duration)} WIB
    </span>
</div>
```

Replace availability outer element with:

```tsx
<div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${availabilityClassName}`}>
```

Remove decorative `FileText`, `Clock`, and `Users` label icon elements. Keep icons inside availability state and submit button because they communicate action/status.

Replace submit button with:

```tsx
<Button
    className="group mt-1 w-full rounded-full font-semibold transition-transform duration-200 [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 active:translate-y-0"
    disabled={createBooking.isPending || availability.data?.available === false}
    type="submit"
>
    {createBooking.isPending ? 'Membuat...' : 'Buat meeting'}
    {!createBooking.isPending && (
        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0.5">
            <Video className="h-3 w-3" aria-hidden="true" />
        </span>
    )}
</Button>
```

- [ ] **Step 4: Verify form behavior is still covered and compiles**

Run:

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx && npm run build
```

Expected: focused test PASS; build exits 0.

- [ ] **Step 5: Commit form polish**

```bash
git add apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx
git commit -m "refactor(zoom): simplify booking form feedback"
```

---

### Task 3: Polish meeting toolbar, states, and booking rows

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx:83-365`

**Interfaces:**
- Consumes: `useMyBookings`, `useCancelOwnBooking`, `BookingDetailsModal`, `RescheduleModal`, `CancelBookingModal`, and existing `BookingCardProps` callbacks.
- Produces: unchanged tab filtering, search filtering, detail/open/copy/join/reschedule/cancel event handling.

- [ ] **Step 1: Add no new visual-only test**

No state/data contract changes occur in this task. Preserve existing callbacks, `data`, and button text. The Task 1 test confirms the list remains mounted; Task 3 verification uses TypeScript build and feature test suite to catch invalid JSX/imports.

- [ ] **Step 2: Replace toolbar classes and remove scrolling blur**

Replace toolbar and tab container classes:

```tsx
<div className="shrink-0 space-y-3 px-5 py-4">
```

```tsx
<div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
```

Use tab classes:

```tsx
"rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 [transition-timing-function:var(--ease-out)]",
tab === t
    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-slate-50"
    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
```

Use search class:

```tsx
className="h-9 rounded-lg bg-slate-50 pl-8 text-xs dark:bg-slate-800/60"
```

Do not use `backdrop-blur` in toolbar.

- [ ] **Step 3: Make loading, empty, and date grouping quiet**

Replace skeleton item class with:

```tsx
<div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
```

Replace empty-state icon with:

```tsx
<Calendar className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
```

Replace date heading classes with:

```tsx
"text-xs font-semibold",
isDateToday
    ? "text-blue-700 dark:text-blue-300"
    : "text-slate-500 dark:text-slate-400"
```

Remove `px-2 py-0.5 rounded-full` from the date label. Keep existing line separator.

- [ ] **Step 4: Simplify booking card surface while preserving actions**

Replace `BookingCard` outer class composition with:

```tsx
cn(
    "group relative cursor-pointer rounded-xl bg-slate-50/80 p-4 transition-[transform,background-color] duration-200 [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/80",
    isPastBooking && "opacity-70"
)
```

Replace status class with:

```tsx
"shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
cfg.color.replace(' border-emerald-200', '').replace(' border-red-200', '')
```

Replace card action wrapper class with:

```tsx
<div className="mt-3 flex flex-wrap items-center gap-2 pl-3">
```

Replace reschedule button class with:

```tsx
className="ml-auto h-7 rounded-full text-xs"
```

Replace cancel button class with:

```tsx
className="h-7 rounded-full border-red-200 text-xs text-red-500 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
```

Keep all `onClick`, `stopPropagation`, conditional rendering, button labels, and `window.open` behavior exactly unchanged.

- [ ] **Step 5: Run booking feature tests and build**

Run:

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx src/features/zoom-booking/components/__tests__ && npm run build
```

Expected: all selected tests PASS; build exits 0.

- [ ] **Step 6: Commit list polish**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx
git commit -m "refactor(zoom): calm client meeting list UI"
```

---

### Task 4: Regression review and responsive verification

**Files:**
- Review: `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx`
- Review: `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`
- Review: `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`
- Review: `apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx`

**Interfaces:**
- Consumes: final UI files from Tasks 1-3.
- Produces: verified UI polish with no data or interaction regression.

- [ ] **Step 1: Review prohibited visual patterns**

Run:

```bash
cd apps/frontend && rg "backdrop-blur|border-slate-200 dark:border-slate-800 bg-card.*shadow-sm|Video aria-hidden.*h-6" src/features/zoom-booking/pages/ClientZoomBookingPage.tsx src/features/zoom-booking/components/ZoomMyBookingsView.tsx
```

Expected: no output.

- [ ] **Step 2: Run complete frontend test suite**

Run:

```bash
cd apps/frontend && npm test
```

Expected: PASS. If existing unrelated test fails, record exact failing test and do not claim full suite passed.

- [ ] **Step 3: Build frontend**

Run:

```bash
cd apps/frontend && npm run build
```

Expected: exits 0.

- [ ] **Step 4: Manually verify responsive and dark-mode surfaces**

Run application, then verify:

1. At desktop `>=1024px`, form is left `5/12`, list is right `7/12`.
2. Below `1024px`, panels stack and no content is clipped.
3. Dark mode keeps body text, feedback, and status readable.
4. Booking validation, availability feedback, submit, list tabs/search, detail, copy, join, reschedule, and cancel still respond.

- [ ] **Step 5: Commit any regression-only fix**

If review requires no code change, do not make an empty commit. If it requires a targeted fix:

```bash
git add apps/frontend/src/features/zoom-booking
git commit -m "fix(zoom): preserve client booking polish behavior"
```

---

## Self-Review

- **Spec coverage:** Task 1 covers preserved split layout, quiet header, panel surfaces, and heading semantics. Task 2 covers field hierarchy, feedback, CTA, availability, and preserved form behavior. Task 3 covers toolbar, booking list scanability, account accent, status, loading, and empty state. Task 4 covers dark mode, mobile stacking, functional actions, test, and build verification.
- **Placeholder scan:** no `TBD`, `TODO`, deferred implementation, or undefined interface introduced.
- **Type consistency:** no new types or props. Existing component interfaces, hooks, DTO state, and action callbacks remain unchanged.
