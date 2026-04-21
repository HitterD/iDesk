# Hardware Requests Calendar — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign halaman `/hardware-requests/calendar` menjadi full-width calendar dengan agenda bottom drawer, stats header strip, dan badge panel buttons menggantikan sidebar permanen.

**Architecture:** FullCalendar full-width tanpa sidebar. Badge pill buttons di header (Today/Unscheduled) membuka panel slide-down. Klik event/tanggal membuka `AgendaBottomDrawer` dari bawah dengan horizontal scroll cards. Visual style Clean Light Enterprise.

**Tech Stack:** React 19, FullCalendar v6, TanStack React Query, Tailwind CSS v4, Vitest + React Testing Library, date-fns v4

---

## File Map

### Create
- `src/features/hardware-request/types/calendar.types.ts`
- `src/features/hardware-request/utils/__tests__/status.util.test.ts`
- `src/features/hardware-request/components/calendar/StatsStrip.tsx`
- `src/features/hardware-request/components/calendar/EventChipMedium.tsx`
- `src/features/hardware-request/components/calendar/BadgePanelButton.tsx`
- `src/features/hardware-request/components/calendar/AgendaBottomDrawer.tsx`
- `src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx`
- `src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx`
- `src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx`
- `src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx`

### Modify
- `src/features/hardware-request/utils/status.util.ts` — add `INSTALL_STATUS_CHIP`
- `src/features/hardware-request/components/calendar/TechnicianFilter.tsx` — restyle only
- `src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx` — restyle only
- `src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx` — major restructure
- `src/features/hardware-request/components/calendar/UserInstallationCalendar.tsx` — restyle

### Delete
- `src/features/hardware-request/components/calendar/EventPopover.tsx`
- `src/features/hardware-request/components/calendar/MyTodayPanel.tsx`
- `src/features/hardware-request/components/calendar/UnscheduledList.tsx`

> All paths relative to `apps/frontend/`.

---

### Task 1: Shared types + INSTALL_STATUS_CHIP

**Files:**
- Create: `apps/frontend/src/features/hardware-request/types/calendar.types.ts`
- Modify: `apps/frontend/src/features/hardware-request/utils/status.util.ts`
- Create: `apps/frontend/src/features/hardware-request/utils/__tests__/status.util.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/frontend/src/features/hardware-request/utils/__tests__/status.util.test.ts
import { INSTALL_STATUS_CHIP } from '../status.util';
import type { InstallStatus } from '../status.util';

const ALL: InstallStatus[] = [
  'PROPOSED','PROPOSED_AWAITING_USER','CONFIRMED',
  'IN_PROGRESS','DONE','RESCHEDULED','RESCHEDULE_REQUESTED','CANCELLED',
];

describe('INSTALL_STATUS_CHIP', () => {
  it('covers every InstallStatus', () => {
    ALL.forEach(s => expect(INSTALL_STATUS_CHIP[s]).toBeDefined());
  });
  it('each entry has required keys', () => {
    ALL.forEach(s => {
      const c = INSTALL_STATUS_CHIP[s];
      expect(c).toHaveProperty('bg');
      expect(c).toHaveProperty('border');
      expect(c).toHaveProperty('dot');
      expect(c).toHaveProperty('text');
      expect(c).toHaveProperty('badge');
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/utils/__tests__/status.util.test.ts
```

Expected: `INSTALL_STATUS_CHIP` not exported

- [ ] **Step 3: Create calendar.types.ts**

```ts
// apps/frontend/src/features/hardware-request/types/calendar.types.ts
export type CalendarEventData = {
  scheduleId: string;
  requestId: string;
  requestNumber: string;
  siteName: string;
  technicianName: string;
  recipientName?: string | null;
  division?: string | null;
  status: string;
  scheduledAt: string;
  endsAt?: string | null;
};
```

- [ ] **Step 4: Add INSTALL_STATUS_CHIP to status.util.ts** (append after `INSTALL_STATUS_META` block)

