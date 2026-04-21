# Hardware Request — Plan 7: Frontend ICT Pages (Calendar · Barcode · Dashboard · Catalog Admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun halaman-halaman khusus ICT di frontend: Installation Calendar (month/week/day dengan drag-drop reschedule), Barcode Scanner flow untuk technician complete install, Dashboard KPI + widgets, dan Catalog Admin CRUD.

**Architecture:** Ekstensi dari Plan 6. Reuse API modules (`installation.api.ts`, `dashboard.api.ts`, `catalog.api.ts`), hooks (`useInstallationCalendar`), dan common components (`StatusBadge`, `RoleBadge`, `HwrSkeleton`). Calendar pakai `@fullcalendar/react` (sudah ada di project). Barcode scanner pakai `@zxing/browser` (native getUserMedia + library decoder). Dashboard pakai `recharts` (sudah ada).

**Tech Stack:** React 18, React Query, React Router, Tailwind, shadcn/ui, FullCalendar, ZXing, Recharts, date-fns, Vitest + RTL.

---

## Files in this plan

### Create
- `apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts`
- `apps/frontend/src/features/hardware-request/hooks/useDashboardData.ts`
- `apps/frontend/src/features/hardware-request/hooks/useCatalogAdmin.ts`
- `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/UnscheduledList.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/MyTodayPanel.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/EventPopover.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/KpiCards.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/StatusDonut.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/AgingTable.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/TopCategoriesBar.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/WeeklyScheduleStrip.tsx`
- `apps/frontend/src/features/hardware-request/components/dashboard/TechnicianWorkload.tsx`
- `apps/frontend/src/features/hardware-request/components/catalog/CatalogAdminPage.tsx`
- `apps/frontend/src/features/hardware-request/components/catalog/CatalogTable.tsx`
- `apps/frontend/src/features/hardware-request/components/catalog/CatalogEditModal.tsx`
- `apps/frontend/src/features/hardware-request/components/catalog/RequiredFieldsBuilder.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/BarcodeScannerModal.test.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/RequiredFieldsBuilder.test.tsx`
- `apps/frontend/src/features/hardware-request/components/__tests__/AgingTable.test.tsx`

### Modify
- `apps/frontend/src/features/hardware-request/hooks/useInstallationCalendar.ts` — tambah `reschedule` mutation + invalidate pattern (jika sudah di Plan 6 hanya fetch, tambahkan mutations di sini)
- `apps/frontend/src/features/hardware-request/api/catalog.api.ts` — pastikan export `createCatalog`, `updateCatalog`, `deleteCatalog`, `listCatalogAdmin` (full including inactive)
- `apps/frontend/src/features/hardware-request/api/dashboard.api.ts` — pastikan export semua widget endpoints (`fetchKpi`, `fetchStatusDistribution`, `fetchAgingBuckets`, `fetchTopCategories`, `fetchWeeklySchedule`, `fetchTechnicianWorkload`)
- `apps/frontend/src/app/routes.tsx` — tambah 3 route: `/hardware-requests/calendar`, `/hardware-requests/dashboard`, `/hardware-requests/catalog`
- `apps/frontend/src/components/layout/Sidebar.tsx` — tambah entry "Calendar", "Dashboard", "Catalog" di bawah "Hardware Requests" (role-gated via `usePermissions`)

---

## Task 7.0: Dependency audit

**Files:**
- Modify: `apps/frontend/package.json` (only if deps missing)

- [ ] **Step 1: Cek ketersediaan dependencies**

Run:
```bash
cd apps/frontend && node -e "const p=require('./package.json').dependencies; console.log({fc:p['@fullcalendar/react'], fcCommon:p['@fullcalendar/core'], fcDay:p['@fullcalendar/daygrid'], fcTime:p['@fullcalendar/timegrid'], fcInt:p['@fullcalendar/interaction'], zxing:p['@zxing/browser'], recharts:p['recharts']});"
```

Expected: FullCalendar packages + `recharts` sudah ada (lihat zoom-calendar redesign). Jika tidak ada, install.

- [ ] **Step 2: Install missing packages**

Jika `@zxing/browser` belum ada:
```bash
cd apps/frontend && pnpm add @zxing/browser @zxing/library
```

Jika FullCalendar plugins belum lengkap:
```bash
cd apps/frontend && pnpm add @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml
git commit -m "chore(frontend): add barcode + calendar deps for hardware-request"
```

---

## Task 7.1: Extend `useInstallationCalendar` dengan mutations

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/hooks/useInstallationCalendar.ts`

- [ ] **Step 1: Write failing test**

`apps/frontend/src/features/hardware-request/hooks/__tests__/useInstallationCalendar.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInstallationCalendar } from '../useInstallationCalendar';
import * as api from '../../api/installation.api';
import { vi } from 'vitest';

