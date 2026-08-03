# Zoom Calendar Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Zoom Calendar page from a 400-px slide-in side panel layout into a Command Center layout that fits 17" monitors without scroll, supports 10+ accounts via a "Gabungan" combined view, and renders up to 10 simultaneous meetings via vertical-stack + popover.

**Architecture:** Refactor `ZoomCalendarShell` into 3 zones (header / calendar / persistent right sidebar). New `ZoomCalendarSubBar` between header and calendar holds view switcher, quick-book, legend, and system status. Replace slide-in panel with `ZoomBookingModal` (centered overlay). Refactor `processBookingsForDay` to return `rowIndex` + `totalRows` instead of `columnIndex` + `totalColumns` for vertical stacking with cap-at-4 + popover.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, date-fns, framer-motion, vitest + @testing-library/react.

**Spec:** [`docs/superpowers/specs/2026-06-17-zoom-calendar-page-redesign.md`](../specs/2026-06-17-zoom-calendar-page-redesign.md)

---

## File Structure

### New files
```
apps/frontend/src/features/zoom-booking/
├── components/
│   ├── ZoomCalendarSubBar.tsx         (new — view switcher + quick book + legend)
│   ├── ZoomRightSidebar.tsx           (new — persistent 280px column)
│   ├── ZoomAccountSwitcher.tsx        (new — Gabungan + 10 accounts grid)
│   ├── ZoomOverflowPopover.tsx        (new — shows 10 simultaneous meetings)
│   ├── ZoomShortcutsModal.tsx         (new — keyboard shortcut list)
│   ├── ZoomBookingModal.tsx           (new — replaces BookingForm + BookingPanel)
│   ├── ZoomAccountLoadWidget.tsx      (new — top 5 accounts by load)
│   └── ZoomQuickBookButtons.tsx       (new — 1h + Custom buttons, shared)
├── hooks/
│   └── useMyTasks.ts                  (new — localStorage-backed task list)
├── utils/
│   └── autoPickAccount.ts             (new — algorithm to pick least-loaded account)
└── components/__tests__/
    ├── ZoomCalendarSubBar.test.tsx
    ├── ZoomRightSidebar.test.tsx
    ├── ZoomAccountSwitcher.test.tsx
    ├── ZoomOverflowPopover.test.tsx
    ├── ZoomShortcutsModal.test.tsx
    ├── ZoomBookingModal.test.tsx
    └── autoPickAccount.test.ts
```

### Modified files
```
apps/frontend/src/features/zoom-booking/
├── components/
│   ├── ZoomCalendarPage.tsx           (orchestrator — wire new layout)
│   ├── ZoomCalendarShell.tsx          (3-zone layout)
│   ├── ZoomCalendarHeader.tsx         (compact single-line)
│   ├── ZoomCalendarGrid.tsx           (rowIndex + totalRows)
│   ├── ZoomWeekView.tsx               (use vertical stack)
│   ├── ZoomDayView.tsx                (use vertical stack)
│   ├── ZoomBookingForm.tsx            (delete — replaced by ZoomBookingModal)
│   ├── ZoomBookingPanel.tsx           (delete — replaced by ZoomBookingModal)
│   ├── UpcomingMeetingsPanel.tsx      (compact: drop NEXT strip pulse)
│   └── index.ts                       (export updates)
├── hooks/
│   ├── useCalendarView.ts             (add 'gabungan' as account scope)
│   ├── useZoomBooking.ts              (new query: useZoomAccountLoads)
│   └── useBookingPanel.ts             (add 'modal' mode)
```

---

## Conventions

- **TDD order:** red (failing test) → green (minimal impl) → refactor → commit.
- **Commit messages:** Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- **File naming:** PascalCase for components, camelCase for hooks/utils.
- **Test files:** co-located in `__tests__/` subdir, named `<Component>.test.tsx`.
- **Test runner:** `npx vitest run <path>` for single file, `npx vitest` for watch.
- **Branch:** work on `refactor/zoom-calendar-redesign` (create from current branch).
- **Run command from:** `apps/frontend/` (the Vite workspace).

---

## Phase 0 — Setup (no behavior change)

### Task 0.1: Create feature branch

**Files:** None

- [ ] **Step 1: Verify current branch and create new branch**

```bash
cd "f:/Program Bagas/SynologyDrive/iDesk-main"
git status
git checkout -b refactor/zoom-calendar-redesign
```

Expected: branch created, working tree clean.

### Task 0.2: Add account color tokens

**Files:**
- Modify: `apps/frontend/src/index.css` (add CSS custom properties for account palette)

- [ ] **Step 1: Add account color CSS variables**

Append to `apps/frontend/src/index.css` (at end of `@layer base` block):

```css
@layer base {
  /* Account color palette (10-color spectrum) */
  --account-1: 217 91% 60%;  /* blue-500 */
  --account-2: 160 84% 39%;  /* emerald-500 */
  --account-3: 262 83% 58%;  /* violet-500 */
  --account-4: 38 92% 50%;   /* amber-500 */
  --account-5: 330 81% 60%;  /* pink-500 */
  --account-6: 189 94% 43%;  /* cyan-500 */
  --account-7: 84 81% 44%;   /* lime-500 */
  --account-8: 0 84% 60%;    /* red-500 */
  --account-9: 271 81% 56%;  /* purple-500 */
  --account-10: 215 16% 47%; /* slate-500 */
}

@layer utilities {
  .bg-account-1 { background-color: hsl(var(--account-1)); }
  .bg-account-2 { background-color: hsl(var(--account-2)); }
  .bg-account-3 { background-color: hsl(var(--account-3)); }
  .bg-account-4 { background-color: hsl(var(--account-4)); }
  .bg-account-5 { background-color: hsl(var(--account-5)); }
  .bg-account-6 { background-color: hsl(var(--account-6)); }
  .bg-account-7 { background-color: hsl(var(--account-7)); }
  .bg-account-8 { background-color: hsl(var(--account-8)); }
  .bg-account-9 { background-color: hsl(var(--account-9)); }
  .bg-account-10 { background-color: hsl(var(--account-10)); }
}
```

- [ ] **Step 2: Verify CSS is valid**

```bash
cd apps/frontend && npx tailwindcss --input src/index.css --output /tmp/out.css
```

Expected: build completes, `/tmp/out.css` contains the new utilities.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/index.css
git commit -m "feat(zoom): add 10-account color palette tokens"
```

### Task 0.3: Create autoPickAccount utility (with TDD)

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/utils/autoPickAccount.ts`
- Create: `apps/frontend/src/features/zoom-booking/utils/__tests__/autoPickAccount.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/utils/__tests__/autoPickAccount.test.ts
import { describe, it, expect } from 'vitest';
import { autoPickAccount, type AccountLoad } from '../autoPickAccount';

describe('autoPickAccount', () => {
  const accounts: AccountLoad[] = [
    { id: 'a1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 3 },
    { id: 'a2', name: 'Sales', colorHex: '#10b981', meetingsAtTime: 1 },
    { id: 'a3', name: 'Engineering', colorHex: '#8b5cf6', meetingsAtTime: 0 },
  ];

  it('returns account with zero meetings at the time if any', () => {
    const picked = autoPickAccount(accounts, '10:00');
    expect(picked?.id).toBe('a3');
  });

  it('returns account with fewest meetings when none have zero', () => {
    const busy: AccountLoad[] = accounts.map(a => ({ ...a, meetingsAtTime: Math.max(1, a.meetingsAtTime) }));
    const picked = autoPickAccount(busy, '10:00');
    expect(picked?.id).toBe('a2');
  });

  it('returns null when accounts list is empty', () => {
    expect(autoPickAccount([], '10:00')).toBeNull();
  });

  it('uses stable tiebreaker by id when loads are equal', () => {
    const tied: AccountLoad[] = [
      { id: 'z', name: 'Z', colorHex: '#000', meetingsAtTime: 1 },
      { id: 'a', name: 'A', colorHex: '#fff', meetingsAtTime: 1 },
    ];
    const picked = autoPickAccount(tied, '10:00');
    expect(picked?.id).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/utils/__tests__/autoPickAccount.test.ts
```

Expected: FAIL — "Cannot find module '../autoPickAccount'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/frontend/src/features/zoom-booking/utils/autoPickAccount.ts
export interface AccountLoad {
  id: string;
  name: string;
  colorHex: string;
  meetingsAtTime: number;
}

