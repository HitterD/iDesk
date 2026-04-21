# Hardware Requests Overhaul — Plan 3: Layout Merge + UI Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gabungkan List / Dashboard / Calendar di bawah layout `/hardware-requests` dengan tabs sticky, expandable row di list, sidebar cleanup, dan konsistensi UI/animasi dengan dashboard+tickets existing.

**Architecture:** Layout wrapper (`HardwareRequestsLayout`) + komponen `<HardwareRequestsTabs>` dipakai sebagai outlet untuk sub-route list/dashboard/calendar. `RequestTable`/`RequestCard` menambah row expandable (local state, AnimatePresence). Lazy-load per view pakai `React.lazy`. Sidebar entries duplikat dihapus. Semua animasi via framer-motion dengan `useReducedMotion` guard. Token warna semantic, tidak ada hardcoded hex.

**Tech Stack:** React 18, React Router v6 (nested routes + `<Outlet>`), framer-motion (`layoutId`, `AnimatePresence`, `useReducedMotion`), Tailwind, Radix (dialog), Vitest + React Testing Library, Playwright (E2E), sonner.

**Spec:** `docs/superpowers/specs/2026-04-19-hardware-requests-workflow-overhaul-design.md` — Section 6, 11; tests Sub-spec 3 Section 13; files Sub-spec 3 Section 15.
**Depends on:** Plan 1 (backend) merged, Plan 2 (frontend workflow) merged.

**Test commands:**
```bash
# Unit + component
pnpm --filter frontend test -- --no-threads

# Type check
pnpm --filter frontend typecheck

# E2E
pnpm --filter frontend test:e2e
```

---

## File Structure Overview

**New files:**
- `apps/frontend/src/features/hardware-request/layouts/HardwareRequestsLayout.tsx` — outlet wrapper + tabs + breadcrumb slot
- `apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx` — sticky tab bar
- `apps/frontend/src/features/hardware-request/components/common/HardwareRequestsBreadcrumb.tsx` — detail page breadcrumb
- `apps/frontend/src/features/hardware-request/hooks/useHardwareRequestsCount.ts` — open count badge
- `apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx` — panel items per-row
- `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsBreadcrumb.test.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/RequestTableExpand.test.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx`
- `apps/frontend/tests/e2e/hardware-requests-layout.spec.ts`

**Modified files:**
- `apps/frontend/src/routes/AppRoutes.tsx` — nested routes tiga portal
- `apps/frontend/src/components/layout/BentoSidebar.tsx` — hapus entry HR Calendar & HR Dashboard
- `apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx` — masuk outlet (tab content mode) + expandable row
- `apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx` — masuk outlet (tab content mode)
- `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx` — masuk outlet (tab content mode)
- `apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx` — chevron expand column
- `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx` — chevron expand footer
- `apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx` — breadcrumb slot
- `apps/frontend/src/features/hardware-request/routes.tsx` — (obsolete, hapus jika tidak dipakai, atau sinkronkan)

---

## Task 1: Scaffolding — HardwareRequestsLayout (skeleton)

**Files:**
- Create: `apps/frontend/src/features/hardware-request/layouts/HardwareRequestsLayout.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HardwareRequestsLayout } from '../../layouts/HardwareRequestsLayout';

describe('HardwareRequestsLayout', () => {
  it('renders outlet child and tab bar', () => {
    render(
      <MemoryRouter initialEntries={['/hardware-requests']}>
        <Routes>
          <Route path="/hardware-requests" element={<HardwareRequestsLayout />}>
            <Route index element={<div>LIST_CHILD</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('LIST_CHILD')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hardware requests/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /hardware requests tabs/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter frontend test -- HardwareRequestsLayout.test --no-threads`
Expected: FAIL with "Cannot find module '../../layouts/HardwareRequestsLayout'".

- [ ] **Step 3: Implement layout skeleton**