```ts
export const INSTALL_STATUS_CHIP: Record<InstallStatus, {
  bg: string; border: string; dot: string; text: string; badge: string;
}> = {
  PROPOSED:               { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', text: 'text-violet-900', badge: 'PRP'  },
  PROPOSED_AWAITING_USER: { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', text: 'text-violet-900', badge: 'PAU'  },
  CONFIRMED:              { bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   text: 'text-blue-900',   badge: 'CFM'  },
  IN_PROGRESS:            { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  text: 'text-amber-900',  badge: 'IP'   },
  DONE:                   { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  text: 'text-green-900',  badge: 'DONE' },
  RESCHEDULED:            { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-900',    badge: 'RSC'  },
  RESCHEDULE_REQUESTED:   { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-900',    badge: 'RRQ'  },
  CANCELLED:              { bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400',  text: 'text-slate-600',  badge: 'CXL'  },
};
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/utils/__tests__/status.util.test.ts
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/types/calendar.types.ts apps/frontend/src/features/hardware-request/utils/status.util.ts apps/frontend/src/features/hardware-request/utils/__tests__/status.util.test.ts
rtk git commit -m "feat: add CalendarEventData type and INSTALL_STATUS_CHIP colors"
```

---

### Task 2: StatsStrip component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/StatsStrip.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx
import { render, screen } from '@testing-library/react';
import { StatsStrip } from '../StatsStrip';