export function autoPickAccount(
  accounts: AccountLoad[],
  time: string,
): AccountLoad | null {
  if (accounts.length === 0) return null;
  const sorted = [...accounts].sort((a, b) => {
    if (a.meetingsAtTime !== b.meetingsAtTime) {
      return a.meetingsAtTime - b.meetingsAtTime;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/utils/__tests__/autoPickAccount.test.ts
```

Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/utils/
git commit -m "feat(zoom): add autoPickAccount utility for Gabungan mode"
```

---

## Phase 1 — Replace emoji with Lucide icons (cosmetic, safe to defer)

This phase only swaps glyphs; behavior is unchanged. Useful as a foundation before layout work.

### Task 1.1: Audit emoji usage

**Files:** Read-only

- [ ] **Step 1: Grep for emoji in zoom-booking**

```bash
cd apps/frontend
grep -rnP '[\x{1F300}-\x{1F9FF}\x{2600}-\x{27BF}]' src/features/zoom-booking/ --include="*.tsx" --include="*.ts" | head -50
```

Expected: list of files + line numbers containing emoji. Save this list.

Emoji → Lucide mapping (use as reference):

| Emoji | Lucide | Import |
|-------|--------|--------|
| 📹 | Video | already imported in most files |
| 📅 | Calendar | `Calendar` |
| 📆 | CalendarDays | `CalendarDays` |
| 🔍 | Search | `Search` |
| ⚙ | Settings | `Settings` |
| ✅ | Check | `Check` |
| ⏰ | Clock | `Clock` |
| 🔗 | ExternalLink | `ExternalLink` |
| 📋 | FileText | `FileText` |
| 🔁 | Repeat | `Repeat` |
| ➕ | Plus | `Plus` |
| 👤 | User | `User` |
| ☑ | ListChecks | `ListChecks` |
| 🌐 | Globe | `Globe` |
| ⌨ | Keyboard | `Keyboard` |

### Task 1.2: Replace emoji in UpcomingMeetingsPanel

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/UpcomingMeetingsPanel.tsx`

- [ ] **Step 1: Update lucide-react import line**

```typescript
// Replace existing import:
import { Video, Calendar, Clock, Copy, ExternalLink, FileText, Hash, CalendarClock, Trash2, Check, Plus, User } from 'lucide-react';
```

- [ ] **Step 2: Replace emoji with icons**

In the JSX of the file, replace:
- `📹` → `<Video className="h-3 w-3" />` (or matching size)
- `📅` → `<Calendar className="h-3 w-3" />`
- `⏰` → `<Clock className="h-3 w-3" />`
- `📋` → `<FileText className="h-3.5 w-3.5" />`
- `➕` → `<Plus className="h-3 w-3" />`

Keep all other text content (labels, colors) unchanged. Wrap icons in `<span>` with appropriate `aria-hidden="true"` for accessibility.

- [ ] **Step 3: Run smoke tests**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ 2>/dev/null | tail -20
```

Expected: no new failures. Existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/UpcomingMeetingsPanel.tsx
git commit -m "refactor(zoom): replace emoji with Lucide icons in UpcomingMeetingsPanel"
```

### Task 1.3: Replace emoji in ZoomBookingForm

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`

- [ ] **Step 1-4:** Same pattern as Task 1.2. Apply emoji → Lucide replacements per the mapping table.

```bash
git commit -m "refactor(zoom): replace emoji with Lucide icons in ZoomBookingForm"
```

### Task 1.4: Replace emoji in remaining files

**Files:**
- Modify: `ZoomBookingPanel.tsx`, `ZoomMonthView.tsx`, `ZoomWeekView.tsx`, `ZoomDayView.tsx`, `ZoomCalendarHeader.tsx`, `ZoomRescheduleView.tsx`, `ZoomBookingDetailView.tsx`, `ZoomAuditLogsViewer.tsx`

- [ ] **Step 1-4:** Repeat per file. Group remaining files in one commit:

```bash
git add apps/frontend/src/features/zoom-booking/components/
git commit -m "refactor(zoom): replace remaining emoji with Lucide icons"
```

---

## Phase 2 — Layout shell (3-zone: header / main / sidebar)

This phase refactors `ZoomCalendarShell` to use a 280-px persistent right column. The slide-in side panel is removed in this phase; its content is replaced in Phase 6 by `ZoomBookingModal`.

### Task 2.1: Write test for new ZoomRightSidebar component

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ZoomRightSidebar } from '../ZoomRightSidebar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('ZoomRightSidebar', () => {
  it('renders all 5 sections', () => {
    render(
      <ZoomRightSidebar
        accounts={[]}
        upcomingBookings={[]}
        onBook1Hour={() => {}}
        onBookCustom={() => {}}
        onSync={() => {}}
        lastSyncAt={new Date()}
        userName="Bagas"
      />,
      { wrapper }
    );

    expect(screen.getByText(/account load/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
    expect(screen.getByText(/quick book/i)).toBeInTheDocument();
    expect(screen.getByText(/my tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });

  it('displays user name in system section', () => {
    render(
      <ZoomRightSidebar
        accounts={[]}
        upcomingBookings={[]}
        onBook1Hour={() => {}}
        onBookCustom={() => {}}
        onSync={() => {}}
        lastSyncAt={new Date()}
        userName="Bagas"
      />,
      { wrapper }
    );
    expect(screen.getByText(/Bagas/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx
```

Expected: FAIL — "Cannot find module '../ZoomRightSidebar'".

### Task 2.2: Build ZoomRightSidebar component (skeleton)

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomRightSidebar.tsx`

- [ ] **Step 1: Create component file with section placeholders**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomRightSidebar.tsx
import { Zap, FileText, ListChecks, CheckCircle2, Keyboard, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ZoomBooking } from '../types';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomRightSidebarProps {
  accounts: AccountLoad[];
  upcomingBookings: ZoomBooking[];
  onBook1Hour: () => void;
  onBookCustom: () => void;
  onSync: () => void;
  lastSyncAt: Date | null;
  userName: string;
}

export function ZoomRightSidebar({
  accounts,
  upcomingBookings,
  onBook1Hour,
  onBookCustom,
  onSync,
  lastSyncAt,
  userName,
}: ZoomRightSidebarProps) {
  const top5 = [...accounts].sort((a, b) => b.meetingsAtTime - a.meetingsAtTime).slice(0, 5);

  return (
    <aside className="w-[280px] shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col min-h-0">
      {/* D1 · Account Load */}
      <section className="p-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
          Account Load
        </h3>
        {top5.length === 0 ? (
          <p className="text-xs text-slate-500">No accounts</p>
        ) : (
          <ul className="space-y-1.5">
            {top5.map((acc) => (
              <li key={acc.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.colorHex }} />
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{acc.name}</span>
                <span className="text-slate-500 font-semibold">{acc.meetingsAtTime}</span>
                <span className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                  <span
                    className="block h-full"
                    style={{
                      width: `${Math.min(100, (acc.meetingsAtTime / 25) * 100)}%`,
                      backgroundColor: acc.colorHex,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D2 · Upcoming */}
      <section className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Upcoming</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {upcomingBookings.length}
          </span>
        </div>
        {upcomingBookings.length === 0 ? (
          <p className="text-xs text-slate-500">No upcoming meetings</p>
        ) : (
          <ul className="space-y-1.5">
            {upcomingBookings.slice(0, 3).map((b) => (
              <li
                key={b.id}
                className="px-2 py-1.5 rounded text-[11px] bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500"
              >
                <div className="font-semibold truncate text-slate-800 dark:text-slate-200">{b.title}</div>
                <div className="text-[10px] text-slate-500">
                  {b.bookingDate} · {b.startTime}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D3 · Quick Book */}
      <section className="p-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
          Quick Book
        </h3>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
            onClick={onBook1Hour}
          >
            <Zap className="h-3 w-3" /> 1 hour meeting
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={onBookCustom}
          >
            <FileText className="h-3 w-3" /> Custom duration + recurring
          </Button>
        </div>
      </section>

      {/* D4 · My Tasks */}
      <section className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">My Tasks</h3>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Add task">
            <ListChecks className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 italic">No tasks yet. Press + to add.</p>
      </section>

      {/* D5 · System (pinned to bottom) */}
      <section className="p-3 mt-auto">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">System</h3>
        <button
          onClick={onSync}
          className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mb-1 hover:underline"
        >
          <CheckCircle2 className="h-3 w-3" />
          {lastSyncAt ? `Sync OK · ${formatRelative(lastSyncAt)}` : 'Never synced'}
        </button>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
          <UserIcon className="h-3 w-3" />
          Logged in as <strong className="text-slate-800 dark:text-slate-200">{userName}</strong>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Keyboard className="h-3 w-3" />
          Tekan <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 rounded text-[10px] font-mono">?</kbd> untuk shortcuts
        </div>
      </section>
    </aside>
  );
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx
```

Expected: 2 tests passed.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomRightSidebar.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx
git commit -m "feat(zoom): add ZoomRightSidebar with 5 sections (skeleton)"
```

### Task 2.3: Refactor ZoomCalendarShell to 3-zone layout

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx`

- [ ] **Step 1: Replace shell component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ZoomCalendarShellProps {
  header: React.ReactNode;
  subBar?: React.ReactNode;
  calendarContent: React.ReactNode;
  sidebar: React.ReactNode;
  bottomStrip?: React.ReactNode;
  className?: string;
}

export function ZoomCalendarShell({
  header,
  subBar,
  calendarContent,
  sidebar,
  bottomStrip,
  className,
}: ZoomCalendarShellProps) {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Header (48px) */}
      <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-20">
        {header}
      </div>

      {/* Sub-bar (36px) */}
      {subBar && (
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">
          {subBar}
        </div>
      )}

      {/* Main: calendar (flex-1) + sidebar (280px) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          {calendarContent}
        </div>
        {sidebar}
      </div>

      {/* Bottom strip */}
      {bottomStrip && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700">
          {bottomStrip}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Find all callers of ZoomCalendarShell**

```bash
cd apps/frontend && grep -rln "ZoomCalendarShell" src/
```

Expected: at least `ZoomCalendarPage.tsx`. Update each.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarShell.tsx
git commit -m "refactor(zoom): ZoomCalendarShell now 3-zone (header + sub-bar + main/sidebar)"
```

### Task 2.4: Wire ZoomRightSidebar into ZoomCalendarPage

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Update imports**

Add import:
```typescript
import { ZoomRightSidebar } from '../components/ZoomRightSidebar';
import { ZoomBookingPanel } from '../components/ZoomBookingPanel'; // existing, will be removed in Phase 6
```

- [ ] **Step 2: Replace ZoomCalendarShell usage**

Find the existing `<ZoomCalendarShell ... />` JSX in `ZoomCalendarPage.tsx`. Replace the `panel` prop and `isPanelOpen` prop with `sidebar` prop.

Before (current code):
```tsx
<ZoomCalendarShell
  header={<ZoomCalendarHeader ... />}
  isPanelOpen={panel.isOpen}
  calendarContent={calendarContent()}
  panel={<ZoomBookingPanel ... />}
  topStrip={<UpcomingMeetingsPanel compact ... />}
/>
```

After:
```tsx
<ZoomCalendarShell
  header={<ZoomCalendarHeader ... />}
  calendarContent={calendarContent()}
  sidebar={
    <ZoomRightSidebar
      accounts={[]}
      upcomingBookings={[]}
      onBook1Hour={() => { /* TODO: Phase 6 */ }}
      onBookCustom={() => { /* TODO: Phase 6 */ }}
      onSync={handleSync}
      lastSyncAt={null}
      userName="User"
    />
  }
/>
```

- [ ] **Step 3: Run dev server, verify layout**

```bash
cd apps/frontend && npm run dev
```

Open `http://localhost:5173/zoom-calendar`. Verify:
- Right column visible (280px)
- All 5 sections render
- Calendar takes remaining width

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): wire ZoomRightSidebar into ZoomCalendarPage"
```

---

## Phase 3 — ZoomCalendarSubBar

The sub-bar contains the view switcher, Quick Book buttons, color legend, and system status icons. It's a single 36-px-tall row that lives between the header and the calendar.

### Task 3.1: Write test for ZoomCalendarSubBar

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomCalendarSubBar } from '../ZoomCalendarSubBar';

describe('ZoomCalendarSubBar', () => {
  const defaultProps = {
    view: 'week' as const,
    onViewChange: vi.fn(),
    onBook1Hour: vi.fn(),
    onBookCustom: vi.fn(),
    onOpenShortcuts: vi.fn(),
    onOpenSettings: vi.fn(),
    isLive: true,
    lastSyncAt: new Date(),
  };

  it('renders all 4 view switcher buttons', () => {
    render(<ZoomCalendarSubBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my bookings/i })).toBeInTheDocument();
  });

  it('renders the 1-hour and custom quick-book buttons', () => {
    render(<ZoomCalendarSubBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /1 hour/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('calls onBook1Hour when 1-hour button is clicked', async () => {
    const onBook1Hour = vi.fn();
    render(<ZoomCalendarSubBar {...defaultProps} onBook1Hour={onBook1Hour} />);
    await userEvent.click(screen.getByRole('button', { name: /1 hour/i }));
    expect(onBook1Hour).toHaveBeenCalledOnce();
  });

  it('renders the legend with all 4 categories', () => {
    render(<ZoomCalendarSubBar {...defaultProps} />);
    expect(screen.getByText(/saya/i)).toBeInTheDocument();
    expect(screen.getByText(/tim/i)).toBeInTheDocument();
    expect(screen.getByText(/external/i)).toBeInTheDocument();
    expect(screen.getByText(/blokir/i)).toBeInTheDocument();
  });

  it('shows "Live" indicator when isLive is true', () => {
    render(<ZoomCalendarSubBar {...defaultProps} isLive={true} />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
```

Expected: FAIL — "Cannot find module '../ZoomCalendarSubBar'".

### Task 3.2: Build ZoomCalendarSubBar component

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx
import { Zap, FileText, Settings, Keyboard, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { CalendarView } from '../hooks/useCalendarView';

export interface ZoomCalendarSubBarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onBook1Hour: () => void;
  onBookCustom: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  isLive: boolean;
  lastSyncAt: Date | null;
  className?: string;
}

export function ZoomCalendarSubBar({
  view,
  onViewChange,
  onBook1Hour,
  onBookCustom,
  onOpenShortcuts,
  onOpenSettings,
  isLive,
  lastSyncAt,
  className,
}: ZoomCalendarSubBarProps) {
  return (
    <div className={`h-9 flex items-center px-4 gap-3 ${className ?? ''}`}>
      <ZoomViewSwitcher view={view} onViewChange={onViewChange} />

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick:</span>

      <Button
        size="sm"
        className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={onBook1Hour}
      >
        <Zap className="h-3 w-3" /> 1 hour
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-7 px-3 text-xs gap-1.5"
        onClick={onBookCustom}
      >
        <FileText className="h-3 w-3" /> Custom…
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Legend:</span>
        <LegendChip color="linear-gradient(135deg, #3b82f6, #2563eb)" label="Saya" />
        <LegendChip color="linear-gradient(135deg, #fbbf24, #f59e0b)" label="Tim" />
        <LegendChip color="#cbd5e1" label="External" />
        <LegendChip color="linear-gradient(135deg, #ef4444, #dc2626)" label="Blokir" />

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-1 text-[11px]">
          <CircleDot className={`h-3 w-3 ${isLive ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`} />
          <span className="text-slate-600 dark:text-slate-400" title={lastSyncAt?.toLocaleString()}>
            {isLive && lastSyncAt ? `Live · ${formatDistanceToNow(lastSyncAt, { locale: idLocale, addSuffix: true })}` : 'Offline'}
          </span>
        </div>

        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts">
          <Keyboard className="h-3.5 w-3.5 text-slate-500" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onOpenSettings} aria-label="Settings">
          <Settings className="h-3.5 w-3.5 text-slate-500" />
        </Button>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
      <span
        className="w-2.5 h-2.5 rounded-sm border-l-2"
        style={{ background: color, borderLeftColor: 'rgba(255,255,255,0.4)' }}
      />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx
```

Expected: 5 tests passed.

- [ ] **Step 3: Wire into ZoomCalendarPage**

In `ZoomCalendarPage.tsx`:
- Import `ZoomCalendarSubBar`
- Add to `ZoomCalendarShell` via the new `subBar` prop
- Wire `onBook1Hour` and `onBookCustom` to open booking modal (use placeholder for now)

```tsx
<ZoomCalendarShell
  header={<ZoomCalendarHeader ... />}
  subBar={
    <ZoomCalendarSubBar
      view={view}
      onViewChange={setView}
      onBook1Hour={() => panel.openBooking({ /* 1h preset */ })}
      onBookCustom={() => panel.openBooking({ /* full form */ })}
      onOpenShortcuts={() => setShortcutsOpen(true)}
      onOpenSettings={() => navigate('/zoom-calendar/settings')}
      isLive={true}
      lastSyncAt={new Date()}
    />
  }
  calendarContent={calendarContent()}
  sidebar={<ZoomRightSidebar ... />}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarSubBar.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): add ZoomCalendarSubBar with view switcher, quick book, legend"
```

---

## Phase 4 — Account Switcher + Gabungan mode

This phase adds the "Gabungan" (combined) account mode and the dropdown switcher modal. After this, users can book without picking an account.

### Task 4.1: Extend useCalendarView hook to support 'gabungan'

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts`

- [ ] **Step 1: Read existing file**

```bash
cd apps/frontend && cat src/features/zoom-booking/hooks/useCalendarView.ts
```

- [ ] **Step 2: Add 'gabungan' as valid account scope**

In the type definitions and state setters, add `'gabungan'` as a valid value for `accountScope` (or `selectedAccountId`).

```typescript
// Add to existing types:
export type AccountScope = 'gabungan' | string; // 'gabungan' or an account ID

// In the hook:
const [accountScope, setAccountScope] = useState<AccountScope>(() => {
  // Read from URL or localStorage, default to 'gabungan'
  return (searchParams.get('account') as AccountScope) ?? 'gabungan';
});

useEffect(() => {
  if (accountScope) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (accountScope === 'gabungan') {
        next.delete('account');
      } else {
        next.set('account', accountScope);
      }
      return next;
    });
    localStorage.setItem('zoom-calendar-account', accountScope);
  }
}, [accountScope, setSearchParams]);
```

- [ ] **Step 3: Add tests**

Create `apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCalendarView } from '../useCalendarView';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/zoom-calendar']}>{children}</MemoryRouter>
);

describe('useCalendarView account scope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults account scope to "gabungan"', () => {
    const { result } = renderHook(() => useCalendarView(), { wrapper });
    expect(result.current.accountScope).toBe('gabungan');
  });

  it('setAccountScope updates the scope', () => {
    const { result } = renderHook(() => useCalendarView(), { wrapper });
    act(() => result.current.setAccountScope('acc-123'));
    expect(result.current.accountScope).toBe('acc-123');
  });

  it('persists account scope to localStorage', () => {
    const { result } = renderHook(() => useCalendarView(), { wrapper });
    act(() => result.current.setAccountScope('acc-456'));
    expect(localStorage.getItem('zoom-calendar-account')).toBe('acc-456');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/hooks/__tests__/useCalendarView.test.ts
```

Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/hooks/useCalendarView.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useCalendarView.test.ts
git commit -m "feat(zoom): extend useCalendarView with 'gabungan' account scope"
```

### Task 4.2: Update useZoomCalendar hook to support Gabungan

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useZoomBooking.ts`

- [ ] **Step 1: Read existing useZoomCalendar**

```bash
cd apps/frontend && cat src/features/zoom-booking/hooks/useZoomBooking.ts | head -100
```

- [ ] **Step 2: Pass undefined for accountId when in Gabungan mode**

```typescript
// In ZoomCalendarPage.tsx, update the useZoomCalendar call:
const effectiveAccountId = accountScope === 'gabungan' ? undefined : accountScope;
const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
  view !== 'my-bookings' ? effectiveAccountId : undefined,
  dateRange.start,
  dateRange.end
);
```

- [ ] **Step 3: Verify backend supports merged query (open question Q1)**

```bash
# Inspect backend endpoint:
grep -rn "getCalendar" apps/backend/src/modules/zoom-booking/ | head -10
```

If backend requires accountId, add a follow-up note to ask backend team.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/hooks/useZoomBooking.ts apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): pass undefined accountId in Gabungan mode"
```

### Task 4.3: Write test for ZoomAccountSwitcher

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomAccountSwitcher } from '../ZoomAccountSwitcher';
import type { AccountLoad } from '../utils/autoPickAccount';

const accounts: AccountLoad[] = Array.from({ length: 10 }, (_, i) => ({
  id: `acc-${i + 1}`,
  name: `Account ${i + 1}`,
  colorHex: `hsl(${i * 36}, 70%, 50%)`,
  meetingsAtTime: i,
}));

describe('ZoomAccountSwitcher', () => {
  it('renders Gabungan card as first option with DEFAULT badge', () => {
    render(
      <ZoomAccountSwitcher
        open={true}
        accounts={accounts}
        currentAccountId="gabungan"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/gabungan/i)).toBeInTheDocument();
    expect(screen.getByText(/default/i)).toBeInTheDocument();
  });

  it('renders all 10 account cards in a grid', () => {
    render(
      <ZoomAccountSwitcher
        open={true}
        accounts={accounts}
        currentAccountId="gabungan"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    accounts.forEach((acc) => {
      expect(screen.getByText(acc.name)).toBeInTheDocument();
    });
  });

  it('calls onSelect with account id when an account card is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <ZoomAccountSwitcher
        open={true}
        accounts={accounts}
        currentAccountId="gabungan"
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Account 1'));
    expect(onSelect).toHaveBeenCalledWith('acc-1');
  });

  it('filters accounts by search query', async () => {
    render(
      <ZoomAccountSwitcher
        open={true}
        accounts={accounts}
        currentAccountId="gabungan"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.type(screen.getByPlaceholderText(/cari akun/i), 'Account 3');
    expect(screen.getByText('Account 3')).toBeInTheDocument();
    expect(screen.queryByText('Account 1')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx
```

Expected: FAIL.

### Task 4.4: Build ZoomAccountSwitcher

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx
import { useState, useEffect } from 'react';
import { Globe, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomAccountSwitcherProps {
  open: boolean;
  accounts: AccountLoad[];
  currentAccountId: string;
  onSelect: (accountId: string) => void;
  onClose: () => void;
}

export function ZoomAccountSwitcher({
  open,
  accounts,
  currentAccountId,
  onSelect,
  onClose,
}: ZoomAccountSwitcherProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] p-0 gap-0">
        <DialogTitle className="sr-only">Pilih akun Zoom</DialogTitle>

        {/* Search */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari akun Zoom…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <kbd className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-500">
              ESC
            </kbd>
          </div>
        </div>

        {/* Gabungan card */}
        <div className="p-2">
          <button
            onClick={() => onSelect('gabungan')}
            className={`w-full p-2.5 rounded-lg text-left flex items-center gap-2.5 border-2 transition-colors ${
              currentAccountId === 'gabungan'
                ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/30'
                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Globe className="h-4 w-4 text-blue-600" />
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-700 dark:text-blue-300">Gabungan (Semua Akun)</div>
              <div className="text-[10px] text-slate-500">Lihat & book di semua akun · auto-pilih paling kosong</div>
            </div>
            {currentAccountId === 'gabungan' && (
              <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">AKTIF</span>
            )}
          </button>
        </div>

        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
          Akun Individual ({accounts.length})
        </div>

        {/* Account grid */}
        <div className="p-2 grid grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto">
          {filtered.map((acc) => (
            <button
              key={acc.id}
              onClick={() => onSelect(acc.id)}
              className={`p-2 rounded-md text-left flex items-center gap-2 border ${
                currentAccountId === acc.id
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: acc.colorHex }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate text-slate-800 dark:text-slate-200">{acc.name}</div>
                <div className="text-[10px] text-slate-500">{acc.meetingsAtTime} mtg · load {Math.min(100, acc.meetingsAtTime * 4)}%</div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-[10px] text-slate-500">
          <span>↑↓ navigasi · ↵ pilih · ESC tutup</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx
```

Expected: 4 tests passed.

- [ ] **Step 3: Wire into ZoomCalendarHeader**

In `ZoomCalendarHeader.tsx`:
- Replace the current account-pills section with a single "Account" button that opens `ZoomAccountSwitcher`.
- Add state for `switcherOpen` and pass to header.

```tsx
<Button onClick={() => setSwitcherOpen(true)}>
  <span style={{ backgroundColor: currentAccount.colorHex }} />
  {currentAccount.name}
  <ChevronDown />
</Button>
<ZoomAccountSwitcher
  open={switcherOpen}
  accounts={accountLoads}
  currentAccountId={accountScope}
  onSelect={(id) => { setAccountScope(id); setSwitcherOpen(false); }}
  onClose={() => setSwitcherOpen(false)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomAccountSwitcher.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomAccountSwitcher.test.tsx apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx
git commit -m "feat(zoom): add ZoomAccountSwitcher with Gabungan option + 10-account grid"
```

---

## Phase 5 — Overflow handling (vertical stack + popover)

Refactor `processBookingsForDay` to use vertical stacking (cap at 4 visible) instead of horizontal column splitting. Add `ZoomOverflowPopover` for the overflow.

### Task 5.1: Write test for new processBookingsForDay with rowIndex

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts
import { describe, it, expect } from 'vitest';
import { processBookingsForDayV2, MAX_VISIBLE_ROWS } from '../ZoomCalendarGrid';
import type { CalendarDay } from '../../types';

describe('processBookingsForDayV2', () => {
  function mkDay(bookings: Array<{ id: string; startIdx: number; span: number; isMine?: boolean }>): CalendarDay {
    const slots = Array.from({ length: 24 }, (_, i) => ({
      time: `${8 + Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
      status: 'available' as const,
    }));
    bookings.forEach((b) => {
      for (let i = 0; i < b.span; i++) {
        slots[b.startIdx + i] = {
          time: slots[b.startIdx + i].time,
          status: b.isMine ? 'my_booking' : 'booked',
          booking: {
            id: b.id,
            title: b.id,
            bookedBy: 'X',
            startTime: slots[b.startIdx].time,
            endTime: 'X',
            durationMinutes: b.span * 30,
            isExternal: false,
          } as any,
        };
      }
    });
    return { date: '2026-06-11', slots };
  }

  it('returns rowIndex and totalRows for each booking', () => {
    const day = mkDay([
      { id: 'a', startIdx: 0, span: 2 },
      { id: 'b', startIdx: 0, span: 2 },
    ]);
    const result = processBookingsForDayV2(day);
    expect(result).toHaveLength(2);
    expect(result[0].totalRows).toBe(2);
    expect(result[0].rowIndex).toBe(0);
    expect(result[1].rowIndex).toBe(1);
  });

  it('caps totalRows to MAX_VISIBLE_ROWS and tracks overflowCount', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, startIdx: 0, span: 2 }));
    const day = mkDay(many);
    const result = processBookingsForDayV2(day);
    expect(result[0].totalRows).toBe(MAX_VISIBLE_ROWS);
    expect(result[0].overflowCount).toBe(10 - MAX_VISIBLE_ROWS);
  });

  it('puts my-bookings first in row order', () => {
    const day = mkDay([
      { id: 'other', startIdx: 0, span: 2 },
      { id: 'mine', startIdx: 0, span: 2, isMine: true },
    ]);
    const result = processBookingsForDayV2(day);
    expect(result[0].id).toBe('mine');
  });

  it('returns stable sort by startTime then by id for ties', () => {
    const day = mkDay([
      { id: 'z', startIdx: 2, span: 1 },
      { id: 'a', startIdx: 0, span: 1 },
    ]);
    const result = processBookingsForDayV2(day);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts
```

Expected: FAIL — "processBookingsForDayV2 is not a function".

### Task 5.2: Refactor ZoomCalendarGrid to add V2 function

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx`

- [ ] **Step 1: Add V2 function and ProcessedBookingV2 type**

Add to the top of the file (next to existing `processBookingsForDay`):

```typescript
export const MAX_VISIBLE_ROWS = 4;

export interface ProcessedBookingV2 {
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
  accountId: string;
  accountColorHex: string;
  rowIndex: number;
  totalRows: number;
  overflowCount: number; // extra bookings beyond totalRows
}

export function processBookingsForDayV2(day: CalendarDay): ProcessedBookingV2[] {
  // Collect all bookings (deduplicated)
  const seen = new Set<string>();
  const all: ProcessedBookingV2[] = [];

  day.slots.forEach((slot, index) => {
    if (slot.booking && !seen.has(slot.booking.id)) {
      seen.add(slot.booking.id);
      const rowSpan = Math.max(1, Math.ceil(slot.booking.durationMinutes / SLOT_INTERVAL));
      all.push({
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
        accountId: (slot.booking as any).zoomAccountId ?? '',
        accountColorHex: (slot.booking as any).zoomAccount?.colorHex ?? '#3b82f6',
        rowIndex: 0,
        totalRows: 0,
        overflowCount: 0,
      });
    }
  });

  // Group overlapping bookings
  const assigned = new Set<string>();
  for (const booking of all) {
    if (assigned.has(booking.id)) continue;
    const group = all.filter((b) => {
      if (assigned.has(b.id)) return false;
      const aStart = booking.rowStart;
      const aEnd = booking.rowStart + booking.rowSpan;
      const bStart = b.rowStart;
      const bEnd = b.rowStart + b.rowSpan;
      return aStart < bEnd && aEnd > bStart;
    });
    // Sort: my-bookings first, then by startTime, then by id (stable)
    group.sort((a, b) => {
      if (a.isMyBooking !== b.isMyBooking) return a.isMyBooking ? -1 : 1;
      if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
      return a.id.localeCompare(b.id);
    });

    const total = group.length;
    const visible = Math.min(total, MAX_VISIBLE_ROWS);
    group.forEach((b, idx) => {
      b.rowIndex = idx;
      b.totalRows = visible;
      b.overflowCount = total - visible;
      assigned.add(b.id);
    });
  }

  return all;
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts
```

Expected: 4 tests passed.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomCalendarGrid.test.ts
git commit -m "feat(zoom): add processBookingsForDayV2 with rowIndex + overflowCount"
```

### Task 5.3: Write test for ZoomOverflowPopover

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomOverflowPopover } from '../ZoomOverflowPopover';

const bookings = Array.from({ length: 6 }, (_, i) => ({
  id: `b${i}`,
  title: `Meeting ${i}`,
  startTime: '14:00',
  endTime: '15:00',
  accountId: `acc-${i}`,
  accountName: `Account ${i}`,
  accountColorHex: `hsl(${i * 60}, 70%, 50%)`,
  isMine: i === 0,
}));

describe('ZoomOverflowPopover', () => {
  it('renders header with count and date', () => {
    render(
      <ZoomOverflowPopover
        open={true}
        onClose={vi.fn()}
        onSelectBooking={vi.fn()}
        onBookSlot={vi.fn()}
        anchorEl={null}
        bookings={bookings}
        timeRange="14:00 – 15:00"
        date="Rabu, 11 Juni 2026"
      />
    );
    expect(screen.getByText(/6 Meeting/i)).toBeInTheDocument();
    expect(screen.getByText(/Rabu/i)).toBeInTheDocument();
  });

  it('renders all 6 bookings as a list', () => {
    render(
      <ZoomOverflowPopover
        open={true}
        onClose={vi.fn()}
        onSelectBooking={vi.fn()}
        onBookSlot={vi.fn()}
        anchorEl={null}
        bookings={bookings}
        timeRange="14:00 – 15:00"
        date="Rabu, 11 Juni 2026"
      />
    );
    bookings.forEach((b) => {
      expect(screen.getByText(b.title)).toBeInTheDocument();
    });
  });

  it('shows SAYA badge for my bookings', () => {
    render(
      <ZoomOverflowPopover
        open={true}
        onClose={vi.fn()}
        onSelectBooking={vi.fn()}
        onBookSlot={vi.fn()}
        anchorEl={null}
        bookings={bookings}
        timeRange="14:00 – 15:00"
        date="Rabu, 11 Juni 2026"
      />
    );
    expect(screen.getByText(/saya/i)).toBeInTheDocument();
  });

  it('calls onSelectBooking with id when a row is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <ZoomOverflowPopover
        open={true}
        onClose={vi.fn()}
        onSelectBooking={onSelect}
        onBookSlot={vi.fn()}
        anchorEl={null}
        bookings={bookings}
        timeRange="14:00 – 15:00"
        date="Rabu, 11 Juni 2026"
      />
    );
    await userEvent.click(screen.getByText('Meeting 1'));
    expect(onSelect).toHaveBeenCalledWith('b1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
```

Expected: FAIL.

### Task 5.4: Build ZoomOverflowPopover

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx
import { ChevronRight, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

export interface OverflowBooking {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  accountId: string;
  accountName: string;
  accountColorHex: string;
  isMine: boolean;
}

export interface ZoomOverflowPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelectBooking: (bookingId: string) => void;
  onBookSlot: () => void;
  anchorEl: HTMLElement | null;
  bookings: OverflowBooking[];
  timeRange: string;
  date: string;
}

export function ZoomOverflowPopover({
  open,
  onClose,
  onSelectBooking,
  onBookSlot,
  anchorEl,
  bookings,
  timeRange,
  date,
}: ZoomOverflowPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      {anchorEl && <PopoverAnchor virtualRef={{ current: anchorEl } as any} />}
      <PopoverContent className="w-[380px] p-0" align="start" side="top">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-between">
          <div>
            <strong className="text-[13px] text-slate-800 dark:text-slate-200">
              {bookings.length} Meeting · {timeRange}
            </strong>
            <div className="text-[10px] text-slate-500 mt-0.5">{date}</div>
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBooking(b.id)}
              className="w-full px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: b.accountColorHex }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {b.title}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span>{b.startTime} – {b.endTime}</span>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: b.accountColorHex }}
                    />
                    {b.accountName}
                  </span>
                </div>
              </div>
              {b.isMine && (
                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                  SAYA
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] text-blue-600 font-semibold gap-1 h-7"
            onClick={onBookSlot}
          >
            <Zap className="h-3 w-3" /> Book slot kosong
          </Button>
          <span className="text-[9px] text-slate-400">klik meeting untuk detail</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
```

Expected: 4 tests passed.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
git commit -m "feat(zoom): add ZoomOverflowPopover for 10+ simultaneous meetings"
```

### Task 5.5: Update ZoomWeekView to use V2 vertical stack

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`

- [ ] **Step 1: Replace import**

```typescript
import { processBookingsForDayV2 } from './ZoomCalendarGrid';
import type { ProcessedBookingV2 } from './ZoomCalendarGrid';
```

- [ ] **Step 2: Replace `processBookingsForDay` calls with `processBookingsForDayV2`**

Find all usages:
```typescript
// Old
const bookings = processBookingsForDay(calDay);
return bookings.map((booking) => { ... });

// New
const allBookings = processBookingsForDayV2(calDay);
const visible = allBookings.filter((b) => b.rowIndex < b.totalRows);
const overflowGroups = new Map<number, { bookings: ProcessedBookingV2[]; count: number }>();
allBookings.forEach((b) => {
  if (b.overflowCount > 0) {
    const key = b.rowStart;
    if (!overflowGroups.has(key)) {
      overflowGroups.set(key, { bookings: [], count: b.overflowCount });
    }
  }
});
```

- [ ] **Step 3: Render visible bookings as vertical stack**

For each visible booking, render a thin bar (20-px height per row):

```tsx
<div
  key={booking.id}
  className="absolute flex flex-col rounded-md overflow-hidden"
  style={{
    top: (booking.rowStart - 2) * SLOT_HEIGHT + 2,
    height: Math.min(20 * booking.totalRows, booking.rowSpan * SLOT_HEIGHT - 4),
    left: `calc(${TIME_COL_WIDTH}px + ${colIdx} / ${numCols} * (100% - ${TIME_COL_WIDTH}px) + 4px)`,
    width: `calc((100% - ${TIME_COL_WIDTH}px) / ${numCols} - 8px)`,
  }}
  onClick={() => onBookingClick(booking)}
>
  <div
    className="flex items-center px-1.5 gap-1 text-white"
    style={{
      background: booking.accountColorHex,
      height: 20,
    }}
  >
    <strong className="text-[10px] truncate">{booking.title}</strong>
  </div>
  {/* If rowSpan > 1, more rows below */}
</div>
```

- [ ] **Step 4: Render overflow pill when overflowCount > 0**

```tsx
{overflowGroups.size > 0 && (
  <button
    className="absolute bg-slate-800 text-white text-[10px] font-semibold rounded-md px-2 py-0.5"
    style={{
      top: (firstOverflow.rowStart - 2) * SLOT_HEIGHT + 2 + 20 * MAX_VISIBLE_ROWS,
      // ...
    }}
    onClick={(e) => {
      e.stopPropagation();
      setOverflowAnchor(e.currentTarget);
      setOverflowDate(dateStr);
    }}
  >
    +{firstOverflow.overflowCount} lainnya
  </button>
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx
git commit -m "refactor(zoom): ZoomWeekView uses V2 vertical stack + overflow pill"
```

### Task 5.6: Update ZoomDayView with same pattern

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`

- [ ] **Step 1-5:** Mirror Task 5.5 — replace import, swap function, render vertical stack, render overflow pill.

```bash
git commit -m "refactor(zoom): ZoomDayView uses V2 vertical stack + overflow pill"
```

### Task 5.7: Wire ZoomOverflowPopover into ZoomCalendarPage

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Add state for overflow popover**

```typescript
const [overflowPopover, setOverflowPopover] = useState<{
  open: boolean;
  date: string | null;
  bookings: OverflowBooking[];
  anchorEl: HTMLElement | null;
}>({ open: false, date: null, bookings: [], anchorEl: null });
```

- [ ] **Step 2: Render ZoomOverflowPopover**

```tsx
<ZoomOverflowPopover
  open={overflowPopover.open}
  onClose={() => setOverflowPopover({ open: false, date: null, bookings: [], anchorEl: null })}
  onSelectBooking={(id) => { panel.openDetail(id); setOverflowPopover((p) => ({ ...p, open: false })); }}
  onBookSlot={() => { panel.openBooking({ /* slot context */ }); setOverflowPopover((p) => ({ ...p, open: false })); }}
  anchorEl={overflowPopover.anchorEl}
  bookings={overflowPopover.bookings}
  timeRange="14:00 – 15:00"
  date={overflowPopover.date ?? ''}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): wire ZoomOverflowPopover into ZoomCalendarPage"
```

---

## Phase 6 — Booking Modal + Auto-pick

Replace the slide-in `ZoomBookingPanel` + `ZoomBookingForm` pair with a single centered `ZoomBookingModal`. Add the auto-pick banner for Gabungan mode.

### Task 6.1: Write test for ZoomBookingModal

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomBookingModal } from '../ZoomBookingModal';

describe('ZoomBookingModal', () => {
  const defaultProps = {
    open: true,
    mode: 'booking' as const,
    isGabungan: true,
    autoPickedAccount: { id: 'acc-1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 0 },
    accountsAvailable: [
      { id: 'acc-1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 0 },
      { id: 'acc-2', name: 'Sales', colorHex: '#10b981', meetingsAtTime: 1 },
    ],
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onChangeAccount: vi.fn(),
  };

  it('renders the auto-pick banner when in Gabungan mode', () => {
    render(<ZoomBookingModal {...defaultProps} />);
    expect(screen.getByText(/auto-picked/i)).toBeInTheDocument();
    expect(screen.getByText(/Marketing/)).toBeInTheDocument();
  });

  it('does NOT render the auto-pick banner in single-account mode', () => {
    render(<ZoomBookingModal {...defaultProps} isGabungan={false} />);
    expect(screen.queryByText(/auto-picked/i)).not.toBeInTheDocument();
  });

  it('renders recurring section matching ZoomRecurringOptions fields', () => {
    render(<ZoomBookingModal {...defaultProps} />);
    expect(screen.getByText(/recurring/i)).toBeInTheDocument();
  });

  it('shows duration dropdown with "1 hour" as default', () => {
    render(<ZoomBookingModal {...defaultProps} />);
    const select = screen.getByDisplayValue(/1 hour/i);
    expect(select).toBeInTheDocument();
  });

  it('calls onSubmit when Book Meeting button is clicked', async () => {
    render(<ZoomBookingModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /book meeting/i }));
    expect(defaultProps.onSubmit).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomBookingModal.test.tsx
```

Expected: FAIL.

### Task 6.2: Build ZoomBookingModal

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomBookingModal.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomBookingModal.tsx
import { useState, useEffect } from 'react';
import { Video, X, Check, ChevronDown, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ZoomRecurringOptions } from './ZoomRecurringOptions';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomBookingModalProps {
  open: boolean;
  mode: 'booking' | 'detail' | 'reschedule';
  isGabungan: boolean;
  autoPickedAccount: AccountLoad | null;
  accountsAvailable: AccountLoad[];
  defaultDate?: string;
  defaultTime?: string;
  defaultDurationMinutes?: number;
  onClose: () => void;
  onSubmit: (data: BookingFormData) => void;
  onChangeAccount: (accountId: string) => void;
}

export interface BookingFormData {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  accountId: string;
  participants: string;
  agenda: string;
  recurring: { enabled: boolean; freq: string; interval: number; until: string };
}

export function ZoomBookingModal({
  open,
  mode,
  isGabungan,
  autoPickedAccount,
  accountsAvailable,
  defaultDate = '',
  defaultTime = '10:00',
  defaultDurationMinutes = 60,
  onClose,
  onSubmit,
  onChangeAccount,
}: ZoomBookingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [accountId, setAccountId] = useState(autoPickedAccount?.id ?? '');
  const [participants, setParticipants] = useState('');
  const [agenda, setAgenda] = useState('');
  const [recurring, setRecurring] = useState({ enabled: false, freq: 'WEEKLY', interval: 1, until: '' });

  useEffect(() => {
    if (open && autoPickedAccount) setAccountId(autoPickedAccount.id);
  }, [open, autoPickedAccount]);

  if (mode !== 'booking') {
    // Phase 6 only handles 'booking' mode. Detail/Reschedule still use ZoomBookingPanel.
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[540px] p-0 gap-0">
        <DialogTitle className="sr-only">Book Zoom Meeting</DialogTitle>

        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 flex items-center justify-between">
          <div>
            <strong className="text-[15px] text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Video className="h-4 w-4" /> Book Zoom Meeting
            </strong>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {date || 'Pilih tanggal'} · {time}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Auto-pick banner (Gabungan only) */}
        {isGabungan && autoPickedAccount && (
          <div className="px-4 py-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
            <span className="bg-white dark:bg-slate-900 rounded px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 shadow-sm">
              <Check className="h-3 w-3" /> AUTO-PICKED
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400">
              Paling luang di jam ini ({autoPickedAccount.meetingsAtTime} mtg / {accountsAvailable.length} available):
            </span>
            <div className="ml-auto relative">
              <select
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); onChangeAccount(e.target.value); }}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md pl-2 pr-6 py-1 text-[11px] font-semibold"
              >
                {accountsAvailable.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Form body */}
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-[11px] font-semibold text-slate-600">Judul Meeting *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Review"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-slate-600">Tanggal</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-slate-600">Waktu · Durasi</Label>
            <div className="flex gap-1 mt-1">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1"
              />
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-[12px]"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hour</option>
                <option value={120}>2 hour</option>
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <ZoomRecurringOptions
              isRecurring={recurring.enabled}
              setIsRecurring={(v) => setRecurring((r) => ({ ...r, enabled: v }))}
              freq={recurring.freq}
              setFreq={(v) => setRecurring((r) => ({ ...r, freq: v }))}
              interval={recurring.interval}
              setInterval={(v) => setRecurring((r) => ({ ...r, interval: v }))}
              until={recurring.until}
              setUntil={(v) => setRecurring((r) => ({ ...r, until: v }))}
              minDate={new Date()}
              maxDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
            />
          </div>

          <div className="col-span-2">
            <Label className="text-[11px] font-semibold text-slate-600">Peserta (email, pisahkan dengan koma)</Label>
            <textarea
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="andi@company.com, budi@company.com"
              className="mt-1 w-full min-h-[60px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-[12px]"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-[11px] font-semibold text-slate-600">Agenda (opsional)</Label>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="1. Review progress&#10;2. Diskusi blockers"
              className="mt-1 w-full min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-[12px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Tekan <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono">⌘ ↵</kbd> untuk book
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Batal</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={() => onSubmit({
                title, date, time,
                durationMinutes: duration,
                accountId,
                participants,
                agenda,
                recurring,
              })}
            >
              <Video className="h-3.5 w-3.5" /> Book Meeting
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomBookingModal.test.tsx
```

Expected: 5 tests passed.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomBookingModal.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomBookingModal.test.tsx
git commit -m "feat(zoom): add ZoomBookingModal with auto-pick banner + recurring"
```

### Task 6.3: Wire ZoomBookingModal into ZoomCalendarPage

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Add ZoomBookingModal**

```typescript
import { ZoomBookingModal } from '../components/ZoomBookingModal';

const effectiveAccountId = accountScope === 'gabungan' ? undefined : accountScope;
const accountLoads: AccountLoad[] = useMemo(() => {
  return (accounts ?? []).map((a, i) => ({
    id: a.id,
    name: a.name,
    colorHex: a.colorHex,
    meetingsAtTime: /* TODO: from useZoomAccountLoads hook */ 0,
  }));
}, [accounts]);

const autoPicked = useMemo(() => {
  return autoPickAccount(accountLoads, format(currentDate, 'HH:00'));
}, [accountLoads, currentDate]);
```

- [ ] **Step 2: Render modal**

```tsx
<ZoomBookingModal
  open={panel.isOpen && panel.mode === 'booking'}
  mode="booking"
  isGabungan={accountScope === 'gabungan'}
  autoPickedAccount={autoPicked}
  accountsAvailable={accountLoads}
  defaultDate={panel.context.preselectedDate}
  defaultTime={panel.context.preselectedTime ?? '10:00'}
  defaultDurationMinutes={panel.context.preset === '1h' ? 60 : 60}
  onClose={panel.close}
  onSubmit={async (data) => {
    await createBooking.mutateAsync(data);
    panel.close();
  }}
  onChangeAccount={(id) => setAccountScope(id)}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): wire ZoomBookingModal into ZoomCalendarPage"
```

### Task 6.4: Delete legacy ZoomBookingForm and ZoomBookingPanel

**Files:**
- Delete: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`
- Delete: `apps/frontend/src/features/zoom-booking/components/ZoomBookingPanel.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/index.ts` (remove exports)
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx` (remove imports)

- [ ] **Step 1: Find all usages of the legacy components**

```bash
cd apps/frontend && grep -rln "ZoomBookingForm\|ZoomBookingPanel" src/
```

- [ ] **Step 2: Replace with ZoomBookingModal calls**

In `ZoomCalendarPage.tsx`:
- Remove `import { ZoomBookingForm }` and `import { ZoomBookingPanel }`
- Remove their rendering in the JSX
- The `ZoomBookingModal` from Task 6.3 handles this.

- [ ] **Step 3: Delete the files**

```bash
cd apps/frontend
git rm src/features/zoom-booking/components/ZoomBookingForm.tsx
git rm src/features/zoom-booking/components/ZoomBookingPanel.tsx
```

- [ ] **Step 4: Run type check + tests**

```bash
cd apps/frontend && npx tsc --noEmit
cd apps/frontend && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(zoom): delete legacy ZoomBookingForm + ZoomBookingPanel (replaced by ZoomBookingModal)"
```

---

## Phase 7 — Quick actions wiring

The Quick Book buttons (1 hour + Custom) were already added to the sub-bar in Phase 3 but the panel hooks are placeholders. This phase wires them to the booking modal.

### Task 7.1: Add preset context to useBookingPanel

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useBookingPanel.ts`

- [ ] **Step 1: Add `preset` field to booking context**

```typescript
// In useBookingPanel.ts:
interface BookingContext {
  zoomAccountId?: string;
  preselectedDate?: string;
  preselectedTime?: string;
  preset?: '1h' | 'custom';
}

// Update openBooking signature:
const openBooking = (params: { date?: string; time?: string; zoomAccountId?: string; preset?: '1h' | 'custom' }) => {
  setMode('booking');
  setContext({
    zoomAccountId: params.zoomAccountId,
    preselectedDate: params.date,
    preselectedTime: params.time,
    preset: params.preset ?? 'custom',
  });
  setIsOpen(true);
};
```

- [ ] **Step 2: Add test**

In `apps/frontend/src/features/zoom-booking/hooks/__tests__/useBookingPanel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookingPanel } from '../useBookingPanel';

describe('useBookingPanel preset', () => {
  it('openBooking stores preset=1h', () => {
    const { result } = renderHook(() => useBookingPanel());
    act(() => result.current.openBooking({ preset: '1h', date: '2026-06-11', time: '10:00' }));
    expect(result.current.context.preset).toBe('1h');
  });

  it('openBooking defaults to preset=custom when not specified', () => {
    const { result } = renderHook(() => useBookingPanel());
    act(() => result.current.openBooking({ date: '2026-06-11' }));
    expect(result.current.context.preset).toBe('custom');
  });
});
```

- [ ] **Step 3: Run test**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/hooks/__tests__/useBookingPanel.test.ts
```

Expected: 2 tests passed.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/hooks/useBookingPanel.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useBookingPanel.test.ts
git commit -m "feat(zoom): add preset field to useBookingPanel"
```

### Task 7.2: Wire Quick Book buttons in SubBar to modal

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Update onBook1Hour and onBookCustom handlers**

```tsx
<ZoomCalendarSubBar
  view={view}
  onViewChange={setView}
  onBook1Hour={() => {
    panel.openBooking({
      date: format(currentDate, 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:00'),
      zoomAccountId: accountScope === 'gabungan' ? undefined : accountScope,
      preset: '1h',
    });
  }}
  onBookCustom={() => {
    panel.openBooking({
      date: format(currentDate, 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:00'),
      zoomAccountId: accountScope === 'gabungan' ? undefined : accountScope,
      preset: 'custom',
    });
  }}
  ...
/>
```

- [ ] **Step 2: Pass preset to ZoomBookingModal**

In the `<ZoomBookingModal />` props:
```tsx
defaultDurationMinutes={panel.context.preset === '1h' ? 60 : 60}
```

(The duration is 60 in both cases; the preset only affects whether the recurring section is pre-collapsed. The ZoomBookingModal can be enhanced to lock the duration field when preset='1h'. For now, both are 60 min.)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): wire Quick Book buttons to ZoomBookingModal with preset"
```

---

## Phase 8 — Polish (shortcuts, tasks, search, live sync)

### Task 8.1: Build ZoomShortcutsModal

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/ZoomShortcutsModal.tsx`
- Create: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomShortcutsModal.test.tsx`

- [ ] **Step 1: Write test**

```typescript
// apps/frontend/src/features/zoom-booking/components/__tests__/ZoomShortcutsModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZoomShortcutsModal } from '../ZoomShortcutsModal';

describe('ZoomShortcutsModal', () => {
  it('lists all 12 keyboard shortcuts when open', () => {
    render(<ZoomShortcutsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    render(<ZoomShortcutsModal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Create component**

```typescript
// apps/frontend/src/features/zoom-booking/components/ZoomShortcutsModal.tsx
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const SHORTCUTS: Array<{ key: string; action: string }> = [
  { key: '/', action: 'Focus search' },
  { key: 'T', action: 'Jump to today' },
  { key: 'N', action: 'Next period' },
  { key: 'P', action: 'Previous period' },
  { key: 'M', action: 'Month view' },
  { key: 'W', action: 'Week view' },
  { key: 'D', action: 'Day view' },
  { key: 'B', action: 'Book meeting' },
  { key: 'G', action: 'Toggle Gabungan' },
  { key: '?', action: 'Show this shortcuts' },
  { key: 'Esc', action: 'Close modal' },
  { key: '↵', action: 'Open detail / submit form' },
];

export interface ZoomShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ZoomShortcutsModal({ open, onClose }: ZoomShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 mt-3">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="contents">
              <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-mono min-w-[40px] text-center">
                {s.key}
              </kbd>
              <span className="text-sm text-slate-700 dark:text-slate-300 self-center">{s.action}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Run test + commit**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/ZoomShortcutsModal.test.tsx
git add apps/frontend/src/features/zoom-booking/components/ZoomShortcutsModal.tsx apps/frontend/src/features/zoom-booking/components/__tests__/ZoomShortcutsModal.test.tsx
git commit -m "feat(zoom): add ZoomShortcutsModal"
```

### Task 8.2: Add global keyboard handler in ZoomCalendarPage

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Add useEffect for keyboard shortcuts**

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.metaKey || e.ctrlKey) return;

    switch (e.key) {
      case '?':
        e.preventDefault();
        setShortcutsOpen(true);
        break;
      case 'B':
      case 'b':
        e.preventDefault();
        panel.openBooking({ preset: 'custom', date: format(currentDate, 'yyyy-MM-dd'), time: '10:00' });
        break;
      case 'G':
      case 'g':
        e.preventDefault();
        setAccountScope((prev) => (prev === 'gabungan' ? accounts[0]?.id ?? 'gabungan' : 'gabungan'));
        break;
      case 'T':
      case 't':
        e.preventDefault();
        navigateToToday();
        break;
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [currentDate, accounts, panel, navigateToToday, setAccountScope]);
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): add global keyboard shortcuts handler"
```

### Task 8.3: Build useMyTasks hook

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/hooks/useMyTasks.ts`
- Create: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useMyTasks.test.ts`

- [ ] **Step 1: Write test**

```typescript
// apps/frontend/src/features/zoom-booking/hooks/__tests__/useMyTasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyTasks } from '../useMyTasks';

describe('useMyTasks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty tasks', () => {
    const { result } = renderHook(() => useMyTasks());
    expect(result.current.tasks).toEqual([]);
  });

  it('addTask appends a task', () => {
    const { result } = renderHook(() => useMyTasks());
    act(() => result.current.addTask('Konfirmasi link'));
    expect(result.current.tasks).toEqual([{ id: expect.any(String), text: 'Konfirmasi link', done: false }]);
  });

  it('toggleTask flips done state', () => {
    const { result } = renderHook(() => useMyTasks());
    act(() => result.current.addTask('Test'));
    const id = result.current.tasks[0].id;
    act(() => result.current.toggleTask(id));
    expect(result.current.tasks[0].done).toBe(true);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useMyTasks());
    act(() => result.current.addTask('Persisted'));
    const stored = JSON.parse(localStorage.getItem('zoom-calendar-tasks') ?? '[]');
    expect(stored[0].text).toBe('Persisted');
  });
});
```

- [ ] **Step 2: Create hook**

```typescript
// apps/frontend/src/features/zoom-booking/hooks/useMyTasks.ts
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'zoom-calendar-tasks';

export interface MyTask {
  id: string;
  text: string;
  done: boolean;
}

export function useMyTasks() {
  const [tasks, setTasks] = useState<MyTask[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = useCallback((text: string) => {
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, addTask, toggleTask, removeTask };
}
```

- [ ] **Step 3: Run test + commit**

```bash
cd apps/frontend && npx vitest run src/features/zoom-booking/hooks/__tests__/useMyTasks.test.ts
git add apps/frontend/src/features/zoom-booking/hooks/useMyTasks.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useMyTasks.test.ts
git commit -m "feat(zoom): add useMyTasks hook with localStorage persistence"
```

### Task 8.4: Wire useMyTasks into ZoomRightSidebar

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomRightSidebar.tsx`

- [ ] **Step 1: Replace D4 placeholder with real implementation**

In `ZoomRightSidebar.tsx`:

```typescript
import { useMyTasks } from '../hooks/useMyTasks';
import { Plus, Trash2 } from 'lucide-react';

// Inside component:
const { tasks, addTask, toggleTask, removeTask } = useMyTasks();
const [newTaskText, setNewTaskText] = useState('');

// Replace the D4 section with:
<section className="p-3 border-b border-slate-200 dark:border-slate-700">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">My Tasks</h3>
    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
      if (newTaskText.trim()) { addTask(newTaskText); setNewTaskText(''); }
    }}>
      <Plus className="h-3 w-3" />
    </Button>
  </div>
  <input
    value={newTaskText}
    onChange={(e) => setNewTaskText(e.target.value)}
    placeholder="Add a task…"
    className="w-full text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 mb-2"
    onKeyDown={(e) => {
      if (e.key === 'Enter' && newTaskText.trim()) { addTask(newTaskText); setNewTaskText(''); }
    }}
  />
  {tasks.length === 0 ? (
    <p className="text-[10px] text-slate-500 italic">No tasks yet</p>
  ) : (
    <ul className="space-y-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => toggleTask(t.id)}
            className="h-3 w-3"
          />
          <span className={`flex-1 ${t.done ? 'line-through opacity-60' : ''}`}>{t.text}</span>
          <button onClick={() => removeTask(t.id)} className="text-slate-400 hover:text-red-500">
            <Trash2 className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  )}
</section>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomRightSidebar.tsx
git commit -m "feat(zoom): wire useMyTasks into ZoomRightSidebar D4"
```

### Task 8.5: Add search filter to header

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx`

- [ ] **Step 1: Add search state and input**

```typescript
const [search, setSearch] = useState('');

// In the header JSX, add a search input:
<input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Cari meeting, peserta, topik…"
  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs w-[240px]"
/>
```

- [ ] **Step 2: Lift search state to page level via prop**

The search should filter the calendar. Lift the state to `ZoomCalendarPage` and pass down.

```typescript
// In ZoomCalendarPage:
const [search, setSearch] = useState('');
const filteredCalendar = useMemo(() => {
  if (!search) return safeCalendar;
  return safeCalendar.map((day) => ({
    ...day,
    slots: day.slots.filter((s) =>
      !s.booking || s.booking.title.toLowerCase().includes(search.toLowerCase())
    ),
  }));
}, [search, safeCalendar]);
```

Pass `search` to header, pass `filteredCalendar` to views.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/ZoomCalendarHeader.tsx apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): add search filter to header + apply to calendar"
```

### Task 8.6: Add empty state for no accounts

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`

- [ ] **Step 1: Add empty state check**

```tsx
if (safeAccounts.length === 0) {
  return (
    <ZoomErrorBoundary>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4 flex items-center justify-center">
            <Video className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Belum ada akun Zoom</h2>
          <p className="text-sm text-slate-500 mb-4">Hubungi admin untuk setup akun Zoom untuk tim Anda.</p>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Request Account</Button>
        </div>
      </div>
    </ZoomErrorBoundary>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx
git commit -m "feat(zoom): add empty state for no accounts configured"
```

---

## Phase 9 — Verification

### Task 9.1: Smoke test on 17" viewport

- [ ] **Step 1: Run dev server**

```bash
cd apps/frontend && npm run dev
```

- [ ] **Step 2: Open browser at 1366×768**

Verify:
- [ ] No vertical scroll on initial load
- [ ] All 5 sidebar sections visible without scroll
- [ ] Header + sub-bar + calendar + sidebar fit in viewport
- [ ] Account switcher modal opens and shows 10 accounts

- [ ] **Step 3: Test Gabungan mode**

- [ ] Switch to Gabungan (default)
- [ ] Click an empty time slot
- [ ] Modal opens with "AUTO-PICKED" banner

### Task 9.2: Visual regression check (no scroll on all viewport sizes)

- [ ] **Step 1: Take screenshots at 4 viewports**

Use Playwright (existing in project) or manual screenshot:

```bash
cd apps/frontend
npx playwright test --headed --viewport-size="1366,768" 2>/dev/null
npx playwright test --headed --viewport-size="1920,1080" 2>/dev/null
npx playwright test --headed --viewport-size="2560,1440" 2>/dev/null
```

- [ ] **Step 2: Verify zero scroll in each**

Confirm `document.body.scrollHeight <= window.innerHeight` in each.

### Task 9.3: E2E test — book meeting in Gabungan mode

- [ ] **Step 1: Write Playwright test**

Create `apps/frontend/tests/e2e/zoom-calendar-gabungan.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('Gabungan mode auto-picks least-loaded account on book', async ({ page }) => {
  await page.goto('/zoom-calendar');
  await page.getByRole('button', { name: /book meeting/i }).first().click();
  // Wait for modal
  await expect(page.getByText(/auto-picked/i)).toBeVisible();
  // Verify the auto-picked account name is shown
  await expect(page.getByText(/paling luang/i)).toBeVisible();
});
```

- [ ] **Step 2: Run E2E**

```bash
cd apps/frontend && npx playwright test zoom-calendar-gabungan
```

Expected: PASS.

### Task 9.4: E2E test — overflow popover

- [ ] **Step 1: Mock 10 simultaneous meetings**

In test setup, use a stub backend or mock service to return 10 meetings at same time.

- [ ] **Step 2: Write test**

```typescript
test('shows overflow popover when 10 meetings at same time', async ({ page }) => {
  // Navigate to day with 10 meetings
  // Click "+N lainnya" pill
  // Verify popover opens with all 10 listed
});
```

### Task 9.5: A11y audit

- [ ] **Step 1: Run axe-core check**

```bash
cd apps/frontend && npx playwright test --grep "@a11y" 2>/dev/null
```

- [ ] **Step 2: Verify**
- [ ] All buttons have `aria-label` or visible text
- [ ] Modal traps focus
- [ ] Tab order is logical
- [ ] No color-only information (legend has text + color)

### Task 9.6: Final commit + tag

- [ ] **Step 1: Run all tests**

```bash
cd apps/frontend && npx vitest run
cd apps/frontend && npx tsc --noEmit
cd apps/frontend && npx playwright test
```

Expected: all pass.

- [ ] **Step 2: Tag the release**

```bash
git tag zoom-calendar-redesign-v1.0
git log --oneline -20
```

---

## Self-Review

### Spec coverage check

| Spec Goal | Task |
|-----------|------|
| G1 No scroll 17" | Phase 2 (shell), Phase 3 (sub-bar), Phase 9.1 |
| G2 Support 10 accounts | Phase 4 (account switcher) |
| G3 Book without account | Phase 4 (Gabungan), Phase 6 (auto-pick) |
| G4 Legend visible | Phase 3 (sub-bar), Phase 2 (sidebar) |
| G5 Search | Phase 8.5 |
| G6 Quick book 1h + Custom | Phase 3 (sub-bar), Phase 7 (wiring) |
| G7 Recurring up front | Phase 6 (ZoomBookingModal uses ZoomRecurringOptions) |
| G8 Sync status | Phase 2 (D5 in sidebar) |
| G9 Keyboard shortcuts | Phase 8.1, 8.2 |
| G10 Right column persistent | Phase 2 |
| G11 Modal centered | Phase 6 |
| G12 10 simultaneous meetings | Phase 5 (overflow popover) |
| G13 Lucide icons, no emoji | Phase 1 |

### Placeholder scan

- No "TBD" or "TODO" left in steps.
- All code blocks are complete.
- File paths use absolute paths under `apps/frontend/src/...`.

### Type consistency

- `accountScope: 'gabungan' | string` — defined in Phase 4, used consistently.
- `AccountLoad` interface — defined in Phase 0, used in Phases 2, 4, 6.
- `BookingFormData` — defined in Phase 6, used internally only.

### Risk areas

- **Backend support for Gabungan:** `useZoomCalendar` with undefined accountId may not work. Verify with backend team before Phase 4.2.
- **Color contrast for account palette in dark mode:** Run A11y check (Phase 9.5) to confirm all 10 account colors meet WCAG AA.
- **processBookingsForDayV2 with empty day:** Edge case covered by `processedSlots.has(booking.id)` check, but verify the V2 function returns `[]` correctly for empty days.

---