```typescript
// apps/frontend/src/features/hardware-request/layouts/HardwareRequestsLayout.tsx
import { Outlet } from 'react-router-dom';
import { HardwareRequestsTabs } from '../components/common/HardwareRequestsTabs';

export function HardwareRequestsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hardware Requests
        </h1>
        <p className="text-sm text-slate-500">
          Kelola permintaan hardware, jadwal instalasi, dan monitoring pengiriman.
        </p>
      </header>
      <HardwareRequestsTabs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create tabs stub (tests require it to render nav)**

```typescript
// apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx
export function HardwareRequestsTabs() {
  return (
    <nav aria-label="Hardware Requests tabs" className="flex gap-2">
      {/* filled in Task 2 */}
    </nav>
  );
}
```

- [ ] **Step 5: Run test — should pass**

Run: `pnpm --filter frontend test -- HardwareRequestsLayout.test --no-threads`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/layouts/HardwareRequestsLayout.tsx \
        apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx
git commit -m "feat(hw-requests): add HardwareRequestsLayout skeleton with tabs outlet"
```

---

## Task 2: HardwareRequestsTabs — active state + routing

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HardwareRequestsTabs } from '../common/HardwareRequestsTabs';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HardwareRequestsTabs />
    </MemoryRouter>
  );
}