describe('StatsStrip', () => {
  it('renders all four stat values', () => {
    render(<StatsStrip scheduled={24} today={3} unscheduled={5} rescheduleRequested={2} />);
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders stat labels', () => {
    render(<StatsStrip scheduled={0} today={0} unscheduled={0} rescheduleRequested={0} />);
    expect(screen.getByText('Total Scheduled')).toBeInTheDocument();
    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
    expect(screen.getByText('Reschedule Req.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx
```

- [ ] **Step 3: Implement StatsStrip**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/StatsStrip.tsx
type Props = { scheduled: number; today: number; unscheduled: number; rescheduleRequested: number };

function StatCard({ value, label, valueClass, bgClass, borderClass }: {
  value: number; label: string; valueClass: string; bgClass: string; borderClass: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${bgClass} ${borderClass}`}>
      <span className={`text-base font-bold leading-none ${valueClass}`}>{value}</span>
      <span className="text-xs text-slate-500 leading-tight">{label}</span>
    </div>
  );
}

export function StatsStrip({ scheduled, today, unscheduled, rescheduleRequested }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatCard value={scheduled}           label="Total Scheduled"  valueClass="text-blue-600"  bgClass="bg-slate-50"  borderClass="border-slate-200" />
      <StatCard value={today}               label="Today's Schedule" valueClass="text-green-600" bgClass="bg-green-50"  borderClass="border-green-200" />
      <StatCard value={unscheduled}         label="Unscheduled"      valueClass="text-amber-600" bgClass="bg-amber-50"  borderClass="border-amber-200" />
      <StatCard value={rescheduleRequested} label="Reschedule Req."  valueClass="text-red-600"   bgClass="bg-red-50"    borderClass="border-red-200"   />
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/StatsStrip.tsx apps/frontend/src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx
rtk git commit -m "feat: add StatsStrip component"
```

---

### Task 3: EventChipMedium component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/EventChipMedium.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx
import { render, screen } from '@testing-library/react';
import { EventChipMedium } from '../EventChipMedium';
import type { CalendarEventData } from '../../../types/calendar.types';

const event: CalendarEventData = {
  scheduleId: 's1', requestId: 'r1', requestNumber: 'HR-2024-044',
  siteName: 'Gedung A', technicianName: 'Budi Santoso',
  status: 'CONFIRMED', scheduledAt: '2026-04-08T09:00:00.000Z',
};

describe('EventChipMedium', () => {
  it('renders request number', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText('HR-2024-044')).toBeInTheDocument();
  });
  it('renders technician name', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument();
  });
  it('renders abbreviated status badge for CONFIRMED', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText('CFM')).toBeInTheDocument();
  });
  it('falls back gracefully for unknown status', () => {
    render(<EventChipMedium event={{ ...event, status: 'UNKNOWN' }} />);
    expect(screen.getByText('HR-2024-044')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx
```

- [ ] **Step 3: Implement EventChipMedium**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/EventChipMedium.tsx
import { format, parseISO } from 'date-fns';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../../utils/status.util';
import type { CalendarEventData } from '../../../types/calendar.types';

type Props = { event: CalendarEventData };

export function EventChipMedium({ event }: Props) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  const time = format(parseISO(event.scheduledAt), 'HH:mm');

  return (
    <div className={`w-full rounded-md border px-1.5 py-1 cursor-pointer ${chip.bg} ${chip.border}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chip.dot}`} />
        <span className={`text-[10px] font-semibold truncate flex-1 ${chip.text}`}>{event.requestNumber}</span>
        <span className={`text-[8px] px-1 rounded-full border font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
      </div>
      <div className="text-[9px] text-slate-500 pl-2.5 truncate">{event.technicianName} · {time}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/EventChipMedium.tsx apps/frontend/src/features/hardware-request/components/calendar/__tests__/EventChipMedium.test.tsx
rtk git commit -m "feat: add EventChipMedium for FullCalendar event rendering"
```

---

### Task 4: BadgePanelButton component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/BadgePanelButton.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BadgePanelButton } from '../BadgePanelButton';

describe('BadgePanelButton', () => {
  it('renders label and count', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={() => {}}><div>content</div></BadgePanelButton>);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('hides children when closed', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={() => {}}><div>Panel content</div></BadgePanelButton>);
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });
  it('shows children when open', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={true} onToggle={() => {}}><div>Panel content</div></BadgePanelButton>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });
  it('calls onToggle on click', async () => {
    const onToggle = vi.fn();
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={onToggle}><div>x</div></BadgePanelButton>);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx
```

- [ ] **Step 3: Implement BadgePanelButton**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/BadgePanelButton.tsx
import type { ReactNode } from 'react';

type Variant = 'green' | 'amber' | 'red';
type Props = { label: string; count: number; variant: Variant; open: boolean; onToggle: () => void; children: ReactNode };

const V: Record<Variant, { pill: string; badge: string; border: string }> = {
  green: { pill: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100', badge: 'bg-green-500 text-white', border: 'border-t-2 border-green-500' },
  amber: { pill: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100', badge: 'bg-amber-500 text-white', border: 'border-t-2 border-amber-500' },
  red:   { pill: 'border-red-200   bg-red-50   text-red-800   hover:bg-red-100',   badge: 'bg-red-500   text-white', border: 'border-t-2 border-red-500'   },
};

export function BadgePanelButton({ label, count, variant, open, onToggle, children }: Props) {
  const s = V[variant];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${s.pill}`}
      >
        {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.badge}`}>{count}</span>
      </button>
      {open && (
        <div className={`absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl ${s.border}`}>
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/BadgePanelButton.tsx apps/frontend/src/features/hardware-request/components/calendar/__tests__/BadgePanelButton.test.tsx
rtk git commit -m "feat: add BadgePanelButton for Today/Unscheduled header panels"
```

---

### Task 5: AgendaBottomDrawer component

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/calendar/AgendaBottomDrawer.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AgendaBottomDrawer } from '../AgendaBottomDrawer';
import type { CalendarEventData } from '../../../types/calendar.types';

const events: CalendarEventData[] = [
  { scheduleId: 's1', requestId: 'r1', requestNumber: 'HR-044', siteName: 'Gedung A', technicianName: 'Budi', status: 'CONFIRMED',   scheduledAt: '2026-04-08T09:00:00.000Z' },
  { scheduleId: 's2', requestId: 'r2', requestNumber: 'HR-045', siteName: 'Gedung B', technicianName: 'Andi', status: 'IN_PROGRESS', scheduledAt: '2026-04-08T14:00:00.000Z' },
];
const wrap = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('AgendaBottomDrawer', () => {
  it('renders nothing when closed', () => {
    render(<AgendaBottomDrawer open={false} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={() => {}} />, { wrapper: wrap });
    expect(screen.queryByText('HR-044')).not.toBeInTheDocument();
  });
  it('renders events when open', () => {
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={() => {}} />, { wrapper: wrap });
    expect(screen.getByText('HR-044')).toBeInTheDocument();
    expect(screen.getByText('HR-045')).toBeInTheDocument();
  });
  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={onClose} />, { wrapper: wrap });
    await userEvent.click(screen.getByRole('button', { name: /tutup/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('calls onSelectEvent when compact card clicked', async () => {
    const onSelectEvent = vi.fn();
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId="s1" onSelectEvent={onSelectEvent} onClose={() => {}} />, { wrapper: wrap });
    await userEvent.click(screen.getByText('HR-045'));
    expect(onSelectEvent).toHaveBeenCalledWith('s2');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx
```

- [ ] **Step 3: Implement AgendaBottomDrawer**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/AgendaBottomDrawer.tsx
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../../utils/status.util';
import { useHardwareBasePath } from '../../../hooks/useHardwareBasePath';
import type { CalendarEventData } from '../../../types/calendar.types';

type Props = {
  open: boolean;
  date: Date | null;
  events: CalendarEventData[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onClose: () => void;
};

function ExpandedCard({ event, basePath }: { event: CalendarEventData; basePath: string }) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  return (
    <div className={`min-w-[220px] flex-shrink-0 rounded-xl border-2 border-blue-400 p-3 bg-white shadow-md`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold ${chip.text}`}>{event.requestNumber}</span>
        <span className={`text-[9px] rounded-full border px-1.5 font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
      </div>
      <div className="text-[10px] text-slate-600 space-y-0.5 mb-3">
        <div>🏢 {event.siteName}</div>
        <div>👷 {event.technicianName} · {format(parseISO(event.scheduledAt), 'HH:mm')}</div>
        {event.recipientName && <div>👤 {event.recipientName}{event.division ? ` / ${event.division}` : ''}</div>}
      </div>
      <Link
        to={`${basePath}/${event.requestId}`}
        className="block w-full rounded-md border border-slate-200 bg-slate-50 py-1 text-center text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
      >
        Detail →
      </Link>
    </div>
  );
}

function CompactCard({ event, onSelect }: { event: CalendarEventData; onSelect: () => void }) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="min-w-[160px] flex-shrink-0 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${chip.dot}`} />
        <span className="text-[10px] font-semibold text-slate-800">{event.requestNumber}</span>
      </div>
      <div className="text-[9px] text-slate-500 pl-3.5 space-y-0.5">
        <div>{event.technicianName}</div>
        <div>{format(parseISO(event.scheduledAt), 'HH:mm')} · {event.siteName}</div>
      </div>
      <div className="mt-2 text-[9px] text-blue-500 pl-3.5">Klik untuk detail ▸</div>
    </button>
  );
}

export function AgendaBottomDrawer({ open, date, events, selectedEventId, onSelectEvent, onClose }: Props) {
  const basePath = useHardwareBasePath();
  if (!open || !date) return null;

  return (
    <div className="border-t-2 border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-center pt-1.5 pb-1">
        <div className="w-8 h-0.5 rounded-full bg-slate-300" />
      </div>
      <div className="flex items-center justify-between px-4 pb-2">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-slate-500">{events.length} instalasi terjadwal</div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          ✕ Tutup
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4">
        {events.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Tidak ada instalasi pada tanggal ini.</p>
        ) : (
          events.map(e =>
            e.scheduleId === selectedEventId
              ? <ExpandedCard key={e.scheduleId} event={e} basePath={basePath} />
              : <CompactCard  key={e.scheduleId} event={e} onSelect={() => onSelectEvent(e.scheduleId)} />
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/AgendaBottomDrawer.tsx apps/frontend/src/features/hardware-request/components/calendar/__tests__/AgendaBottomDrawer.test.tsx
rtk git commit -m "feat: add AgendaBottomDrawer replacing EventPopover"
```

---

### Task 6: TechnicianFilter restyle

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx`

Logic unchanged. Only Tailwind classes updated.

- [ ] **Step 1: Replace file content**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchTechnicians } from '../../api/installation.api';

type Props = { selectedIds: string[]; onChange: (ids: string[]) => void };

export function TechnicianFilter({ selectedIds, onChange }: Props) {
  const { data: technicians = [] } = useQuery({
    queryKey: ['hardware-requests', 'technicians'],
    queryFn: fetchTechnicians,
    staleTime: 5 * 60_000,
  });

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500 flex-shrink-0">Filter teknisi:</span>
      {technicians.map((t: { id: string; fullName: string }) => {
        const active = selectedIds.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            aria-pressed={active}
            className={[
              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {t.fullName}
            {active && <span className="text-blue-400 leading-none ml-0.5">×</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/frontend && rtk tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx
rtk git commit -m "feat: restyle TechnicianFilter to clean light chip pills"
```

---

### Task 7: RescheduleConfirmModal restyle

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx`

Logic/props unchanged. Only styles updated.

- [ ] **Step 1: Replace file content**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx
import { useState } from 'react';
import { format, parseISO } from 'date-fns';

type Props = {
  open: boolean; from: string; to: string; requestNumber: string;
  onConfirm: (reason: string) => void; onCancel: () => void; isSubmitting?: boolean;
};

export function RescheduleConfirmModal({ open, from, to, requestNumber, onConfirm, onCancel, isSubmitting }: Props) {
  const [reason, setReason] = useState('');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-labelledby="resched-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-lg">📅</div>
          <div>
            <h2 id="resched-title" className="text-sm font-bold text-slate-900">Konfirmasi Reschedule</h2>
            <p className="text-xs text-slate-500 font-mono">{requestNumber}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Dari:</span>
            <span className="font-semibold line-through text-slate-400">{format(parseISO(from), 'dd MMM yyyy · HH:mm')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Ke:</span>
            <span className="font-semibold text-green-600">{format(parseISO(to), 'dd MMM yyyy · HH:mm')}</span>
          </div>
        </div>
        <label className="block mb-4">
          <span className="text-xs font-semibold text-slate-700">Alasan reschedule <span className="text-red-500">*</span></span>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Mis. teknisi tidak tersedia pada tanggal tersebut"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button" onClick={onCancel} disabled={isSubmitting}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button" onClick={() => onConfirm(reason.trim())}
            disabled={isSubmitting || reason.trim().length < 5}
            className="flex-1 rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses…' : '✓ Konfirmasi Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/frontend && rtk tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/RescheduleConfirmModal.tsx
rtk git commit -m "feat: restyle RescheduleConfirmModal to clean light design"
```

---

### Task 8: InstallationCalendarPage major restructure

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx`

- [ ] **Step 1: Read full current file before editing**

```bash
cd apps/frontend && cat src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx
```

- [ ] **Step 2: Replace with new implementation**

```tsx
// apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx
import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, isSameDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useInstallationCalendar } from '../../hooks/useInstallationCalendar';
import { usePermissions } from '../../hooks/usePermissions';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { TechnicianFilter } from './TechnicianFilter';
import { StatsStrip } from './StatsStrip';
import { BadgePanelButton } from './BadgePanelButton';
import { EventChipMedium } from './EventChipMedium';
import { AgendaBottomDrawer } from './AgendaBottomDrawer';
import { RescheduleConfirmModal } from './RescheduleConfirmModal';
import { UserInstallationCalendar } from './UserInstallationCalendar';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';
import { fetchMyTodaySchedules, fetchUnscheduledRequests } from '../../api/installation.api';
import type { CalendarEventData } from '../../types/calendar.types';

type TodaySchedule = { id: string; requestId: string; scheduledAt: string; siteName: string; requestNumber: string };
type UnscheduledRequest = { id: string; requestNumber: string; siteName: string; createdAt?: string };

function TodayPanelContent() {
  const basePath = useHardwareBasePath();
  const { data = [], isLoading } = useQuery<TodaySchedule[]>({
    queryKey: ['hardware-requests', 'my-today'],
    queryFn: fetchMyTodaySchedules,
    staleTime: 30_000,
  });
  return (
    <div className="p-3">
      <div className="text-xs font-bold text-green-700 mb-2">Jadwal Hari Ini</div>
      {isLoading ? (
        <div className="space-y-1.5">{[1,2].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : data.length > 0 ? (
        <ul className="space-y-1.5">
          {data.map(s => (
            <li key={s.id}>
              <Link to={`${basePath}/${s.requestId}`} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-2.5 py-1.5 hover:bg-green-100 transition-colors">
                <span className="text-xs font-bold text-green-700">{format(parseISO(s.scheduledAt), 'HH:mm')}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{s.siteName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{s.requestNumber}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Tidak ada jadwal hari ini.</p>
      )}
    </div>
  );
}

const OVERDUE_DAYS = 7;

function UnscheduledPanelContent() {
  const basePath = useHardwareBasePath();
  const { data = [], isLoading } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });
  const now = new Date();
  return (
    <div className="p-3">
      <div className="text-xs font-bold text-amber-700 mb-2">Request Belum Terjadwal</div>
      {isLoading ? (
        <div className="space-y-1.5">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : data.length > 0 ? (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {data.map(r => {
            const overdue = r.createdAt
              ? (now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000 > OVERDUE_DAYS
              : false;
            return (
              <li key={r.id} className={`rounded-lg border px-2.5 py-1.5 ${overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                <Link to={`${basePath}/${r.id}`} className="block min-w-0">
                  <div className={`text-xs font-semibold truncate ${overdue ? 'text-red-800' : 'text-amber-800'}`}>
                    {r.requestNumber}{overdue ? ' ⚠' : ''}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{r.siteName}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Semua request sudah terjadwal.</p>
      )}
    </div>
  );
}

export function InstallationCalendarPage() {
  const { isIctRole, isIctStaff } = usePermissions();
  const [range, setRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    };
  });
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [activeBadgePanel, setActiveBadgePanel] = useState<'today' | 'unscheduled' | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerDate, setDrawerDate]   = useState<Date | null>(null);
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    requestId: string; requestNumber: string; from: string; to: string; revert: () => void;
  } | null>(null);

  const { events, reschedule } = useInstallationCalendar({ ...range, technicianIds });

  const { data: unscheduled = [] } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });

  const today = new Date();

  const stats = useMemo(() => ({
    scheduled:            events.length,
    today:                events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), today)).length,
    rescheduleRequested:  events.filter((e: CalendarEventData) => e.status === 'RESCHEDULE_REQUESTED').length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events]);

  const drawerEvents = useMemo(() =>
    drawerDate ? events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), drawerDate)) : [],
    [events, drawerDate],
  );

  const fcEvents = useMemo(() =>
    events.map((e: CalendarEventData) => ({
      id: e.scheduleId,
      title: e.requestNumber,
      start: e.scheduledAt,
      end: e.endsAt ?? undefined,
      editable: isIctStaff,
      extendedProps: e,
    })),
    [events, isIctStaff],
  );

  if (!isIctRole) return <UserInstallationCalendar />;

  const toggleBadge = (panel: 'today' | 'unscheduled') =>
    setActiveBadgePanel(p => p === panel ? null : panel);

  const openDrawer = (date: Date, eventId: string | null) => {
    setDrawerDate(date);
    setDrawerEventId(eventId);
    setDrawerOpen(true);
    setActiveBadgePanel(null);
  };

  return (
    <FeatureErrorBoundary>
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-2 space-y-2.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-slate-900">Installation Calendar</h1>
              <p className="text-xs text-slate-500">Jadwal instalasi hardware · drag untuk reschedule</p>
            </div>
            <div className="flex items-center gap-2">
              <BadgePanelButton label="Today" count={stats.today} variant="green" open={activeBadgePanel === 'today'} onToggle={() => toggleBadge('today')}>
                <TodayPanelContent />
              </BadgePanelButton>
              <BadgePanelButton label="Unscheduled" count={unscheduled.length} variant="amber" open={activeBadgePanel === 'unscheduled'} onToggle={() => toggleBadge('unscheduled')}>
                <UnscheduledPanelContent />
              </BadgePanelButton>
            </div>
          </div>
          <StatsStrip scheduled={stats.scheduled} today={stats.today} unscheduled={unscheduled.length} rescheduleRequested={stats.rescheduleRequested} />
          <TechnicianFilter selectedIds={technicianIds} onChange={setTechnicianIds} />
        </div>

        {/* Full-width calendar */}
        <div className="flex-1 overflow-auto bg-white px-4 pt-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={fcEvents}
            eventContent={info => <EventChipMedium event={info.event.extendedProps as CalendarEventData} />}
            eventClick={info => openDrawer(info.event.start ?? new Date(), info.event.id)}
            dateClick={info => openDrawer(info.date, null)}
            editable={isIctStaff}
            eventDrop={info => {
              const e = info.event.extendedProps as CalendarEventData;
              setPendingReschedule({
                requestId: e.requestId,
                requestNumber: e.requestNumber,
                from: e.scheduledAt,
                to: info.event.start?.toISOString() ?? e.scheduledAt,
                revert: info.revert,
              });
            }}
            datesSet={info => setRange({ from: info.startStr, to: info.endStr })}
            height="auto"
          />
        </div>

        {/* Bottom drawer */}
        <AgendaBottomDrawer
          open={drawerOpen}
          date={drawerDate}
          events={drawerEvents}
          selectedEventId={drawerEventId}
          onSelectEvent={setDrawerEventId}
          onClose={() => setDrawerOpen(false)}
        />

        <RescheduleConfirmModal
          open={!!pendingReschedule}
          from={pendingReschedule?.from ?? ''}
          to={pendingReschedule?.to ?? ''}
          requestNumber={pendingReschedule?.requestNumber ?? ''}
          onCancel={() => { pendingReschedule?.revert(); setPendingReschedule(null); }}
          onConfirm={async reason => {
            if (!pendingReschedule) return;
            try {
              await reschedule({ requestId: pendingReschedule.requestId, proposedAt: pendingReschedule.to, reason });
            } catch {
              pendingReschedule.revert();
            } finally {
              setPendingReschedule(null);
            }
          }}
        />
      </div>
    </FeatureErrorBoundary>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/frontend && rtk tsc --noEmit
```

Fix any type errors before continuing. Common issues: `reschedule` call signature may differ — check `useInstallationCalendar` return type and adjust accordingly.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx
rtk git commit -m "feat: restructure InstallationCalendarPage to full-width calendar + bottom drawer"
```

---

### Task 9: UserInstallationCalendar restyle

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/UserInstallationCalendar.tsx`

- [ ] **Step 1: Read current file**

```bash
cd apps/frontend && cat src/features/hardware-request/components/calendar/UserInstallationCalendar.tsx
```

- [ ] **Step 2: Restyle info banner, legend, and upcoming list**

Key changes to apply after reading the file:
- Info banner: `bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3`
- Status legend: change from block list to `flex flex-wrap gap-2` with colored dots per status using `INSTALL_STATUS_CHIP`
- Upcoming events: `border-l-4` style using status color, card layout with `bg-white rounded-lg shadow-sm`
- Calendar `eventContent`: use `<EventChipMedium />` (read-only, `editable={false}`)

Import `INSTALL_STATUS_CHIP` and `EventChipMedium` at the top of the file.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/frontend && rtk tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/hardware-request/components/calendar/UserInstallationCalendar.tsx
rtk git commit -m "feat: restyle UserInstallationCalendar to clean light design"
```

---

### Task 10: Delete obsolete files + final check

**Files:**
- Delete: `EventPopover.tsx`, `MyTodayPanel.tsx`, `UnscheduledList.tsx`

- [ ] **Step 1: Delete files**

```bash
rm apps/frontend/src/features/hardware-request/components/calendar/EventPopover.tsx
rm apps/frontend/src/features/hardware-request/components/calendar/MyTodayPanel.tsx
rm apps/frontend/src/features/hardware-request/components/calendar/UnscheduledList.tsx
```

- [ ] **Step 2: TypeScript check — must be zero errors**

```bash
cd apps/frontend && rtk tsc --noEmit
```

If errors: check for remaining imports of deleted files and remove them.

- [ ] **Step 3: Run all feature tests**

```bash
cd apps/frontend && rtk vitest run src/features/hardware-request
```

Expected: all tests pass

- [ ] **Step 4: Run dev server and smoke test**

```bash
cd apps/frontend && pnpm dev
```

Manual checks:
1. Navigate to `/hardware-requests/calendar`
2. Stats strip tampil dengan 4 angka
3. Badge "Today" klik → panel muncul
4. Badge "Unscheduled" klik → panel muncul, only one panel open at a time
5. Klik event di calendar → bottom drawer slide-up, event selected expanded
6. Klik event compact di drawer → swap ke expanded
7. Drag event ke tanggal lain → RescheduleConfirmModal muncul
8. Non-ICT user → UserInstallationCalendar tampil

- [ ] **Step 5: Final commit**

```bash
rtk git add -A
rtk git commit -m "feat: delete obsolete EventPopover, MyTodayPanel, UnscheduledList"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|------------------|------|
| Full-width calendar, no permanent sidebar | Task 8 |
| Stats strip (scheduled/today/unscheduled/reschedule) | Tasks 2, 8 |
| Badge pills → Today/Unscheduled panel | Tasks 4, 8 |
| Overdue detection (>7 days unscheduled) | Task 8 (UnscheduledPanelContent) |
| Event chip medium card (HR number + technician + time + status) | Tasks 3, 8 |
| Technician filter as chip pills | Task 6 |
| Bottom drawer on event/date click | Tasks 5, 8 |
| Expanded/compact event cards in drawer | Task 5 |
| Reschedule modal restyle | Task 7 |
| User view restyle | Task 9 |
| INSTALL_STATUS_CHIP colors | Task 1 |
| Delete old files | Task 10 |
| `CalendarEventData` type moved out of EventPopover | Task 1 |