vi.mock('../../api/installation.api');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test('rescheduleMutation calls api.rescheduleSchedule and invalidates calendar', async () => {
  vi.mocked(api.fetchCalendarEvents).mockResolvedValue([]);
  vi.mocked(api.rescheduleSchedule).mockResolvedValue({ id: 's1' } as any);
  const { result } = renderHook(
    () => useInstallationCalendar({ from: '2026-04-01', to: '2026-04-30' }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.events).toEqual([]));
  await result.current.reschedule.mutateAsync({
    scheduleId: 's1',
    payload: { proposedAt: '2026-04-20T09:00:00Z', reason: 'shift change' },
  });
  expect(api.rescheduleSchedule).toHaveBeenCalledWith('s1', {
    proposedAt: '2026-04-20T09:00:00Z',
    reason: 'shift change',
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `cd apps/frontend && pnpm vitest run src/features/hardware-request/hooks/__tests__/useInstallationCalendar.test.tsx`
Expected: FAIL (reschedule mutation belum ada).

- [ ] **Step 3: Extend hook**

Append ke `useInstallationCalendar.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rescheduleSchedule, type ReschedulePayload } from '../api/installation.api';

export function useInstallationCalendar(range: { from: string; to: string; technicianIds?: string[] }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['hardware-requests', 'calendar', range],
    queryFn: () => fetchCalendarEvents(range),
    staleTime: 30_000,
  });

  const reschedule = useMutation({
    mutationFn: ({ scheduleId, payload }: { scheduleId: string; payload: ReschedulePayload }) =>
      rescheduleSchedule(scheduleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'calendar'] });
      qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail'] });
    },
  });

  return { events: query.data ?? [], isLoading: query.isLoading, error: query.error, reschedule };
}
```

- [ ] **Step 4: Run test — should pass**

Run: same command
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/useInstallationCalendar.ts \
        apps/frontend/src/features/hardware-request/hooks/__tests__/useInstallationCalendar.test.tsx
git commit -m "feat(hardware-request/frontend): add reschedule mutation to calendar hook"
```

---

## Task 7.2: `TechnicianFilter` component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchTechnicians } from '../../api/installation.api';

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function TechnicianFilter({ selectedIds, onChange }: Props) {
  const { data: technicians = [] } = useQuery({
    queryKey: ['hardware-requests', 'technicians'],
    queryFn: fetchTechnicians,
    staleTime: 5 * 60_000,
  });

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-500">Technician</div>
      <div className="flex flex-wrap gap-1">
        {technicians.map((t) => {
          const active = selectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={[
                'px-2 py-1 rounded-full text-xs border transition',
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              aria-pressed={active}
            >
              {t.fullName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx
git commit -m "feat(hardware-request/frontend): add TechnicianFilter component"
```

---

## Task 7.3: `UnscheduledList` component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/UnscheduledList.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchUnscheduledRequests } from '../../api/installation.api';
import { Link } from 'react-router-dom';
import { HwrSkeleton } from '../common/HwrSkeleton';

export function UnscheduledList() {
  const { data, isLoading } = useQuery({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });

  return (
    <section aria-labelledby="unscheduled-heading" className="rounded-lg border bg-white p-3">
      <h3 id="unscheduled-heading" className="text-sm font-semibold text-slate-900 mb-2">
        Unscheduled ({data?.length ?? 0})
      </h3>
      {isLoading ? (
        <HwrSkeleton rows={3} />
      ) : data && data.length > 0 ? (
        <ul className="space-y-1">
          {data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/hardware-requests/${r.id}`}
                className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                <span className="font-mono text-slate-600">{r.requestNumber}</span>
                <span className="truncate text-slate-700 flex-1 ml-2">{r.siteName}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Tidak ada request menunggu jadwal.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/UnscheduledList.tsx
git commit -m "feat(hardware-request/frontend): add UnscheduledList panel"
```

---

## Task 7.4: `MyTodayPanel` component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/MyTodayPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchMyTodaySchedules } from '../../api/installation.api';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { HwrSkeleton } from '../common/HwrSkeleton';
import { usePermissions } from '../../hooks/usePermissions';

export function MyTodayPanel() {
  const { isTechnician } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['hardware-requests', 'my-today'],
    queryFn: fetchMyTodaySchedules,
    enabled: isTechnician,
    staleTime: 30_000,
  });
  if (!isTechnician) return null;

  return (
    <section aria-labelledby="my-today-heading" className="rounded-lg border bg-white p-3">
      <h3 id="my-today-heading" className="text-sm font-semibold text-slate-900 mb-2">
        My Today
      </h3>
      {isLoading ? (
        <HwrSkeleton rows={2} />
      ) : data && data.length > 0 ? (
        <ul className="space-y-1">
          {data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/hardware-requests/${s.requestId}`}
                className="block rounded px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">
                  {format(parseISO(s.scheduledAt), 'HH:mm')} — {s.siteName}
                </div>
                <div className="text-slate-500 font-mono">{s.requestNumber}</div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Tidak ada jadwal hari ini.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/MyTodayPanel.tsx
git commit -m "feat(hardware-request/frontend): add MyTodayPanel for technicians"
```

---

## Task 7.5: `EventPopover` component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/EventPopover.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { StatusBadge } from '../common/StatusBadge';
import type { InstallStatus } from '../../types';

export type CalendarEventData = {
  scheduleId: string;
  requestId: string;
  requestNumber: string;
  siteName: string;
  technicianName: string;
  status: InstallStatus;
  scheduledAt: string;
};

type Props = {
  event: CalendarEventData;
  onClose: () => void;
};

export function EventPopover({ event, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-label={`Installation ${event.requestNumber}`}
      className="absolute z-20 w-64 rounded-lg border bg-white p-3 shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-xs text-slate-500">{event.requestNumber}</div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">{event.siteName}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
          ×
        </button>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-500">Technician</dt>
          <dd className="text-slate-800">{event.technicianName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">When</dt>
          <dd className="text-slate-800">{format(parseISO(event.scheduledAt), 'dd MMM HH:mm')}</dd>
        </div>
        <div className="flex justify-between items-center">
          <dt className="text-slate-500">Status</dt>
          <dd>
            <StatusBadge status={event.status} size="sm" />
          </dd>
        </div>
      </dl>
      <Link
        to={`/hardware-requests/${event.requestId}`}
        className="mt-3 block text-center text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        Buka detail →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/EventPopover.tsx
git commit -m "feat(hardware-request/frontend): add EventPopover for calendar"
```

---

## Task 7.6: `RescheduleConfirmModal`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import { format, parseISO } from 'date-fns';

type Props = {
  open: boolean;
  from: string;
  to: string;
  requestNumber: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function RescheduleConfirmModal({
  open, from, to, requestNumber, onConfirm, onCancel, isSubmitting,
}: Props) {
  const [reason, setReason] = useState('');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-labelledby="resched-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h2 id="resched-title" className="text-lg font-semibold text-slate-900">
          Reschedule konfirmasi
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Request <span className="font-mono">{requestNumber}</span> akan dipindah dari{' '}
          <strong>{format(parseISO(from), 'dd MMM HH:mm')}</strong> ke{' '}
          <strong>{format(parseISO(to), 'dd MMM HH:mm')}</strong>.
        </p>
        <label className="block mt-4">
          <span className="text-xs font-medium text-slate-700">Alasan (wajib)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Mis. shift technician berubah"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={isSubmitting || reason.trim().length < 5}
            className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses…' : 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx
git commit -m "feat(hardware-request/frontend): add RescheduleConfirmModal"
```

---

## Task 7.7: `InstallationCalendarPage`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';
import { useInstallationCalendar } from '../../hooks/useInstallationCalendar';
import { usePermissions } from '../../hooks/usePermissions';
import { TechnicianFilter } from './TechnicianFilter';
import { UnscheduledList } from './UnscheduledList';
import { MyTodayPanel } from './MyTodayPanel';
import { EventPopover, type CalendarEventData } from './EventPopover';
import { RescheduleConfirmModal } from './RescheduleConfirmModal';
import { toast } from '@/components/ui/toast';
import { statusColor } from '../../utils/statusColors';

export function InstallationCalendarPage() {
  const { isIctRole, isTechnician } = usePermissions();
  const [range, setRange] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: first.toISOString(), to: last.toISOString() };
  });
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [popover, setPopover] = useState<CalendarEventData | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    scheduleId: string;
    requestNumber: string;
    from: string;
    to: string;
    revert: () => void;
  } | null>(null);

  const { events, reschedule } = useInstallationCalendar({ ...range, technicianIds });

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.scheduleId,
        title: `${e.requestNumber} · ${e.siteName}`,
        start: e.scheduledAt,
        end: e.endsAt ?? undefined,
        backgroundColor: statusColor(e.status, 'bg'),
        borderColor: statusColor(e.status, 'border'),
        textColor: '#ffffff',
        editable: isTechnician && e.status !== 'COMPLETED',
        extendedProps: e,
      })),
    [events, isTechnician],
  );

  if (!isIctRole) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-12 lg:col-span-9">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Installation Calendar</h1>
        </div>
        <TechnicianFilter selectedIds={technicianIds} onChange={setTechnicianIds} />
        <div className="mt-3 rounded-lg border bg-white p-2">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={fcEvents}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              setPopover(info.event.extendedProps as CalendarEventData);
            }}
            eventDrop={(info) => {
              const extended = info.event.extendedProps as CalendarEventData;
              setPendingReschedule({
                scheduleId: extended.scheduleId,
                requestNumber: extended.requestNumber,
                from: extended.scheduledAt,
                to: info.event.startStr,
                revert: () => info.revert(),
              });
            }}
            datesSet={(arg) =>
              setRange({ from: arg.startStr, to: arg.endStr })
            }
            height="auto"
          />
        </div>
      </div>

      <aside className="col-span-12 lg:col-span-3 space-y-3">
        <MyTodayPanel />
        <UnscheduledList />
      </aside>

      {popover && (
        <div className="fixed inset-0 z-10" onClick={() => setPopover(null)}>
          <div className="absolute left-1/2 top-20 -translate-x-1/2">
            <EventPopover event={popover} onClose={() => setPopover(null)} />
          </div>
        </div>
      )}

      <RescheduleConfirmModal
        open={!!pendingReschedule}
        from={pendingReschedule?.from ?? ''}
        to={pendingReschedule?.to ?? ''}
        requestNumber={pendingReschedule?.requestNumber ?? ''}
        isSubmitting={reschedule.isPending}
        onCancel={() => {
          pendingReschedule?.revert();
          setPendingReschedule(null);
        }}
        onConfirm={async (reason) => {
          if (!pendingReschedule) return;
          try {
            await reschedule.mutateAsync({
              scheduleId: pendingReschedule.scheduleId,
              payload: { proposedAt: pendingReschedule.to, reason },
            });
            toast.success('Reschedule dikirim, menunggu konfirmasi requester.');
            setPendingReschedule(null);
          } catch (err) {
            pendingReschedule.revert();
            toast.error('Gagal reschedule: ' + (err as Error).message);
            setPendingReschedule(null);
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/frontend && pnpm typecheck && pnpm lint --fix src/features/hardware-request/components/calendar`
Expected: PASS.

- [ ] **Step 3: Smoke test in browser**

Run `pnpm dev` dan buka `/hardware-requests/calendar` sebagai technician. Verifikasi event render, drag-drop trigger modal, click trigger popover. Catat masalah (render/CSS) sebelum commit.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx
git commit -m "feat(hardware-request/frontend): add InstallationCalendarPage"
```

---

## Task 7.8: Barcode scanner hook

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts`

- [ ] **Step 1: Implement**

```ts
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

type ScannerState = {
  isScanning: boolean;
  error: string | null;
  lastCode: string | null;
};

export function useBarcodeScanner(onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [state, setState] = useState<ScannerState>({
    isScanning: false,
    error: null,
    lastCode: null,
  });

  const start = async () => {
    if (!videoRef.current) return;
    setState((s) => ({ ...s, error: null }));
    try {
      readerRef.current = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (devices.length === 0) {
        throw new Error('Tidak ada kamera yang tersedia.');
      }
      const deviceId =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0].deviceId;

      setState((s) => ({ ...s, isScanning: true }));
      await readerRef.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText();
          setState((s) => ({ ...s, lastCode: text }));
          onCode(text);
        }
        if (err && err.name !== 'NotFoundException') {
          setState((s) => ({ ...s, error: err.message }));
        }
      });
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message, isScanning: false }));
    }
  };

  const stop = () => {
    readerRef.current?.reset();
    readerRef.current = null;
    setState((s) => ({ ...s, isScanning: false }));
  };

  useEffect(() => () => stop(), []);

  return { videoRef, state, start, stop };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts
git commit -m "feat(hardware-request/frontend): add useBarcodeScanner hook"
```

---

## Task 7.9: `BarcodeInputFallback`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';

type Props = {
  onSubmit: (code: string) => void;
  disabled?: boolean;
};

export function BarcodeInputFallback({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed.length >= 3) onSubmit(trimmed);
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Masukkan barcode manual"
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        disabled={disabled}
        aria-label="Barcode input"
      />
      <button
        type="submit"
        className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        disabled={disabled || value.trim().length < 3}
      >
        Simpan
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx
git commit -m "feat(hardware-request/frontend): add BarcodeInputFallback"
```

---

## Task 7.10: `BarcodeScannerModal` + test

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx`
- Test: `apps/frontend/src/features/hardware-request/components/__tests__/BarcodeScannerModal.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BarcodeScannerModal } from '../barcode/BarcodeScannerModal';
import { vi } from 'vitest';

vi.mock('../../hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: (onCode: (c: string) => void) => ({
    videoRef: { current: null },
    state: { isScanning: false, error: null, lastCode: null },
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

test('fallback input submits code and calls onCapture', () => {
  const onCapture = vi.fn();
  render(
    <BarcodeScannerModal open={true} onClose={() => {}} onCapture={onCapture} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /input manual/i }));
  fireEvent.change(screen.getByLabelText(/barcode input/i), { target: { value: 'ASSET-123' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
  expect(onCapture).toHaveBeenCalledWith('ASSET-123');
});
```

- [ ] **Step 2: Run test — should fail**

Run: `cd apps/frontend && pnpm vitest run src/features/hardware-request/components/__tests__/BarcodeScannerModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import { useState } from 'react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { BarcodeInputFallback } from './BarcodeInputFallback';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (code: string) => void;
};

export function BarcodeScannerModal({ open, onClose, onCapture }: Props) {
  const [manual, setManual] = useState(false);
  const { videoRef, state, start, stop } = useBarcodeScanner((code) => {
    onCapture(code);
    stop();
    onClose();
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-labelledby="scan-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="scan-title" className="text-lg font-semibold text-slate-900">
            Scan Barcode Asset
          </h2>
          <button onClick={() => { stop(); onClose(); }} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        {!manual ? (
          <>
            <div className="mt-3 aspect-video overflow-hidden rounded-md bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
            {state.error && (
              <p role="alert" className="mt-2 text-xs text-rose-600">{state.error}</p>
            )}
            <div className="mt-3 flex justify-between">
              {!state.isScanning ? (
                <button onClick={start} className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white">
                  Mulai Scan
                </button>
              ) : (
                <button onClick={stop} className="px-3 py-2 text-sm rounded-md border border-slate-300">
                  Stop
                </button>
              )}
              <button
                onClick={() => { stop(); setManual(true); }}
                className="px-3 py-2 text-sm rounded-md text-indigo-600 hover:underline"
              >
                Input manual
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <BarcodeInputFallback
              onSubmit={(code) => {
                onCapture(code);
                onClose();
              }}
            />
            <button
              onClick={() => setManual(false)}
              className="text-xs text-indigo-600 hover:underline"
            >
              ← Kembali ke kamera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — should pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/BarcodeScannerModal.test.tsx
git commit -m "feat(hardware-request/frontend): add BarcodeScannerModal with manual fallback"
```

---

## Task 7.11: `CompleteInstallWizard`

Digunakan di `ActionPanel` pada detail request ketika technician menekan "Complete Installation". Scan barcode per item → submit.

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo, useState } from 'react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { completeInstallation } from '../../api/installation.api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';

type Item = {
  id: string;
  catalogName: string;
  quantity: number;
  assetCode?: string | null;
};

type Props = {
  open: boolean;
  requestId: string;
  items: Item[];
  onClose: () => void;
};

export function CompleteInstallWizard({ open, requestId, items, onClose }: Props) {
  const qc = useQueryClient();
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.assetCode ?? ''])),
  );
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allScanned = useMemo(
    () => items.every((i) => (assigned[i.id] ?? '').trim().length >= 3),
    [items, assigned],
  );

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await completeInstallation(requestId, {
        items: items.map((i) => ({ itemId: i.id, assetCode: assigned[i.id].trim() })),
      });
      await qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] });
      await qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
      toast.success('Installation completed.');
      onClose();
    } catch (err) {
      toast.error('Gagal menyelesaikan install: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-labelledby="complete-title" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <h2 id="complete-title" className="text-lg font-semibold text-slate-900">
          Complete Installation
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan barcode untuk setiap item. Kode tersimpan sebagai asset code.
        </p>
        <ul className="mt-4 divide-y rounded-md border">
          {items.map((i) => {
            const code = assigned[i.id] ?? '';
            return (
              <li key={i.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{i.catalogName}</div>
                  <div className="text-xs text-slate-500">Qty {i.quantity}</div>
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setAssigned({ ...assigned, [i.id]: e.target.value })}
                  placeholder="Asset code"
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setScanFor(i.id)}
                  className="text-xs px-2 py-1 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  Scan
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="px-3 py-2 text-sm rounded-md border">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={!allScanned || submitting}
            className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Menyelesaikan…' : 'Selesaikan Installation'}
          </button>
        </div>
      </div>

      <BarcodeScannerModal
        open={scanFor !== null}
        onClose={() => setScanFor(null)}
        onCapture={(code) => {
          if (scanFor) setAssigned((a) => ({ ...a, [scanFor]: code }));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire ke `ActionPanel`**

Buka `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx` (dibuat di Plan 6). Tambahkan tombol `Complete Installation` ketika `status === 'INSTALLATION' && isTechnician` yang membuka `CompleteInstallWizard` dengan items dari detail query.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx \
        apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx
git commit -m "feat(hardware-request/frontend): add CompleteInstallWizard with barcode capture"
```

---

## Task 7.12: Dashboard hook

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useDashboardData.ts`

- [ ] **Step 1: Implement**

```ts
import { useQueries } from '@tanstack/react-query';
import {
  fetchKpi,
  fetchStatusDistribution,
  fetchAgingBuckets,
  fetchTopCategories,
  fetchWeeklySchedule,
  fetchTechnicianWorkload,
} from '../api/dashboard.api';

export type DashboardFilters = {
  from?: string;
  to?: string;
};

export function useDashboardData(filters: DashboardFilters = {}) {
  const results = useQueries({
    queries: [
      { queryKey: ['hardware-requests', 'dashboard', 'kpi', filters], queryFn: () => fetchKpi(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'status', filters], queryFn: () => fetchStatusDistribution(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'aging'], queryFn: fetchAgingBuckets, staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'topCategories', filters], queryFn: () => fetchTopCategories(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'weekly'], queryFn: fetchWeeklySchedule, staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'techWorkload'], queryFn: fetchTechnicianWorkload, staleTime: 60_000 },
    ],
  });

  const [kpi, status, aging, topCat, weekly, tech] = results;
  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error ?? null;

  return {
    kpi: kpi.data,
    statusDistribution: status.data,
    aging: aging.data,
    topCategories: topCat.data,
    weekly: weekly.data,
    technicianWorkload: tech.data,
    isLoading,
    error,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/useDashboardData.ts
git commit -m "feat(hardware-request/frontend): add useDashboardData composite hook"
```

---

## Task 7.13: `KpiCards`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/KpiCards.tsx`

- [ ] **Step 1: Implement**

```tsx
type KpiData = {
  totalActive: number;
  inProcurement: number;
  pendingInstall: number;
  completedThisMonth: number;
};

const cards: { key: keyof KpiData; label: string; accent: string }[] = [
  { key: 'totalActive', label: 'Total Active', accent: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'inProcurement', label: 'In Procurement', accent: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'pendingInstall', label: 'Pending Install', accent: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'completedThisMonth', label: 'Completed This Month', accent: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export function KpiCards({ data, loading }: { data?: KpiData; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-lg border p-4 ${c.accent}`}>
          <div className="text-xs font-medium uppercase tracking-wide opacity-80">{c.label}</div>
          <div className="mt-2 text-3xl font-semibold">
            {loading || !data ? '—' : data[c.key].toLocaleString('id-ID')}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/dashboard/KpiCards.tsx
git commit -m "feat(hardware-request/frontend): add KpiCards"
```

---

## Task 7.14: `StatusDonut`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/StatusDonut.tsx`

- [ ] **Step 1: Implement**

```tsx
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { statusColor } from '../../utils/statusColors';
import type { RequestStatus } from '../../types';

type Slice = { status: RequestStatus; count: number };

export function StatusDonut({ data, loading }: { data?: Slice[]; loading?: boolean }) {
  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (!data || data.length === 0) return <p className="text-sm text-slate-500">Belum ada data.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Distribusi Status</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((s) => (
              <Cell key={s.status} fill={statusColor(s.status, 'hex')} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('id-ID')} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/dashboard/StatusDonut.tsx
git commit -m "feat(hardware-request/frontend): add StatusDonut chart"
```

---

## Task 7.15: `AgingTable` + test

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/AgingTable.tsx`
- Test: `apps/frontend/src/features/hardware-request/components/__tests__/AgingTable.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { AgingTable } from '../dashboard/AgingTable';
import { MemoryRouter } from 'react-router-dom';

test('renders aging buckets with counts and flags red >7 days', () => {
  render(
    <MemoryRouter>
      <AgingTable
        data={[
          { bucket: '0-3', count: 10, requests: [] },
          { bucket: '3-7', count: 4, requests: [] },
          { bucket: '>7', count: 2, requests: [{ id: 'r1', requestNumber: 'HR-001', ageDays: 9, status: 'APPROVED' }] },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/> 7 hari/i).closest('tr')).toHaveClass('bg-rose-50');
  expect(screen.getByRole('link', { name: /HR-001/i })).toHaveAttribute('href', '/hardware-requests/r1');
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/frontend && pnpm vitest run src/features/hardware-request/components/__tests__/AgingTable.test.tsx`

- [ ] **Step 3: Implement**

```tsx
import { Link } from 'react-router-dom';
import type { RequestStatus } from '../../types';

type Row = {
  bucket: '0-3' | '3-7' | '>7';
  count: number;
  requests: { id: string; requestNumber: string; ageDays: number; status: RequestStatus }[];
};

const labels: Record<Row['bucket'], string> = {
  '0-3': '0-3 hari',
  '3-7': '3-7 hari',
  '>7': '> 7 hari',
};

export function AgingTable({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Aging</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b">
            <th className="py-2">Bucket</th>
            <th>Count</th>
            <th>Top</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.bucket} className={row.bucket === '>7' ? 'bg-rose-50' : 'hover:bg-slate-50'}>
              <td className="py-2 font-medium">{labels[row.bucket]}</td>
              <td>{row.count}</td>
              <td className="text-xs">
                {row.requests.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to={`/hardware-requests/${r.id}`}
                    className="mr-2 text-indigo-600 hover:underline"
                  >
                    {r.requestNumber} ({r.ageDays}d)
                  </Link>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/dashboard/AgingTable.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/AgingTable.test.tsx
git commit -m "feat(hardware-request/frontend): add AgingTable widget"
```

---

## Task 7.16: `TopCategoriesBar`, `WeeklyScheduleStrip`, `TechnicianWorkload`

Tiga widget kecil pakai Recharts. Bundle satu commit.

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/TopCategoriesBar.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/WeeklyScheduleStrip.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/TechnicianWorkload.tsx`

- [ ] **Step 1: `TopCategoriesBar.tsx`**

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

type Row = { category: string; count: number };

export function TopCategoriesBar({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Top Categories</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis type="number" allowDecimals={false} fontSize={12} />
          <YAxis type="category" dataKey="category" fontSize={12} width={100} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: `WeeklyScheduleStrip.tsx`**

```tsx
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type Slot = { date: string; count: number };

export function WeeklyScheduleStrip({ data, loading }: { data?: Slot[]; loading?: boolean }) {
  if (loading) return <div className="h-20 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Jadwal Instalasi 7 Hari</h3>
      <div className="grid grid-cols-7 gap-2">
        {data.map((d) => (
          <div key={d.date} className="rounded-md border p-2 text-center">
            <div className="text-[10px] uppercase text-slate-500">
              {format(parseISO(d.date), 'EEE', { locale: idLocale })}
            </div>
            <div className="text-xs text-slate-700">
              {format(parseISO(d.date), 'd MMM', { locale: idLocale })}
            </div>
            <div className="mt-1 text-lg font-semibold text-indigo-600">{d.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `TechnicianWorkload.tsx`**

```tsx
type Row = { technicianId: string; technicianName: string; openCount: number; todayCount: number };

export function TechnicianWorkload({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;
  const max = Math.max(1, ...data.map((r) => r.openCount));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Beban Technician</h3>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.technicianId}>
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span className="truncate">{r.technicianName}</span>
              <span>
                {r.openCount} open · {r.todayCount} hari ini
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${(r.openCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/dashboard/TopCategoriesBar.tsx \
        apps/frontend/src/features/hardware-request/components/dashboard/WeeklyScheduleStrip.tsx \
        apps/frontend/src/features/hardware-request/components/dashboard/TechnicianWorkload.tsx
git commit -m "feat(hardware-request/frontend): add dashboard minor widgets"
```

---

## Task 7.17: `HardwareDashboardPage`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePermissions } from '../../hooks/usePermissions';
import { KpiCards } from './KpiCards';
import { StatusDonut } from './StatusDonut';
import { AgingTable } from './AgingTable';
import { TopCategoriesBar } from './TopCategoriesBar';
import { WeeklyScheduleStrip } from './WeeklyScheduleStrip';
import { TechnicianWorkload } from './TechnicianWorkload';

export function HardwareDashboardPage() {
  const { isIctRole } = usePermissions();
  const d = useDashboardData();

  if (!isIctRole) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Hardware Dashboard</h1>
      <KpiCards data={d.kpi} loading={d.isLoading} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusDonut data={d.statusDistribution} loading={d.isLoading} />
        <AgingTable data={d.aging} loading={d.isLoading} />
        <TopCategoriesBar data={d.topCategories} loading={d.isLoading} />
        <TechnicianWorkload data={d.technicianWorkload} loading={d.isLoading} />
      </div>
      <WeeklyScheduleStrip data={d.weekly} loading={d.isLoading} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx
git commit -m "feat(hardware-request/frontend): add HardwareDashboardPage"
```

---

## Task 7.18: Catalog admin hook

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useCatalogAdmin.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCatalogAdmin,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  type CatalogItem,
  type CatalogInput,
} from '../api/catalog.api';

export function useCatalogAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['catalog', 'admin'],
    queryFn: listCatalogAdmin,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['catalog'] });
  };

  const create = useMutation({ mutationFn: createCatalog, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CatalogInput> }) =>
      updateCatalog(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteCatalog, onSuccess: invalidate });

  return { items: list.data ?? [] as CatalogItem[], isLoading: list.isLoading, create, update, remove };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/useCatalogAdmin.ts
git commit -m "feat(hardware-request/frontend): add useCatalogAdmin hook"
```

---

## Task 7.19: `RequiredFieldsBuilder` + test

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/catalog/RequiredFieldsBuilder.tsx`
- Test: `apps/frontend/src/features/hardware-request/components/__tests__/RequiredFieldsBuilder.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RequiredFieldsBuilder } from '../catalog/RequiredFieldsBuilder';

test('add field appends entry and calls onChange', () => {
  const onChange = vi.fn();
  render(<RequiredFieldsBuilder value={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /tambah field/i }));
  fireEvent.change(screen.getAllByLabelText(/field key/i)[0], { target: { value: 'brand' } });
  fireEvent.change(screen.getAllByLabelText(/label/i)[0], { target: { value: 'Brand' } });
  expect(onChange).toHaveBeenLastCalledWith([{ key: 'brand', label: 'Brand', type: 'text', required: true }]);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```tsx
import { useState, useEffect } from 'react';

export type RequiredField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
};

type Props = {
  value: RequiredField[];
  onChange: (v: RequiredField[]) => void;
};

export function RequiredFieldsBuilder({ value, onChange }: Props) {
  const [draft, setDraft] = useState<RequiredField[]>(value);
  useEffect(() => setDraft(value), [value]);

  const update = (idx: number, patch: Partial<RequiredField>) => {
    const next = draft.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setDraft(next);
    onChange(next);
  };
  const add = () => {
    const next = [...draft, { key: '', label: '', type: 'text' as const, required: true }];
    setDraft(next);
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {draft.map((f, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-md border p-2">
          <label className="col-span-3 text-xs">
            <span className="text-slate-600">Field key</span>
            <input
              aria-label="Field key"
              value={f.key}
              onChange={(e) => update(idx, { key: e.target.value.trim() })}
              className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
            />
          </label>
          <label className="col-span-3 text-xs">
            <span className="text-slate-600">Label</span>
            <input
              aria-label="Label"
              value={f.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
            />
          </label>
          <label className="col-span-2 text-xs">
            <span className="text-slate-600">Type</span>
            <select
              aria-label="Type"
              value={f.type}
              onChange={(e) => update(idx, { type: e.target.value as RequiredField['type'] })}
              className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="select">select</option>
            </select>
          </label>
          <label className="col-span-2 text-xs flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => update(idx, { required: e.target.checked })}
            />
            Required
          </label>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="col-span-2 text-xs text-rose-600 hover:underline"
          >
            Hapus
          </button>
          {f.type === 'select' && (
            <label className="col-span-12 text-xs">
              <span className="text-slate-600">Options (comma separated)</span>
              <input
                aria-label="Options"
                value={(f.options ?? []).join(', ')}
                onChange={(e) =>
                  update(idx, {
                    options: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
              />
            </label>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm px-3 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-700 hover:bg-slate-50"
      >
        + Tambah field
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/catalog/RequiredFieldsBuilder.tsx \
        apps/frontend/src/features/hardware-request/components/__tests__/RequiredFieldsBuilder.test.tsx
git commit -m "feat(hardware-request/frontend): add RequiredFieldsBuilder"
```

---

## Task 7.20: `CatalogEditModal`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/catalog/CatalogEditModal.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState, useEffect } from 'react';
import { RequiredFieldsBuilder, type RequiredField } from './RequiredFieldsBuilder';
import type { CatalogItem, CatalogInput } from '../../api/catalog.api';
import type { ItemCategory } from '../../types';

const categories: ItemCategory[] = ['LAPTOP', 'DESKTOP', 'MONITOR', 'PERIPHERAL', 'NETWORK', 'SOFTWARE', 'OTHER'];

type Props = {
  open: boolean;
  initial?: CatalogItem;
  onClose: () => void;
  onSubmit: (payload: CatalogInput) => Promise<void>;
  isSubmitting?: boolean;
};

export function CatalogEditModal({ open, initial, onClose, onSubmit, isSubmitting }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('LAPTOP');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState(0);
  const [fields, setFields] = useState<RequiredField[]>([]);

  useEffect(() => {
    if (initial) {
      setCode(initial.code);
      setName(initial.name);
      setCategory(initial.category);
      setActive(initial.isActive);
      setOrder(initial.displayOrder);
      setFields(initial.requiredFields ?? []);
    } else {
      setCode('');
      setName('');
      setCategory('LAPTOP');
      setActive(true);
      setOrder(0);
      setFields([]);
    }
  }, [initial, open]);

  if (!open) return null;

  const canSubmit = code.trim().length >= 2 && name.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-labelledby="cat-title" className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
        <h2 id="cat-title" className="text-lg font-semibold text-slate-900">
          {initial ? 'Edit Catalog Item' : 'Tambah Catalog Item'}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="text-slate-600">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono"
              disabled={!!initial}
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-600">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-slate-600">Display order</span>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="col-span-2 text-xs flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Active</span>
          </label>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-slate-700 mb-1">Required Fields</div>
          <RequiredFieldsBuilder value={fields} onChange={setFields} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-3 py-2 text-sm rounded-md border">
            Batal
          </button>
          <button
            onClick={() =>
              onSubmit({
                code: code.trim(),
                name: name.trim(),
                category,
                isActive: active,
                displayOrder: order,
                requiredFields: fields,
              })
            }
            disabled={!canSubmit || isSubmitting}
            className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/catalog/CatalogEditModal.tsx
git commit -m "feat(hardware-request/frontend): add CatalogEditModal"
```

---

## Task 7.21: `CatalogTable` + `CatalogAdminPage`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/catalog/CatalogTable.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/catalog/CatalogAdminPage.tsx`

- [ ] **Step 1: `CatalogTable.tsx`**

```tsx
import type { CatalogItem } from '../../api/catalog.api';

type Props = {
  items: CatalogItem[];
  onEdit: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
};

export function CatalogTable({ items, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Order</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
              <td className="px-3 py-2">{i.name}</td>
              <td className="px-3 py-2 text-xs">{i.category}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onToggleActive(i)}
                  className={[
                    'inline-flex h-6 w-11 items-center rounded-full transition',
                    i.isActive ? 'bg-emerald-500' : 'bg-slate-300',
                  ].join(' ')}
                  aria-pressed={i.isActive}
                  aria-label={`Toggle ${i.name}`}
                >
                  <span
                    className={[
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                      i.isActive ? 'translate-x-5' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              </td>
              <td className="px-3 py-2 text-xs">{i.displayOrder}</td>
              <td className="px-3 py-2 text-right text-xs space-x-2">
                <button onClick={() => onEdit(i)} className="text-indigo-600 hover:underline">Edit</button>
                <button onClick={() => onDelete(i)} className="text-rose-600 hover:underline">Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: `CatalogAdminPage.tsx`**

```tsx
import { useState } from 'react';
import { useCatalogAdmin } from '../../hooks/useCatalogAdmin';
import { usePermissions } from '../../hooks/usePermissions';
import { CatalogTable } from './CatalogTable';
import { CatalogEditModal } from './CatalogEditModal';
import type { CatalogItem } from '../../api/catalog.api';
import { toast } from '@/components/ui/toast';

export function CatalogAdminPage() {
  const { isIctLead } = usePermissions();
  const { items, isLoading, create, update, remove } = useCatalogAdmin();
  const [editing, setEditing] = useState<{ open: boolean; item?: CatalogItem }>({ open: false });

  if (!isIctLead) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Catalog Admin</h1>
        <button
          onClick={() => setEditing({ open: true })}
          className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          + Tambah Item
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <CatalogTable
          items={items}
          onEdit={(i) => setEditing({ open: true, item: i })}
          onToggleActive={async (i) => {
            try {
              await update.mutateAsync({ id: i.id, payload: { isActive: !i.isActive } });
              toast.success(`${i.name} ${i.isActive ? 'di-nonaktifkan' : 'diaktifkan'}.`);
            } catch (err) {
              toast.error('Gagal update: ' + (err as Error).message);
            }
          }}
          onDelete={async (i) => {
            if (!confirm(`Hapus "${i.name}"? Item akan di-soft delete.`)) return;
            try {
              await remove.mutateAsync(i.id);
              toast.success('Catalog item dihapus.');
            } catch (err) {
              toast.error('Gagal hapus: ' + (err as Error).message);
            }
          }}
        />
      )}

      <CatalogEditModal
        open={editing.open}
        initial={editing.item}
        isSubmitting={create.isPending || update.isPending}
        onClose={() => setEditing({ open: false })}
        onSubmit={async (payload) => {
          try {
            if (editing.item) {
              await update.mutateAsync({ id: editing.item.id, payload });
              toast.success('Catalog diperbarui.');
            } else {
              await create.mutateAsync(payload);
              toast.success('Catalog dibuat.');
            }
            setEditing({ open: false });
          } catch (err) {
            toast.error('Gagal simpan: ' + (err as Error).message);
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/catalog/CatalogTable.tsx \
        apps/frontend/src/features/hardware-request/components/catalog/CatalogAdminPage.tsx
git commit -m "feat(hardware-request/frontend): add CatalogAdminPage + CatalogTable"
```

---

## Task 7.22: Routes + Sidebar wiring

**Files:**
- Modify: `apps/frontend/src/app/routes.tsx`
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read current routes**

```bash
cat apps/frontend/src/app/routes.tsx | head -60
```

- [ ] **Step 2: Tambah 3 route di dalam authenticated layout**

```tsx
// import lazily untuk code-splitting
const InstallationCalendarPage = lazy(() =>
  import('@/features/hardware-request/components/calendar/InstallationCalendarPage').then((m) => ({
    default: m.InstallationCalendarPage,
  })),
);
const HardwareDashboardPage = lazy(() =>
  import('@/features/hardware-request/components/dashboard/HardwareDashboardPage').then((m) => ({
    default: m.HardwareDashboardPage,
  })),
);
const CatalogAdminPage = lazy(() =>
  import('@/features/hardware-request/components/catalog/CatalogAdminPage').then((m) => ({
    default: m.CatalogAdminPage,
  })),
);

// di dalam <Route path="hardware-requests">
<Route path="calendar" element={<RequireIct><InstallationCalendarPage /></RequireIct>} />
<Route path="dashboard" element={<RequireIct><HardwareDashboardPage /></RequireIct>} />
<Route path="catalog" element={<RequireIctLead><CatalogAdminPage /></RequireIctLead>} />
```

Jika `RequireIct`/`RequireIctLead` belum ada, gunakan guard sederhana berbasis `usePermissions` (sudah ditambahkan di Plan 6); jika belum, inline-check di masing-masing page (sudah).

- [ ] **Step 3: Sidebar entries**

Di `Sidebar.tsx`, di bawah item "Hardware Requests", tambah sub-items yang visible kondisional:

```tsx
const { isIctRole, isIctLead } = usePermissions();

{isIctRole && (
  <>
    <SidebarLink to="/hardware-requests/calendar" icon={<CalendarIcon />} label="Calendar" />
    <SidebarLink to="/hardware-requests/dashboard" icon={<DashboardIcon />} label="Dashboard" />
  </>
)}
{isIctLead && (
  <SidebarLink to="/hardware-requests/catalog" icon={<BoxIcon />} label="Catalog" />
)}
```

- [ ] **Step 4: Run dev + smoke test**

```bash
cd apps/frontend && pnpm dev
```

Navigate:
- `/hardware-requests/calendar` sebagai technician → render OK
- `/hardware-requests/dashboard` sebagai lead → KPIs render
- `/hardware-requests/catalog` sebagai lead → tabel render
- Sebagai USER, route-route tersebut harus tidak muncul di sidebar dan return "Akses ditolak" jika diakses langsung.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/routes.tsx apps/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(hardware-request/frontend): wire ICT pages to routes + sidebar"
```

---

## Task 7.23: Cross-cutting — Empty states + Error boundaries

**Files:**
- Modify: each page adds error fallback component

- [ ] **Step 1: Tambah `ErrorBoundary` wrap di routes**

Jika project sudah punya global `<ErrorBoundary>`, pastikan pages di atas di-wrap. Jika tidak, tambah lokal per page menggunakan `react-error-boundary` yang biasanya sudah dipakai.

```tsx
import { ErrorBoundary } from 'react-error-boundary';
function Fallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-8 text-center">
      <p className="text-sm text-rose-600">Terjadi kesalahan: {error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-2 text-sm text-indigo-600 hover:underline">
        Coba lagi
      </button>
    </div>
  );
}
```

Bungkus InstallationCalendarPage, HardwareDashboardPage, CatalogAdminPage dengan `<ErrorBoundary FallbackComponent={Fallback}>` masing-masing.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx \
        apps/frontend/src/features/hardware-request/components/dashboard/HardwareDashboardPage.tsx \
        apps/frontend/src/features/hardware-request/components/catalog/CatalogAdminPage.tsx
git commit -m "feat(hardware-request/frontend): add error boundaries for ICT pages"
```

---

## Task 7.24: Manual E2E smoke matrix

Bukan E2E otomatis (di luar scope plan ini), tapi mandatori sebelum close plan.

- [ ] **Step 1: Jalankan backend + frontend**

```bash
pnpm -w dev
```

- [ ] **Step 2: Lakukan smoke flow**

Login per-role, cek satu siklus lengkap:

- [ ] USER submit request (Plan 6 flow) → appears in ICT list
- [ ] ICT_LEAD approve → status APPROVED
- [ ] ICT_PROCUREMENT fill actual cost, mark complete → INSTALLATION
- [ ] USER propose schedule; TECHNICIAN confirm → event muncul di Calendar
- [ ] TECHNICIAN drag event di Calendar → reschedule modal muncul, submit, requester dapat notifikasi
- [ ] TECHNICIAN start install, buka detail → "Complete Installation" → scan barcode (atau input manual 3+ chars) per item → submit → request COMPLETED, asset muncul di item
- [ ] ICT_LEAD buka Dashboard → KPI update, Aging table update, Technician workload update
- [ ] ICT_LEAD buka Catalog, toggle aktif sebuah item → item tidak muncul di CatalogPicker (wizard new request) USER
- [ ] USER: sidebar tidak tampilkan Calendar/Dashboard/Catalog; akses langsung → "Akses ditolak"

Catat issue yang ditemukan di PR body; fix sebelum merge.

- [ ] **Step 3: Commit log**

Tidak ada code commit; tulis ringkasan hasil ke `docs/superpowers/notes/2026-04-17-hardware-request-smoke.md` (file baru, free-form).

```bash
git add docs/superpowers/notes/2026-04-17-hardware-request-smoke.md
git commit -m "docs(hardware-request): smoke test results for ICT pages"
```

---

## Verification Checklist (Plan 7)

- [ ] Semua route baru accessible per role sesuai permission spec
- [ ] Calendar: render events, drag-drop reschedule membuka modal dengan reason wajib ≥5 char, API rescheduleSchedule dipanggil, calendar invalidated
- [ ] Calendar: TechnicianFilter toggle mengubah event yang ditampilkan
- [ ] Calendar: UnscheduledList + MyTodayPanel render dan link ke detail
- [ ] Barcode: `BarcodeScannerModal` camera + manual fallback dua-duanya berfungsi; `CompleteInstallWizard` memvalidasi semua item punya asset code ≥3 char sebelum enable tombol submit
- [ ] Barcode: Duplicate asset code ditolak oleh backend (error ditampilkan di toast)
- [ ] Dashboard: 6 widget render, respect loading state, KPI refresh saat data berubah
- [ ] Catalog: create, update (termasuk `isActive` toggle), delete berfungsi; `RequiredFieldsBuilder` menyimpan struktur JSON sesuai spec (key/label/type/required/options)
- [ ] Sidebar: entries hanya muncul untuk role yang sesuai
- [ ] Error boundary menangkap runtime error per page tanpa crash seluruh app
- [ ] Typecheck PASS, lint PASS, vitest PASS
- [ ] Manual smoke matrix Task 7.24 selesai tanpa P0/P1 issue

---

## Post-Plan Alignment

Setelah plan 7 merged, feature hardware-request-v2 siap untuk soft cutover (spec §13 step 5). Follow-up items (spec §14) yang belum ditangani:
- Template email copy review oleh stakeholder
- Catalog seed final dari stakeholder ICT (Plan 5 sudah menyediakan seed awal — bisa diedit via Catalog Admin UI sekarang)
- E2E Playwright lengkap (bukan scope plan ini)