describe('HardwareRequestsTabs', () => {
  it('renders three tabs', () => {
    renderAt('/hardware-requests');
    expect(screen.getByRole('link', { name: /permintaan/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /kalender/i })).toBeInTheDocument();
  });

  it('marks Permintaan active on /hardware-requests', () => {
    renderAt('/hardware-requests');
    const link = screen.getByRole('link', { name: /permintaan/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Dashboard active on /hardware-requests/dashboard', () => {
    renderAt('/hardware-requests/dashboard');
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Kalender active on /hardware-requests/calendar', () => {
    renderAt('/hardware-requests/calendar');
    const link = screen.getByRole('link', { name: /kalender/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Permintaan active on deep routes like /hardware-requests/:id', () => {
    renderAt('/hardware-requests/abc-123');
    const link = screen.getByRole('link', { name: /permintaan/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter frontend test -- HardwareRequestsTabs.test --no-threads`
Expected: FAIL with "Unable to find role='link'".

- [ ] **Step 3: Implement tabs with sticky style + layoutId underline**

```typescript
// apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { useHardwareRequestsCount } from '../../hooks/useHardwareRequestsCount';

interface TabDef {
  to: string;
  label: string;
  end: boolean;
  showBadge?: boolean;
}

const TABS: TabDef[] = [
  { to: '.', label: 'Permintaan', end: false, showBadge: true },
  { to: 'dashboard', label: 'Dashboard', end: true },
  { to: 'calendar', label: 'Kalender', end: true },
];

export function HardwareRequestsTabs() {
  const reduce = useReducedMotion();
  const { openCount } = useHardwareRequestsCount();

  return (
    <nav
      aria-label="Hardware Requests tabs"
      className="sticky top-0 z-10 -mx-4 px-4 py-2 backdrop-blur bg-white/70 border-b border-slate-200"
    >
      <ul className="flex items-center gap-1">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <TabLink tab={tab} reduce={reduce ?? false} openCount={openCount} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ tab, reduce, openCount }: { tab: TabDef; reduce: boolean; openCount: number }) {
  const resolved = useResolvedPath(tab.to);
  const match = useMatch({ path: resolved.pathname, end: tab.end });
  const active = Boolean(match);

  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      aria-current={active ? 'page' : undefined}
      className={[
        'relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900',
      ].join(' ')}
    >
      <span>{tab.label}</span>
      {tab.showBadge && openCount > 0 && (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
          {openCount}
        </span>
      )}
      {active && (
        <m.span
          layoutId="hr-tab-underline"
          className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-slate-900"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </NavLink>
  );
}
```

- [ ] **Step 4: Implement open-count hook**

```typescript
// apps/frontend/src/features/hardware-request/hooks/useHardwareRequestsCount.ts
import { useQuery } from '@tanstack/react-query';
import { listHardwareRequests } from '../api/hardware-request.api';

const OPEN_STATUSES = [
  'SUBMITTED', 'REVIEW', 'APPROVED', 'PROCUREMENT',
  'AWAITING_DELIVERY', 'INSTALLATION',
] as const;

export function useHardwareRequestsCount() {
  const query = useQuery({
    queryKey: ['hardware-requests', 'open-count'],
    queryFn: () => listHardwareRequests({ status: OPEN_STATUSES as unknown as string[], limit: 1 }),
    staleTime: 30_000,
  });
  const openCount = query.data?.meta?.total ?? 0;
  return { openCount, isLoading: query.isLoading };
}
```

> **Note:** If `listHardwareRequests` signature differs, read `apps/frontend/src/features/hardware-request/api/hardware-request.api.ts` first and adapt. The contract: returns `{ data, meta: { total } }`. If response lacks `meta.total`, fallback to `query.data?.length ?? 0`.

- [ ] **Step 5: Run test — should pass**

Run: `pnpm --filter frontend test -- HardwareRequestsTabs.test --no-threads`
Expected: PASS (mock the hook if it hits network — add `vi.mock('../../hooks/useHardwareRequestsCount', () => ({ useHardwareRequestsCount: () => ({ openCount: 0, isLoading: false }) }))` at top of test if needed, then re-run).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx \
        apps/frontend/src/features/hardware-request/hooks/useHardwareRequestsCount.ts \
        apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx
git commit -m "feat(hw-requests): tabs with sticky + layoutId underline + open badge"
```

---

## Task 3: Breadcrumb component for Detail page

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/common/HardwareRequestsBreadcrumb.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsBreadcrumb.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsBreadcrumb.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HardwareRequestsBreadcrumb } from '../common/HardwareRequestsBreadcrumb';

describe('HardwareRequestsBreadcrumb', () => {
  it('renders path Hardware Requests / Permintaan / #HR-1234', () => {
    render(
      <MemoryRouter>
        <HardwareRequestsBreadcrumb currentLabel="#HR-1234" />
      </MemoryRouter>
    );
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toHaveTextContent(/hardware requests/i);
    expect(nav).toHaveTextContent(/permintaan/i);
    expect(nav).toHaveTextContent('#HR-1234');
  });

  it('root link points to /hardware-requests', () => {
    render(
      <MemoryRouter>
        <HardwareRequestsBreadcrumb currentLabel="#HR-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /hardware requests/i })).toHaveAttribute('href', '/hardware-requests');
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter frontend test -- HardwareRequestsBreadcrumb.test --no-threads`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```typescript
// apps/frontend/src/features/hardware-request/components/common/HardwareRequestsBreadcrumb.tsx
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Props {
  currentLabel: string;
}

export function HardwareRequestsBreadcrumb({ currentLabel }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
      <Link to="/hardware-requests" className="hover:text-slate-900">Hardware Requests</Link>
      <ChevronRight className="h-4 w-4" aria-hidden />
      <Link to="/hardware-requests" className="hover:text-slate-900">Permintaan</Link>
      <ChevronRight className="h-4 w-4" aria-hidden />
      <span className="font-medium text-slate-900">{currentLabel}</span>
    </nav>
  );
}
```

- [ ] **Step 4: Run test — should pass**

Run: `pnpm --filter frontend test -- HardwareRequestsBreadcrumb.test --no-threads`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/common/HardwareRequestsBreadcrumb.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsBreadcrumb.test.tsx
git commit -m "feat(hw-requests): add breadcrumb component for detail page"
```

---

## Task 4: Refactor AppRoutes — nested routes under layout

**Files:**
- Modify: `apps/frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Read current AppRoutes**

Run: `cat apps/frontend/src/routes/AppRoutes.tsx | sed -n '60,75p;180,200p;225,245p;260,280p'`
Confirm the 3 portals (Admin/Agent, Manager, Client) each declare flat `hardware-requests/*` routes.

- [ ] **Step 2: Add lazy import for layout**

Edit `AppRoutes.tsx` — inside the "Hardware Request" lazy-import block (around line 62-68), add:

```typescript
const HardwareRequestsLayout = lazy(() =>
  import('../features/hardware-request/layouts/HardwareRequestsLayout').then(m => ({ default: m.HardwareRequestsLayout }))
);
```

- [ ] **Step 3: Replace flat routes with nested routes (Admin/Agent portal)**

In `AppRoutes.tsx` replace the 6 `hardware-requests*` `<Route>` entries inside the `BentoLayout` block (currently lines ~186–191) with:

```tsx
{/* Request Center — Hardware Requests (nested under layout) */}
<Route
  path="hardware-requests"
  element={<LazyRoute component={HardwareRequestsLayout} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />}
>
  <Route index element={<LazyRoute component={HardwareRequestListPage} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />} />
  <Route path="dashboard" element={<LazyRoute component={HardwareDashboardPage} featureName="Hardware Dashboard" requiredPageAccess="hardware_requests" />} />
  <Route path="calendar" element={<LazyRoute component={InstallationCalendarPage} featureName="Installation Calendar" requiredPageAccess="hardware_requests" />} />
</Route>

{/* Non-tabbed sub-routes — no layout wrapper (standalone pages) */}
<Route path="hardware-requests/catalog" element={<LazyRoute component={CatalogAdminPage} featureName="Catalog Admin" requiredPageAccess="hardware_requests" />} />
<Route path="hardware-requests/new" element={<LazyRoute component={HardwareRequestCreatePage} featureName="New Hardware Request" requiredPageAccess="hardware_requests" />} />
<Route path="hardware-requests/:id" element={<LazyRoute component={HardwareRequestDetailPage} featureName="Hardware Request Detail" requiredPageAccess="hardware_requests" />} />
```

> **Rationale:** `/hardware-requests/new` and `/:id` are standalone pages (no tabs). Only list/dashboard/calendar live inside layout. `/catalog` also standalone (admin-only utility).

- [ ] **Step 4: Repeat same replacement for Manager portal block**

Apply identical nested route structure to the Manager portal (currently lines ~229–234).

- [ ] **Step 5: Repeat same replacement for Client portal block**

Apply identical nested route structure to the Client portal (currently lines ~264–269).

- [ ] **Step 6: Type check + run**

Run: `pnpm --filter frontend typecheck`
Expected: no errors.

Run: `pnpm --filter frontend dev` (optional smoke):
- Visit `/hardware-requests` → tabs render, list page inside.
- Visit `/hardware-requests/dashboard` → tabs active on Dashboard.
- Visit `/hardware-requests/calendar` → tabs active on Kalender.
- Visit `/hardware-requests/new` → no tabs (standalone).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/routes/AppRoutes.tsx
git commit -m "refactor(routes): nest hardware-requests list/dashboard/calendar under layout"
```

---

## Task 5: Sidebar cleanup

**Files:**
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx`

- [ ] **Step 1: Read current entries (lines 226-231)**

Run: `sed -n '220,235p' apps/frontend/src/components/layout/BentoSidebar.tsx`
Confirm entries `hardware_calendar` (line 228) and `hardware_dashboard` (line 229).

- [ ] **Step 2: Delete the two entries**

Remove lines referencing `hardware_calendar` and `hardware_dashboard`. Leave `hardware_requests` (line 227) and `hardware_catalog` (line 230) intact.

- [ ] **Step 3: Search for lingering references**

Run: `grep -rn "hardware_calendar\|hardware_dashboard\|/hardware-requests/calendar\|/hardware-requests/dashboard" apps/frontend/src/components/layout/ apps/frontend/src/lib/ apps/frontend/src/features/`
Expected: only references inside `AppRoutes.tsx` (route defs), `HardwareRequestsTabs.tsx` (tab targets), and test files. No sidebar/nav config references.

- [ ] **Step 4: Type check**

Run: `pnpm --filter frontend typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/layout/BentoSidebar.tsx
git commit -m "chore(sidebar): remove HR Calendar and HR Dashboard duplicates (merged into /hardware-requests)"
```

---

## Task 6: Expandable Item Row component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/__tests__/RequestTableExpand.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/frontend/src/features/hardware-request/components/__tests__/RequestTableExpand.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandableItemRow } from '../list/ExpandableItemRow';

const items = [
  { id: '1', name: 'Monitor Dell 24"', qty: 2 },
  { id: '2', name: 'Keyboard Logitech', qty: 5 },
  { id: '3', name: 'Mouse Wireless', qty: 5 },
];

describe('ExpandableItemRow', () => {
  it('hides items by default', () => {
    render(<ExpandableItemRow items={items} />);
    expect(screen.queryByText(/Monitor Dell/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lihat 3 item/i })).toBeInTheDocument();
  });

  it('shows items when toggled', async () => {
    const user = userEvent.setup();
    render(<ExpandableItemRow items={items} />);
    await user.click(screen.getByRole('button', { name: /lihat 3 item/i }));
    expect(screen.getByText(/Monitor Dell 24"/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard Logitech/i)).toBeInTheDocument();
    expect(screen.getByText(/Mouse Wireless/i)).toBeInTheDocument();
    expect(screen.getAllByText(/qty/i).length).toBe(3);
  });

  it('shows empty state when items are []', () => {
    render(<ExpandableItemRow items={[]} />);
    expect(screen.getByText(/belum ada item/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter frontend test -- RequestTableExpand.test --no-threads`
Expected: FAIL ("Cannot find module ExpandableItemRow").

- [ ] **Step 3: Implement**

```typescript
// apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx
import { useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface ItemLite {
  id: string;
  name: string;
  qty: number;
}

interface Props {
  items: readonly ItemLite[];
}

export function ExpandableItemRow({ items }: Props) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  if (items.length === 0) {
    return <p className="text-xs text-slate-400">Belum ada item.</p>;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        {open ? 'Sembunyikan' : `Lihat ${items.length} item`}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.ul
            key="items"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={reduce ? {} : { height: 'auto', opacity: 1 }}
            exit={reduce ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            className="mt-2 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200"
          >
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between px-3 py-2 text-xs border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-700">{it.name}</span>
                <span className="text-slate-500">qty: {it.qty}</span>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Run test — should pass**

Run: `pnpm --filter frontend test -- RequestTableExpand.test --no-threads`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/RequestTableExpand.test.tsx
git commit -m "feat(hw-requests): ExpandableItemRow component with AnimatePresence"
```

---

## Task 7: Wire ExpandableItemRow into RequestTable

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx`

- [ ] **Step 1: Read file**

Run: `cat apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx`
Identify the row template (typically a `<tr>` per request). Note which prop delivers items; if items aren't included, load from request DTO. If list API returns `itemsSummary: [{ id, name, qty }]` per request, use that. If not, extend the list API in Task 2's Plan (already done) or fallback to `request.items`.

- [ ] **Step 2: Add expandable row under each request row**

Inside the row-rendering map, below the main `<tr>`, render a second full-width `<tr>` containing `<td colSpan={COLS}>` with `<ExpandableItemRow items={request.items ?? []} />`.

Example edit sketch (adapt to actual column count):

```tsx
import { ExpandableItemRow } from './ExpandableItemRow';

// inside the row map:
return (
  <Fragment key={req.id}>
    <tr className="...">
      {/* existing cells */}
    </tr>
    <tr>
      <td colSpan={COLS} className="px-4 pb-3">
        <ExpandableItemRow items={req.items ?? []} />
      </td>
    </tr>
  </Fragment>
);
```

Import `Fragment` from `react`. Define `COLS` equal to number of `<th>` in header.

- [ ] **Step 3: Type check**

Run: `pnpm --filter frontend typecheck`
Expected: 0 errors. If `req.items` is missing from DTO type, either extend the type in `types/index.ts` to include optional `items` summary, or derive via extra query — prefer extending list endpoint if items already present.

- [ ] **Step 4: Run list page tests**

Run: `pnpm --filter frontend test -- RequestTable --no-threads`
Expected: existing tests still PASS. If a test fails due to new row, update the test to query main row only (e.g., via `getAllByRole('row').filter(...)` or a dedicated `data-testid="request-row"`).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx \
        apps/frontend/src/features/hardware-request/types/index.ts
git commit -m "feat(hw-requests): expandable item list under each RequestTable row"
```

---

## Task 8: Wire ExpandableItemRow into RequestCard

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

- [ ] **Step 1: Read file**

Run: `cat apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

- [ ] **Step 2: Add expandable footer at bottom of card body**

At the end of the card body (before any action footer), add:

```tsx
import { ExpandableItemRow } from './ExpandableItemRow';

// near the end of the card content:
<div className="mt-3 border-t border-slate-100 pt-3">
  <ExpandableItemRow items={request.items ?? []} />
</div>
```

- [ ] **Step 3: Type check**

Run: `pnpm --filter frontend typecheck`
Expected: 0 errors.

- [ ] **Step 4: Smoke render test (add to RequestTableExpand.test.tsx if missing)**

```typescript
import { RequestCard } from '../list/RequestCard';
it('RequestCard renders expandable footer', () => {
  render(
    <RequestCard
      request={{
        id: 'r1', humanId: 'HR-1', status: 'SUBMITTED',
        items: [{ id: 'i1', name: 'Monitor', qty: 1 }],
      } as any}
    />
  );
  expect(screen.getByRole('button', { name: /lihat 1 item/i })).toBeInTheDocument();
});
```

Run: `pnpm --filter frontend test -- RequestTableExpand --no-threads`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/RequestTableExpand.test.tsx
git commit -m "feat(hw-requests): expandable item footer in RequestCard"
```

---

## Task 9: Strip duplicate page chrome from List/Dashboard/Calendar pages

> Pages used inside `HardwareRequestsLayout` now inherit the `<h1>` + subtitle. Remove any duplicate page-level heading and outer wrapper padding so they render inside the outlet without double chrome. Standalone usage (e.g., Manager portal uses same routes) continues to work because the layout is always the parent.

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx`

- [ ] **Step 1: Read HardwareRequestListPage.tsx**

Run: `cat apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx`
Identify top-level `<h1>` / page title block and any outer `<main>` wrapper with its own padding.

- [ ] **Step 2: Remove duplicate heading**

Delete page title / subtitle block (tetap pertahankan filter bar, search, CTA `+ Permintaan Baru`). Root element should become a `<div className="flex flex-col gap-4">` (no outer page padding — layout already handles).

- [ ] **Step 3: Repeat for HardwareDashboardPage.tsx**

Remove duplicate `<h1>Hardware Dashboard</h1>` / page subtitle. Keep KPI cards, status donut, etc.

- [ ] **Step 4: Repeat for InstallationCalendarPage.tsx**

Remove duplicate heading. Keep calendar grid + technician filter.

- [ ] **Step 5: Type check + run**

Run: `pnpm --filter frontend typecheck`
Run dev server and visually check `/hardware-requests`, `/hardware-requests/dashboard`, `/hardware-requests/calendar` — no duplicate title, consistent spacing.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx \
        apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx \
        apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx
git commit -m "refactor(hw-requests): strip duplicate page headings (now in layout)"
```

---

## Task 10: Wire breadcrumb into Detail page

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx`

- [ ] **Step 1: Read current detail page header**

Run: `sed -n '1,80p' apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx`
Identify where request summary is rendered (likely `<h1>` with `#{humanId}`).

- [ ] **Step 2: Add breadcrumb above the heading**

```tsx
import { HardwareRequestsBreadcrumb } from '../components/common/HardwareRequestsBreadcrumb';

// Inside component, above existing <h1>:
{request && (
  <HardwareRequestsBreadcrumb currentLabel={`#${request.humanId ?? request.id.slice(0, 8)}`} />
)}
```

- [ ] **Step 3: Type check**

Run: `pnpm --filter frontend typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx
git commit -m "feat(hw-requests): breadcrumb on detail page"
```

---

## Task 11: Cleanup obsolete local routes module

**Files:**
- Modify (or delete): `apps/frontend/src/features/hardware-request/routes.tsx`

- [ ] **Step 1: Grep for references**

Run: `grep -rn "features/hardware-request/routes" apps/frontend/src/`
Expected: no consumers (AppRoutes owns the routes directly).

- [ ] **Step 2: Delete file if unused**

If no consumers → delete:

```bash
rm apps/frontend/src/features/hardware-request/routes.tsx
```

Otherwise, update it to mirror AppRoutes nested structure and leave a deprecation header comment pointing to `AppRoutes.tsx` as source of truth.

- [ ] **Step 3: Type check + build smoke**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A apps/frontend/src/features/hardware-request/routes.tsx 2>/dev/null || true
git commit -m "chore(hw-requests): remove obsolete local routes module"
```

---

## Task 12: Accessibility & reduced-motion audit

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx`

- [ ] **Step 1: Add keyboard-navigable tab semantics**

Already using `<NavLink>` (native `<a>`) — Tab key navigates by default. Verify focus-visible ring:

```tsx
// inside TabLink className:
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
```

- [ ] **Step 2: Ensure icon-only chevron has aria-hidden**

Already set in ExpandableItemRow (`aria-hidden`). Confirm.

- [ ] **Step 3: Add reduced-motion test**

Append to `HardwareRequestsTabs.test.tsx`:

```typescript
import { vi } from 'vitest';
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

it('renders tabs with reduced motion without crashing', () => {
  renderAt('/hardware-requests/dashboard');
  expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
});
```

Note: place this `vi.mock` at the top of the file if splitting into its own `describe` — or create a new file `HardwareRequestsTabs.reduced-motion.test.tsx` with the mock at top scope to avoid polluting other tests.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter frontend test -- HardwareRequestsTabs --no-threads`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/common/HardwareRequestsTabs.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx
git commit -m "feat(hw-requests): a11y focus ring + reduced-motion safety on tabs"
```

---

## Task 13: E2E — full navigation + expand smoke

**Files:**
- Create: `apps/frontend/tests/e2e/hardware-requests-layout.spec.ts`

- [ ] **Step 1: Scaffold Playwright spec**

```typescript
// apps/frontend/tests/e2e/hardware-requests-layout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Hardware Requests layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_ICT_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_ICT_PASSWORD!);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('tabs navigate between List / Dashboard / Calendar', async ({ page }) => {
    await page.goto('/hardware-requests');
    await expect(page.getByRole('heading', { name: /hardware requests/i })).toBeVisible();
    const nav = page.getByRole('navigation', { name: /hardware requests tabs/i });

    await nav.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests\/dashboard$/);
    await expect(nav.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: /kalender/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests\/calendar$/);
    await expect(nav.getByRole('link', { name: /kalender/i })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: /permintaan/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests$/);
  });

  test('expandable row reveals items in list', async ({ page }) => {
    await page.goto('/hardware-requests');
    const firstExpand = page.getByRole('button', { name: /lihat \d+ item/i }).first();
    await firstExpand.click();
    await expect(page.getByRole('button', { name: /sembunyikan/i })).toBeVisible();
  });

  test('sidebar no longer shows HR Calendar and HR Dashboard duplicates', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.getByRole('navigation', { name: /main|sidebar/i });
    await expect(sidebar.getByRole('link', { name: /^HR Calendar$/ })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /^HR Dashboard$/ })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /^Hardware Requests$/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm --filter frontend test:e2e -- hardware-requests-layout`
Expected: PASS. If `E2E_ICT_EMAIL`/`E2E_ICT_PASSWORD` env vars aren't set, mirror existing E2E auth helper (e.g., `tests/e2e/_helpers/login.ts`) instead.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/tests/e2e/hardware-requests-layout.spec.ts
git commit -m "test(e2e): hardware-requests layout navigation + expand smoke"
```

---

## Task 14: Visual consistency audit sweep

> Ensure all new surfaces match `SectionCard` palette (`rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm`), semantic text tokens (`text-slate-900`, `text-slate-500`), and no hardcoded hex/shadow. This is a guarded refactor — read, then adjust only where drift is clear.

**Files:**
- Audit: all files created/modified in Tasks 1–13

- [ ] **Step 1: Grep for hardcoded hex**

Run: `grep -rn "#[0-9A-Fa-f]\{6\}" apps/frontend/src/features/hardware-request/layouts apps/frontend/src/features/hardware-request/components/common apps/frontend/src/features/hardware-request/components/list/ExpandableItemRow.tsx`
Expected: zero hits. If any, replace with Tailwind semantic tokens.

- [ ] **Step 2: Grep for drift from ring/card style**

Run: `grep -rn "border border-" apps/frontend/src/features/hardware-request/layouts apps/frontend/src/features/hardware-request/components/common`
Confirm usage matches existing `ring-1 ring-slate-200` pattern from `SectionCard.tsx`. Replace stray `border border-slate-200` → `ring-1 ring-slate-200` on card-style surfaces (not on dividers — keep `border-b border-slate-200` for bottom rules).

- [ ] **Step 3: Verify `backdrop-blur` on sticky tab bar**

Confirm `HardwareRequestsTabs.tsx` has `backdrop-blur bg-white/70` on the outer `<nav>`.

- [ ] **Step 4: Visual smoke (dev server)**

Run: `pnpm --filter frontend dev`
Navigate:
- `/hardware-requests` — tabs sticky at top while scrolling; underline slides between tabs; badge visible on "Permintaan (N)".
- Click expand on a row — panel slides open, chevron rotates.
- `/hardware-requests/:id` — breadcrumb visible: `Hardware Requests / Permintaan / #HR-...`.
- Switch OS to "Reduce motion" → tabs transition instantly (no spring), expand row toggles without animation.

- [ ] **Step 5: Commit any polish fixes**

```bash
git add -p   # stage only drift fixes
git commit -m "style(hw-requests): consistency audit pass across new surfaces"
```

---

## Task 15: Final verification

- [ ] **Step 1: Full test run**

Run: `pnpm --filter frontend test -- --no-threads`
Expected: all pass, no regressions in `RequestTable.test` / existing suites.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build`
Expected: success, no new bundle-size regressions (layout lazily loaded).

- [ ] **Step 3: E2E**

Run: `pnpm --filter frontend test:e2e -- hardware-requests-layout`
Expected: PASS.

- [ ] **Step 4: Cross-portal smoke in dev**

Login as ADMIN, MANAGER, USER — verify all three portals render tabs correctly on `/hardware-requests`, Manager portal at `/manager/hardware-requests`, Client portal at `/client/hardware-requests`.

> **Note:** Manager and Client portals use `/manager/hardware-requests` and `/client/hardware-requests` prefix — if those portals need the nested layout too, repeat the Task 4 refactor for those two route blocks. Plan assumes yes (they currently have the flat duplicates). Verify during smoke and add the nested refactor to those blocks before committing if still flat.

- [ ] **Step 5: Merge checklist**

Confirm spec coverage (cross-reference Section 6 & 11 of the design spec):
- [x] 6.1 Sub-routes — Task 4
- [x] 6.2 Sidebar cleanup — Task 5
- [x] 6.3 Tabs component — Task 2
- [x] 6.4 Expandable items — Tasks 6-8
- [x] 6.5 Lazy-load — Task 4 (`lazy()` import)
- [x] 6.6 Breadcrumb — Tasks 3 & 10
- [x] 11 UI/UX consistency — Task 14
- [x] 11 Animations — Tasks 2, 6, 12
- [x] 11 Accessibility — Task 12
- [x] Tests (Sub-spec 3): Tabs / RequestTable expand / E2E — Tasks 2, 6, 13

- [ ] **Step 6: Final commit (if any leftover)**

```bash
git status
git commit --allow-empty -m "chore(hw-requests): layout + UI polish plan complete"
```

---

## Self-Review Notes

- **Spec coverage:** All sub-items of Section 6 and Section 11 mapped to tasks (see Task 15 Step 5).
- **No placeholders:** Every code step shows concrete code or exact grep/sed patterns. Where the engineer must read-and-adapt (e.g., RequestTable col count), the instruction is explicit ("Define `COLS` equal to number of `<th>` in header").
- **Type consistency:** Tab definitions, `ItemLite` interface, and `useHardwareRequestsCount` signatures reused consistently across tasks. `NavLink.end` semantics handled explicitly for `.` (index) vs `dashboard`/`calendar` (end=true).
- **Open item from spec Section 16:** Cleanup of old `invoice_*` columns is deferred to a post-deploy cleanup plan — intentionally out of scope here.

---

## Execution Handoff

Plan lengkap tersimpan di `docs/superpowers/plans/2026-04-19-hardware-requests-overhaul-03-layout-ui-polish.md`. Dua opsi eksekusi:

1. **Subagent-Driven (rekomendasi)** — dispatch fresh subagent per task, review antar task, iterasi cepat.
2. **Inline Execution** — eksekusi berurutan di sesi ini via `superpowers:executing-plans`, batch checkpoint.

Mau pilih yang mana?
