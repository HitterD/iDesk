# Hardware Requests Overhaul — Plan 2: Frontend Workflow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build FE workflow components matching backend v2: per-item procurement APPROVE/REJECT, delivery board, mutual scheduling modals, comments un-block, item types update.

**Architecture:** React 18, TanStack Query, framer-motion. Hooks layer for mutations. Components per workflow slice (procurement / delivery / scheduling). Existing patterns from `SectionCard`, `EmptyState`, `StatusBadge`.

**Tech Stack:** React, TypeScript, TanStack Query v5, Vitest + React Testing Library, framer-motion, sonner toast, Tailwind, Radix UI.

**Spec:** `docs/superpowers/specs/2026-04-19-hardware-requests-workflow-overhaul-design.md`
**Depends on:** Plan 1 (backend) merged.

**Test command:**
```bash
pnpm --filter frontend test -- --no-threads
```

---

## Task 1: Types Update

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/types/index.ts`

- [ ] **Step 1: Read existing types**

```bash
cat apps/frontend/src/features/hardware-request/types/index.ts | head -100
```

- [ ] **Step 2: Update types**

```typescript
// Status request — add AWAITING_DELIVERY
export type RequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'REVIEW' | 'APPROVED'
  | 'PROCUREMENT' | 'AWAITING_DELIVERY' | 'INSTALLATION'
  | 'DONE' | 'REJECTED' | 'CANCELLED';

// Item delivery
export type ItemDeliveryStatus = 'PENDING' | 'ARRIVED' | 'NOT_PROCURED';
export type ItemProcurementDecision = 'APPROVED' | 'REJECTED';

export interface HardwareRequestItem {
  id: string;
  requestId: string;
  catalogId: string;
  name: string;
  qty: number;
  deliveryStatus: ItemDeliveryStatus;
  arrivedAt?: string | null;
  procurementDecision?: ItemProcurementDecision | null;
  procurementDecidedAt?: string | null;
  procurementDecidedBy?: string | null;
}

// Schedule extension
export type ScheduleStatus =
  | 'PROPOSED' | 'PROPOSED_AWAITING_USER' | 'CONFIRMED'
  | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED'
  | 'RESCHEDULE_REQUESTED' | 'CANCELLED';

export interface SlotProposal {
  start: string;
  end: string;
}

export interface InstallationSchedule {
  id: string;
  requestId: string;
  technicianId: string;
  technician?: { id: string; fullName: string };
  status: ScheduleStatus;
  proposedSlots?: SlotProposal[] | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  selectedSlotAt?: string | null;
  rescheduleCount: number;
  rescheduleReason?: string | null;
  itemIds?: string[];
}

// DTOs
export interface ProcurementDecisionInput {
  decisions: Array<{ itemId: string; decision: ItemProcurementDecision }>;
  note?: string;
}
export interface ProcurementCompleteInput { rejectReason?: string }
export interface ItemDeliveryInput { status: 'ARRIVED' | 'PENDING' }
export interface ScheduleProposeInput {
  itemIds: string[];
  technicianId: string;
  slots: SlotProposal[];
  note?: string;
}
export interface SelectSlotInput { slotIndex: number }
export interface RequestRescheduleInput { reason: string }
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/hardware-request/types/index.ts
git commit -m "feat(hr-fe): types for v2 workflow (delivery, mutual scheduling, decisions)"
```

---

## Task 2: API Client Extension

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/api/hardware-request.api.ts`
- Modify: `apps/frontend/src/features/hardware-request/api/installation.api.ts`

- [ ] **Step 1: Add procurement API**

```typescript
// hardware-request.api.ts
export async function decideProcurementItems(
  requestId: string,
  input: ProcurementDecisionInput,
): Promise<HardwareRequestItem[]> {
  const res = await apiClient.post(`/hardware-requests/${requestId}/procurement/decision`, input);
  return res.data.data;
}

export async function completeProcurement(
  requestId: string,
  input: ProcurementCompleteInput,
): Promise<HardwareRequest> {
  const res = await apiClient.post(`/hardware-requests/${requestId}/procurement/complete`, input);
  return res.data.data;
}
```

- [ ] **Step 2: Add delivery + scheduling API**

```typescript
// installation.api.ts
export async function updateItemDelivery(
  requestId: string,
  itemId: string,
  input: ItemDeliveryInput,
): Promise<HardwareRequestItem> {
  const res = await apiClient.patch(
    `/hardware-requests/${requestId}/items/${itemId}/delivery`,
    input,
  );
  return res.data.data;
}

export async function proposeSchedule(
  requestId: string,
  input: ScheduleProposeInput,
): Promise<InstallationSchedule> {
  const res = await apiClient.post(`/hardware-requests/${requestId}/schedule/propose`, input);
  return res.data.data;
}

export async function selectScheduleSlot(
  requestId: string,
  scheduleId: string,
  input: SelectSlotInput,
): Promise<InstallationSchedule> {
  const res = await apiClient.post(
    `/hardware-requests/${requestId}/schedule/${scheduleId}/select-slot`,
    input,
  );
  return res.data.data;
}

export async function requestReschedule(
  requestId: string,
  scheduleId: string,
  input: RequestRescheduleInput,
): Promise<InstallationSchedule> {
  const res = await apiClient.post(
    `/hardware-requests/${requestId}/schedule/${scheduleId}/request-reschedule`,
    input,
  );
  return res.data.data;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/hardware-request/api/
git commit -m "feat(hr-fe): API client for procurement/delivery/mutual-scheduling endpoints"
```

---

## Task 3: Permission Util Update

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- Modify: `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`

- [ ] **Step 1: Add helpers + remove status guard for comments**

```typescript
import type { HardwareRequest, RequestStatus } from '../types';

interface User {
  id: string;
  role: 'USER' | 'ICT_STAFF';
}

export function canComment(user: User, req: HardwareRequest): boolean {
  if (!user) return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.userId === user.id; // USER own only, all status
}

export function canDecideProcurement(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF' && req.status === 'PROCUREMENT';
}

export function canUpdateDelivery(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF'
    && (req.status === 'AWAITING_DELIVERY' || req.status === 'INSTALLATION');
}

export function canProposeSchedule(user: User, req: HardwareRequest): boolean {
  return user.role === 'ICT_STAFF'
    && (req.status === 'AWAITING_DELIVERY' || req.status === 'INSTALLATION')
    && req.items.some((i) => i.deliveryStatus === 'ARRIVED');
}

export function canSelectSlot(user: User, req: HardwareRequest, scheduleStatus: string): boolean {
  if (scheduleStatus !== 'PROPOSED_AWAITING_USER') return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.userId === user.id;
}

export function canRequestReschedule(user: User, req: HardwareRequest, scheduleStatus: string): boolean {
  if (!['PROPOSED_AWAITING_USER', 'CONFIRMED'].includes(scheduleStatus)) return false;
  if (user.role === 'ICT_STAFF') return true;
  return req.userId === user.id;
}
```

- [ ] **Step 2: Tests**

```typescript
import { canComment, canDecideProcurement, canUpdateDelivery, canProposeSchedule } from '../permission.util';

describe('permission.util — v2 helpers', () => {
  const ictUser = { id: 'ict-1', role: 'ICT_STAFF' as const };
  const ownerUser = { id: 'u-1', role: 'USER' as const };
  const otherUser = { id: 'u-2', role: 'USER' as const };
  const baseReq = { id: 'r1', userId: 'u-1', items: [] } as any;

  describe('canComment — all statuses', () => {
    const statuses = ['DRAFT','SUBMITTED','REVIEW','APPROVED','PROCUREMENT',
                      'AWAITING_DELIVERY','INSTALLATION','DONE','REJECTED','CANCELLED'];
    statuses.forEach((s) => {
      it(`ICT_STAFF can comment in ${s}`, () => {
        expect(canComment(ictUser, { ...baseReq, status: s })).toBe(true);
      });
      it(`USER owner can comment in ${s}`, () => {
        expect(canComment(ownerUser, { ...baseReq, status: s })).toBe(true);
      });
      it(`USER non-owner cannot comment in ${s}`, () => {
        expect(canComment(otherUser, { ...baseReq, status: s })).toBe(false);
      });
    });
  });

  it('canDecideProcurement only ICT in PROCUREMENT', () => {
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(true);
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'APPROVED' })).toBe(false);
    expect(canDecideProcurement(ownerUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(false);
  });

  it('canUpdateDelivery only ICT in AWAITING_DELIVERY|INSTALLATION', () => {
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY' })).toBe(true);
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'INSTALLATION' })).toBe(true);
    expect(canUpdateDelivery(ictUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(false);
    expect(canUpdateDelivery(ownerUser, { ...baseReq, status: 'AWAITING_DELIVERY' })).toBe(false);
  });

  it('canProposeSchedule requires ≥1 item ARRIVED', () => {
    const items = [{ deliveryStatus: 'PENDING' }, { deliveryStatus: 'ARRIVED' }];
    expect(canProposeSchedule(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY', items })).toBe(true);

    const allPending = [{ deliveryStatus: 'PENDING' }, { deliveryStatus: 'PENDING' }];
    expect(canProposeSchedule(ictUser, { ...baseReq, status: 'AWAITING_DELIVERY', items: allPending })).toBe(false);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads permission.util.test
git add apps/frontend/src/features/hardware-request/utils/
git commit -m "feat(hr-fe): permission helpers for v2 (canComment all-status, canDecideProcurement, etc.)"
```

---

## Task 4: Hook — `useProcurementDecision`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useProcurementDecision.ts`
- Create: `apps/frontend/src/features/hardware-request/hooks/__tests__/useProcurementDecision.test.tsx`

- [ ] **Step 1: Failing test**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProcurementDecision } from '../useProcurementDecision';
import * as api from '../../api/hardware-request.api';

vi.mock('../../api/hardware-request.api');

describe('useProcurementDecision', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  it('decideItems calls API + invalidates query', async () => {
    (api.decideProcurementItems as any).mockResolvedValue([{ id: 'i1' }]);
    const { result } = renderHook(() => useProcurementDecision('r1'), { wrapper });

    await act(async () => {
      await result.current.decide({ decisions: [{ itemId: 'i1', decision: 'APPROVED' }] });
    });

    expect(api.decideProcurementItems).toHaveBeenCalledWith('r1', expect.any(Object));
  });

  it('completeProcurement triggers status transition', async () => {
    (api.completeProcurement as any).mockResolvedValue({ id: 'r1', status: 'AWAITING_DELIVERY' });
    const { result } = renderHook(() => useProcurementDecision('r1'), { wrapper });

    await act(async () => {
      await result.current.complete({});
    });

    expect(api.completeProcurement).toHaveBeenCalledWith('r1', {});
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  decideProcurementItems,
  completeProcurement,
} from '../api/hardware-request.api';
import type { ProcurementDecisionInput, ProcurementCompleteInput } from '../types';

export function useProcurementDecision(requestId: string) {
  const qc = useQueryClient();

  const decideMutation = useMutation({
    mutationFn: (input: ProcurementDecisionInput) =>
      decideProcurementItems(requestId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
      toast.success('Keputusan procurement disimpan');
    },
    onError: (err: Error) => toast.error(`Gagal simpan: ${err.message}`),
  });

  const completeMutation = useMutation({
    mutationFn: (input: ProcurementCompleteInput) =>
      completeProcurement(requestId, input),
    onSuccess: (req) => {
      qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
      qc.invalidateQueries({ queryKey: ['hardware-requests'] });
      toast.success(
        req.status === 'AWAITING_DELIVERY'
          ? 'Procurement selesai. Menunggu kedatangan barang.'
          : 'Procurement ditolak.',
      );
    },
    onError: (err: Error) => toast.error(`Gagal selesaikan: ${err.message}`),
  });

  return {
    decide: decideMutation.mutateAsync,
    complete: completeMutation.mutateAsync,
    isDeciding: decideMutation.isPending,
    isCompleting: completeMutation.isPending,
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads useProcurementDecision
git add apps/frontend/src/features/hardware-request/hooks/useProcurementDecision.ts \
        apps/frontend/src/features/hardware-request/hooks/__tests__/useProcurementDecision.test.tsx
git commit -m "feat(hr-fe): useProcurementDecision hook"
```

---

## Task 5: Component — `ItemDecisionList`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/procurement/ItemDecisionList.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/procurement/__tests__/ItemDecisionList.test.tsx`

- [ ] **Step 1: Failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemDecisionList } from '../ItemDecisionList';

const items = [
  { id: 'i1', name: 'Monitor', qty: 2, procurementDecision: null },
  { id: 'i2', name: 'Keyboard', qty: 5, procurementDecision: 'APPROVED' as const },
];

describe('<ItemDecisionList>', () => {
  it('renders items + decision buttons', () => {
    render(<ItemDecisionList items={items as any} onChange={vi.fn()} />);
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(2);
  });

  it('calls onChange with APPROVED when ✓ clicked', async () => {
    const onChange = vi.fn();
    render(<ItemDecisionList items={items as any} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);
    expect(onChange).toHaveBeenCalledWith('i1', 'APPROVED');
  });

  it('marks pre-decided item with active state', () => {
    render(<ItemDecisionList items={items as any} onChange={vi.fn()} />);
    const approveBtns = screen.getAllByRole('button', { name: /approve/i });
    expect(approveBtns[1]).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { HardwareRequestItem, ItemProcurementDecision } from '../../types';
import { cn } from '@/lib/utils';

interface ItemDecisionListProps {
  items: HardwareRequestItem[];
  decisions?: Record<string, ItemProcurementDecision | null>;
  onChange: (itemId: string, decision: ItemProcurementDecision) => void;
  disabled?: boolean;
}

export function ItemDecisionList({ items, decisions, onChange, disabled }: ItemDecisionListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const current = decisions?.[item.id] ?? item.procurementDecision ?? null;
        return (
          <motion.div
            key={item.id}
            layout
            className={cn(
              'flex items-center justify-between rounded-2xl border bg-card/80 px-4 py-3 transition-colors backdrop-blur',
              current === 'APPROVED' && 'border-l-4 border-l-success border-success/40',
              current === 'REJECTED' && 'border-l-4 border-l-destructive border-destructive/40 opacity-70',
              !current && 'border-border/40',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">qty: {item.qty}</p>
            </div>
            <div className="flex items-center gap-2">
              <DecisionButton
                label="approve"
                active={current === 'APPROVED'}
                color="success"
                onClick={() => onChange(item.id, 'APPROVED')}
                disabled={disabled}
              >
                <Check className="h-4 w-4" />
              </DecisionButton>
              <DecisionButton
                label="reject"
                active={current === 'REJECTED'}
                color="destructive"
                onClick={() => onChange(item.id, 'REJECTED')}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </DecisionButton>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

interface DecisionButtonProps {
  label: string;
  active: boolean;
  color: 'success' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function DecisionButton({ label, active, color, onClick, disabled, children }: DecisionButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      role="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
        active && color === 'success' && 'border-success bg-success text-success-foreground',
        active && color === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
        !active && 'border-border/40 bg-background hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads ItemDecisionList
git add apps/frontend/src/features/hardware-request/components/procurement/ItemDecisionList.tsx \
        apps/frontend/src/features/hardware-request/components/procurement/__tests__/ItemDecisionList.test.tsx
git commit -m "feat(hr-fe): ItemDecisionList component (per-item ✓/✗)"
```

---

## Task 6: Refactor `ProcurementPanel` + Delete `InvoiceForm`

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/procurement/ProcurementPanel.tsx`
- Delete: `apps/frontend/src/features/hardware-request/components/procurement/InvoiceForm.tsx`

- [ ] **Step 1: Read existing ProcurementPanel**

```bash
cat apps/frontend/src/features/hardware-request/components/procurement/ProcurementPanel.tsx
```

- [ ] **Step 2: Replace InvoiceForm usage**

```tsx
import { useState } from 'react';
import { ItemDecisionList } from './ItemDecisionList';
import { useProcurementDecision } from '../../hooks/useProcurementDecision';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '../common/SectionCard';
import { RejectDialog } from '../detail/RejectDialog';
import { toast } from 'sonner';
import type { HardwareRequest, ItemProcurementDecision } from '../../types';

interface ProcurementPanelProps { request: HardwareRequest }

export function ProcurementPanel({ request }: ProcurementPanelProps) {
  const { decide, complete, isDeciding, isCompleting } = useProcurementDecision(request.id);
  const [decisions, setDecisions] = useState<Record<string, ItemProcurementDecision | null>>(
    Object.fromEntries(request.items.map((i) => [i.id, i.procurementDecision ?? null])),
  );
  const [note, setNote] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const allDecided = request.items.every((i) => decisions[i.id] != null);
  const allRejected = request.items.every((i) => decisions[i.id] === 'REJECTED');

  const handleSaveDraft = async () => {
    const items = request.items
      .filter((i) => decisions[i.id] != null)
      .map((i) => ({ itemId: i.id, decision: decisions[i.id]! }));
    if (items.length === 0) {
      toast.info('Belum ada keputusan untuk disimpan');
      return;
    }
    await decide({ decisions: items, note: note || undefined });
  };

  const handleComplete = async () => {
    if (!allDecided) {
      const undecidedCount = request.items.filter((i) => decisions[i.id] == null).length;
      toast.error(`${undecidedCount} item belum diputuskan`);
      return;
    }
    await handleSaveDraft();
    if (allRejected) {
      setRejectOpen(true);
      return;
    }
    await complete({});
  };

  const handleRejectConfirm = async (reason: string) => {
    await complete({ rejectReason: reason });
    setRejectOpen(false);
  };

  return (
    <SectionCard title="Procurement Decision" subtitle="Centang ✓ untuk dibeli, silang ✗ untuk tidak diproses">
      <ItemDecisionList
        items={request.items}
        decisions={decisions}
        onChange={(id, d) => setDecisions((prev) => ({ ...prev, [id]: d }))}
        disabled={isDeciding || isCompleting}
      />
      <div className="mt-6 space-y-3">
        <Textarea
          placeholder="Catatan procurement (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isDeciding}>
            Simpan Draft
          </Button>
          <Button onClick={handleComplete} disabled={!allDecided || isCompleting}>
            Selesaikan Procurement
          </Button>
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Tolak Permintaan"
        description="Semua item ditolak. Berikan alasan."
        onConfirm={handleRejectConfirm}
      />
    </SectionCard>
  );
}
```

- [ ] **Step 3: Delete InvoiceForm**

```bash
rm apps/frontend/src/features/hardware-request/components/procurement/InvoiceForm.tsx
```

Search for any remaining import:
```bash
grep -rn "InvoiceForm" apps/frontend/src/
```

Remove all references.

- [ ] **Step 4: Component test**

```typescript
// __tests__/ProcurementPanel.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProcurementPanel } from '../ProcurementPanel';

const mockRequest = {
  id: 'r1', status: 'PROCUREMENT',
  items: [
    { id: 'i1', name: 'Monitor', qty: 2, procurementDecision: null },
    { id: 'i2', name: 'Keyboard', qty: 5, procurementDecision: null },
  ],
} as any;

describe('<ProcurementPanel>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('disables Selesaikan button when items undecided', () => {
    renderWithQc(<ProcurementPanel request={mockRequest} />);
    expect(screen.getByRole('button', { name: /selesaikan/i })).toBeDisabled();
  });

  it('enables Selesaikan after all items decided', async () => {
    renderWithQc(<ProcurementPanel request={mockRequest} />);
    const approveBtns = screen.getAllByRole('button', { name: /approve/i });
    await userEvent.click(approveBtns[0]);
    await userEvent.click(approveBtns[1]);
    expect(screen.getByRole('button', { name: /selesaikan/i })).toBeEnabled();
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads ProcurementPanel
git add apps/frontend/src/features/hardware-request/components/procurement/
git rm apps/frontend/src/features/hardware-request/components/procurement/InvoiceForm.tsx
git commit -m "feat(hr-fe): refactor ProcurementPanel ke per-item decision, drop InvoiceForm"
```

---

## Task 7: Hook — `useDeliveryUpdate`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useDeliveryUpdate.ts`

- [ ] **Step 1: Implement (TDD pattern same as Task 4)**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateItemDelivery } from '../api/installation.api';
import type { ItemDeliveryInput } from '../types';

export function useDeliveryUpdate(requestId: string) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: ItemDeliveryInput }) =>
      updateItemDelivery(requestId, itemId, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
      toast.success(
        vars.input.status === 'ARRIVED'
          ? 'Item ditandai sudah datang'
          : 'Item dikembalikan ke status menunggu',
      );
    },
    onError: (err: Error) => toast.error(`Gagal update: ${err.message}`),
  });

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
```

- [ ] **Step 2: Test + commit**

Test pattern same as `useProcurementDecision`. Commit:

```bash
git add apps/frontend/src/features/hardware-request/hooks/useDeliveryUpdate.ts \
        apps/frontend/src/features/hardware-request/hooks/__tests__/useDeliveryUpdate.test.tsx
git commit -m "feat(hr-fe): useDeliveryUpdate hook"
```

---

## Task 8: Component — `DeliveryBoard`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/delivery/DeliveryBoard.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/delivery/__tests__/DeliveryBoard.test.tsx`

- [ ] **Step 1: Failing test**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeliveryBoard } from '../DeliveryBoard';

const mockReq = {
  id: 'r1', status: 'AWAITING_DELIVERY',
  items: [
    { id: 'i1', name: 'Monitor', qty: 2, deliveryStatus: 'ARRIVED', arrivedAt: '2026-04-19T08:00:00Z', procurementDecision: 'APPROVED' },
    { id: 'i2', name: 'Keyboard', qty: 5, deliveryStatus: 'PENDING', procurementDecision: 'APPROVED' },
    { id: 'i3', name: 'Cable', qty: 1, deliveryStatus: 'NOT_PROCURED', procurementDecision: 'REJECTED' },
  ],
} as any;
const ictUser = { id: 'ict-1', role: 'ICT_STAFF' as const };

describe('<DeliveryBoard>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('renders all items including NOT_PROCURED greyed', () => {
    renderWithQc(<DeliveryBoard request={mockReq} user={ictUser} onSchedule={vi.fn()} />);
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Cable')).toBeInTheDocument();
    expect(screen.getByText(/tidak diproses/i)).toBeInTheDocument();
  });

  it('shows "Jadwalkan Instalasi" enabled when ≥1 ARRIVED', () => {
    renderWithQc(<DeliveryBoard request={mockReq} user={ictUser} onSchedule={vi.fn()} />);
    expect(screen.getByRole('button', { name: /jadwalkan/i })).toBeEnabled();
  });

  it('USER cannot toggle delivery (read-only)', () => {
    const userU = { id: 'u1', role: 'USER' as const };
    renderWithQc(<DeliveryBoard request={mockReq} user={userU} onSchedule={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sudah datang/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, X } from 'lucide-react';
import { useDeliveryUpdate } from '../../hooks/useDeliveryUpdate';
import { canUpdateDelivery, canProposeSchedule } from '../../utils/permission.util';
import { SectionCard } from '../common/SectionCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HardwareRequest, HardwareRequestItem } from '../../types';

interface DeliveryBoardProps {
  request: HardwareRequest;
  user: { id: string; role: 'USER' | 'ICT_STAFF' };
  onSchedule: () => void;
}

export function DeliveryBoard({ request, user, onSchedule }: DeliveryBoardProps) {
  const { update, isUpdating } = useDeliveryUpdate(request.id);
  const editable = canUpdateDelivery(user, request);
  const canSchedule = canProposeSchedule(user, request);
  const arrivedCount = request.items.filter((i) => i.deliveryStatus === 'ARRIVED').length;

  return (
    <SectionCard title="Status Pengiriman Item" subtitle="ICT update saat barang sampai">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {request.items.map((item) => (
            <DeliveryRow
              key={item.id}
              item={item}
              editable={editable}
              isUpdating={isUpdating}
              onToggle={(status) => update({ itemId: item.id, input: { status } })}
            />
          ))}
        </AnimatePresence>
      </ul>

      {editable && (
        <div className="mt-6 flex justify-end">
          <Button onClick={onSchedule} disabled={!canSchedule}>
            Jadwalkan Instalasi {arrivedCount > 0 && `(${arrivedCount} item siap)`}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

interface DeliveryRowProps {
  item: HardwareRequestItem;
  editable: boolean;
  isUpdating: boolean;
  onToggle: (status: 'ARRIVED' | 'PENDING') => void;
}

function DeliveryRow({ item, editable, isUpdating, onToggle }: DeliveryRowProps) {
  const isArrived = item.deliveryStatus === 'ARRIVED';
  const isNotProcured = item.deliveryStatus === 'NOT_PROCURED';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'flex items-center justify-between rounded-2xl border bg-card/80 px-4 py-3 backdrop-blur transition-colors',
        isArrived && 'border-success/40 bg-success/5',
        isNotProcured && 'border-destructive/30 opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        {isArrived ? <Check className="h-5 w-5 text-success" />
          : isNotProcured ? <X className="h-5 w-5 text-destructive" />
          : <Clock className="h-5 w-5 text-muted-foreground" />}
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            qty: {item.qty}
            {isArrived && item.arrivedAt && ` • Datang ${new Date(item.arrivedAt).toLocaleDateString('id-ID')}`}
            {isNotProcured && ' • Tidak diproses'}
          </p>
        </div>
      </div>

      {editable && !isNotProcured && (
        <Button
          size="sm"
          variant="outline"
          disabled={isUpdating}
          onClick={() => onToggle(isArrived ? 'PENDING' : 'ARRIVED')}
        >
          {isArrived ? 'Tandai Belum Datang' : 'Tandai Sudah Datang'}
        </Button>
      )}
    </motion.li>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads DeliveryBoard
git add apps/frontend/src/features/hardware-request/components/delivery/ \
        apps/frontend/src/features/hardware-request/hooks/__tests__/useDeliveryUpdate.test.tsx
git commit -m "feat(hr-fe): DeliveryBoard component with per-item arrival toggle"
```

---

## Task 9: Hook — `useScheduleSelection`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/hooks/useScheduleSelection.ts`

- [ ] **Step 1: Implement**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  proposeSchedule,
  selectScheduleSlot,
  requestReschedule,
} from '../api/installation.api';
import type {
  ScheduleProposeInput,
  SelectSlotInput,
  RequestRescheduleInput,
} from '../types';

export function useScheduleSelection(requestId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hardware-request', requestId] });
    qc.invalidateQueries({ queryKey: ['installation-calendar'] });
  };

  const propose = useMutation({
    mutationFn: (input: ScheduleProposeInput) => proposeSchedule(requestId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Slot diusulkan ke user');
    },
    onError: (err: Error) => toast.error(`Gagal usulkan: ${err.message}`),
  });

  const select = useMutation({
    mutationFn: ({ scheduleId, input }: { scheduleId: string; input: SelectSlotInput }) =>
      selectScheduleSlot(requestId, scheduleId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Jadwal dikonfirmasi');
    },
    onError: (err: Error) => toast.error(`Gagal konfirmasi: ${err.message}`),
  });

  const reschedule = useMutation({
    mutationFn: ({ scheduleId, input }: { scheduleId: string; input: RequestRescheduleInput }) =>
      requestReschedule(requestId, scheduleId, input),
    onSuccess: (sched) => {
      invalidate();
      toast.success(
        sched.status === 'CANCELLED'
          ? 'Reschedule maksimal — schedule otomatis dibatalkan'
          : 'Permintaan reschedule terkirim',
      );
    },
    onError: (err: Error) => toast.error(`Gagal: ${err.message}`),
  });

  return {
    propose: propose.mutateAsync,
    select: select.mutateAsync,
    reschedule: reschedule.mutateAsync,
    isProposing: propose.isPending,
    isSelecting: select.isPending,
    isRescheduling: reschedule.isPending,
  };
}
```

- [ ] **Step 2: Test + commit**

Pattern same as previous hooks.

```bash
git add apps/frontend/src/features/hardware-request/hooks/useScheduleSelection.ts \
        apps/frontend/src/features/hardware-request/hooks/__tests__/useScheduleSelection.test.tsx
git commit -m "feat(hr-fe): useScheduleSelection hook (propose/select/reschedule)"
```

---

## Task 10: Component — `ScheduleProposeModal`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/scheduling/ScheduleProposeModal.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/scheduling/__tests__/ScheduleProposeModal.test.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TechnicianFilter } from '../calendar/TechnicianFilter';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';
import type { HardwareRequestItem, SlotProposal } from '../../types';

interface ScheduleProposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  arrivedItems: HardwareRequestItem[];
  defaultTechnicianId?: string;
}

const MAX_SLOTS = 3;

export function ScheduleProposeModal({
  open, onOpenChange, requestId, arrivedItems, defaultTechnicianId,
}: ScheduleProposeModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    arrivedItems.map((i) => i.id),
  );
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId ?? '');
  const [slots, setSlots] = useState<SlotProposal[]>([emptySlot()]);
  const [note, setNote] = useState('');
  const { propose, isProposing } = useScheduleSelection(requestId);

  function emptySlot(): SlotProposal {
    return { start: '', end: '' };
  }

  const handleSubmit = async () => {
    if (selectedItemIds.length === 0) return toast.error('Pilih minimal 1 item');
    if (!technicianId) return toast.error('Pilih teknisi');
    if (slots.length === 0) return toast.error('Tambah minimal 1 slot');
    for (const s of slots) {
      if (!s.start || !s.end) return toast.error('Lengkapi semua slot');
      if (new Date(s.end) <= new Date(s.start)) {
        return toast.error('End time harus setelah start');
      }
    }

    await propose({
      itemIds: selectedItemIds,
      technicianId,
      slots,
      note: note || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Jadwalkan Instalasi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Item yang dijadwalkan</Label>
            <div className="mt-2 space-y-1">
              {arrivedItems.map((item) => (
                <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onCheckedChange={(c) => setSelectedItemIds((prev) =>
                      c ? [...prev, item.id] : prev.filter((id) => id !== item.id))}
                  />
                  <span>{item.name} (qty: {item.qty})</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Teknisi</Label>
            <TechnicianFilter value={technicianId} onChange={setTechnicianId} singleSelect />
          </div>

          <div>
            <Label>Usulkan slot waktu (1-{MAX_SLOTS})</Label>
            <AnimatePresence>
              {slots.map((slot, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 flex items-center gap-2"
                >
                  <Input
                    type="datetime-local"
                    value={slot.start}
                    onChange={(e) => {
                      const next = [...slots];
                      next[idx] = { ...next[idx], start: e.target.value };
                      setSlots(next);
                    }}
                  />
                  <Input
                    type="datetime-local"
                    value={slot.end}
                    onChange={(e) => {
                      const next = [...slots];
                      next[idx] = { ...next[idx], end: e.target.value };
                      setSlots(next);
                    }}
                  />
                  {slots.length > 1 && (
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="hapus slot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {slots.length < MAX_SLOTS && (
              <Button
                size="sm" variant="ghost"
                className="mt-2"
                onClick={() => setSlots((prev) => [...prev, emptySlot()])}
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah slot
              </Button>
            )}
          </div>

          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isProposing}>Kirim ke User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Tests**

```typescript
describe('<ScheduleProposeModal>', () => {
  it('rejects submit when end <= start', async () => { /* ... */ });
  it('caps slots at 3', async () => { /* ... */ });
  it('removes slot when trash clicked (min 1 remains)', async () => { /* ... */ });
  it('calls propose API on submit', async () => { /* ... */ });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter frontend test -- --no-threads ScheduleProposeModal
git add apps/frontend/src/features/hardware-request/components/scheduling/ScheduleProposeModal.tsx \
        apps/frontend/src/features/hardware-request/components/scheduling/__tests__/ScheduleProposeModal.test.tsx
git commit -m "feat(hr-fe): ScheduleProposeModal (ICT propose 1-3 slot)"
```

---

## Task 11: Component — `SlotPickerModal`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/scheduling/SlotPickerModal.tsx`
- Create: `apps/frontend/src/features/hardware-request/components/scheduling/__tests__/SlotPickerModal.test.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { RescheduleRequestModal } from './RescheduleRequestModal';
import { cn } from '@/lib/utils';
import type { InstallationSchedule } from '../../types';

interface SlotPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  schedule: InstallationSchedule;
}

export function SlotPickerModal({ open, onOpenChange, requestId, schedule }: SlotPickerModalProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { select, isSelecting } = useScheduleSelection(requestId);

  const handleConfirm = async () => {
    if (picked == null) return;
    await select({ scheduleId: schedule.id, input: { slotIndex: picked } });
    onOpenChange(false);
  };

  const slots = schedule.proposedSlots ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Jadwal Instalasi</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Teknisi: {schedule.technician?.fullName ?? schedule.technicianId}
            </p>

            <ul className="space-y-2 mt-3">
              {slots.map((slot, idx) => (
                <motion.li
                  key={idx}
                  layout
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border p-3 cursor-pointer transition-colors',
                    picked === idx ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border/40',
                  )}
                  onClick={() => setPicked(idx)}
                  role="radio"
                  aria-checked={picked === idx}
                >
                  <div>
                    <p className="font-medium">
                      {new Date(slot.start).toLocaleString('id-ID', {
                        weekday: 'long', day: '2-digit', month: 'short',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(slot.start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(slot.end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {picked === idx && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring' }}
                    >
                      <Check className="h-5 w-5 text-primary" />
                    </motion.div>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setRescheduleOpen(true)}>
              Minta Reschedule
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button onClick={handleConfirm} disabled={picked == null || isSelecting}>
                Konfirmasi
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RescheduleRequestModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        requestId={requestId}
        scheduleId={schedule.id}
        onDone={() => onOpenChange(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Test + commit**

```bash
pnpm --filter frontend test -- --no-threads SlotPickerModal
git add apps/frontend/src/features/hardware-request/components/scheduling/SlotPickerModal.tsx \
        apps/frontend/src/features/hardware-request/components/scheduling/__tests__/SlotPickerModal.test.tsx
git commit -m "feat(hr-fe): SlotPickerModal (USER pick 1 of N slots)"
```

---

## Task 12: Component — `RescheduleRequestModal`

**Files:**
- Create: `apps/frontend/src/features/hardware-request/components/scheduling/RescheduleRequestModal.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';

interface RescheduleRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  scheduleId: string;
  onDone?: () => void;
}

export function RescheduleRequestModal({
  open, onOpenChange, requestId, scheduleId, onDone,
}: RescheduleRequestModalProps) {
  const [reason, setReason] = useState('');
  const { reschedule, isRescheduling } = useScheduleSelection(requestId);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) return toast.error('Alasan minimal 5 karakter');
    await reschedule({ scheduleId, input: { reason: reason.trim() } });
    setReason('');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Minta Reschedule</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Alasan</Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            rows={3} placeholder="Jelaskan alasan reschedule..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isRescheduling}>Kirim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Test + commit**

```bash
git add apps/frontend/src/features/hardware-request/components/scheduling/RescheduleRequestModal.tsx
git commit -m "feat(hr-fe): RescheduleRequestModal"
```

---

## Task 13: Update `ActionPanel`

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx`

- [ ] **Step 1: Read existing**

```bash
cat apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx
```

- [ ] **Step 2: Wire new modals & boards conditionally**

```tsx
import { useState } from 'react';
import { ProcurementPanel } from '../procurement/ProcurementPanel';
import { DeliveryBoard } from '../delivery/DeliveryBoard';
import { ScheduleProposeModal } from '../scheduling/ScheduleProposeModal';
import { SlotPickerModal } from '../scheduling/SlotPickerModal';
import { canDecideProcurement, canSelectSlot } from '../../utils/permission.util';
import { usePermissions } from '../../hooks/usePermissions';
import type { HardwareRequest, InstallationSchedule } from '../../types';

interface ActionPanelProps {
  request: HardwareRequest;
  schedules: InstallationSchedule[];
}

export function ActionPanel({ request, schedules }: ActionPanelProps) {
  const { user } = usePermissions();
  const [proposeOpen, setProposeOpen] = useState(false);
  const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);

  const arrivedItems = request.items.filter((i) => i.deliveryStatus === 'ARRIVED');
  const awaitingUserSchedule = schedules.find((s) => s.status === 'PROPOSED_AWAITING_USER');

  return (
    <div className="space-y-6">
      {canDecideProcurement(user, request) && (
        <ProcurementPanel request={request} />
      )}

      {(['AWAITING_DELIVERY', 'INSTALLATION'] as const).includes(request.status as any) && (
        <DeliveryBoard
          request={request}
          user={user}
          onSchedule={() => setProposeOpen(true)}
        />
      )}

      {awaitingUserSchedule && canSelectSlot(user, request, awaitingUserSchedule.status) && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-medium">ICT mengusulkan jadwal</p>
          <p className="text-sm text-muted-foreground">Pilih slot waktu yang sesuai</p>
          <button
            type="button"
            className="mt-3 underline text-primary"
            onClick={() => setPickerSched(awaitingUserSchedule)}
          >
            Buka pemilihan slot
          </button>
        </div>
      )}

      <ScheduleProposeModal
        open={proposeOpen}
        onOpenChange={setProposeOpen}
        requestId={request.id}
        arrivedItems={arrivedItems}
        defaultTechnicianId={user.id}
      />

      {pickerSched && (
        <SlotPickerModal
          open={!!pickerSched}
          onOpenChange={(o) => !o && setPickerSched(null)}
          requestId={request.id}
          schedule={pickerSched}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx
git commit -m "feat(hr-fe): ActionPanel wires v2 procurement/delivery/scheduling"
```

---

## Task 14: `CommentComposer` Always-Render

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/detail/CommentComposer.tsx`
- Modify: `apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx`

- [ ] **Step 1: Identify any conditional render**

```bash
grep -n "CommentComposer\|canComment" apps/frontend/src/features/hardware-request/components/detail/ apps/frontend/src/features/hardware-request/pages/
```

- [ ] **Step 2: Replace with `canComment(user, req)` only**

In Detail page:

```tsx
import { canComment } from '../utils/permission.util';

// in render:
{canComment(user, request) && (
  <CommentComposer requestId={request.id} />
)}
```

Hapus condition lain seperti `if (request.status !== 'DONE')`.

- [ ] **Step 3: Test**

```typescript
// CommentComposer renders for USER owner in DONE
it('renders composer for owner in DONE status', () => {
  const req = { id: 'r1', userId: 'u1', status: 'DONE' } as any;
  render(<CommentComposerWrapper request={req} user={{ id: 'u1', role: 'USER' }} />);
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});
```

- [ ] **Step 4: Commit**

```bash
pnpm --filter frontend test -- --no-threads CommentComposer
git add apps/frontend/src/features/hardware-request/components/detail/CommentComposer.tsx \
        apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx
git commit -m "fix(hr-fe): CommentComposer renders in all statuses (auth+ownership only)"
```

---

## Task 15: Final Frontend Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter frontend test -- --no-threads
```

Expected: pass + coverage ≥80% pada hardware-request module.

- [ ] **Step 2: Type check**

```bash
pnpm --filter frontend typecheck
```

- [ ] **Step 3: Build**

```bash
pnpm --filter frontend build
```

- [ ] **Step 4: Manual smoke test (browser)**

Start dev server:
```bash
pnpm --filter frontend dev
```

Manual checklist:
- [ ] USER buat request, submit → ICT lihat di list.
- [ ] ICT approve → procurement panel muncul.
- [ ] ICT centang ✓✓✓ → "Selesaikan Procurement" enabled → click → status `AWAITING_DELIVERY`.
- [ ] DeliveryBoard render dengan semua item PENDING.
- [ ] ICT klik "Tandai Sudah Datang" item-1 → animation play → USER dapat notif (cek bell).
- [ ] ICT klik "Jadwalkan Instalasi" → ScheduleProposeModal open dengan item ARRIVED pre-selected.
- [ ] Submit propose → USER lihat banner "Pilih jadwal" → buka SlotPickerModal → pilih slot → confirm.
- [ ] Status request → `INSTALLATION`. Schedule status `CONFIRMED`.
- [ ] USER comment di status `INSTALLATION` & `DONE` → 201 OK.

- [ ] **Step 5: Final commit**

```bash
git status
git add -A
git commit -m "chore(hr-fe): final cleanup post v2 frontend workflow plan"
```

Plan 2 done. Lanjut Plan 3 (Layout merge).

---

## Notes for Implementer

- **Test runner:** `--no-threads` untuk Vitest hindari OOM.
- **`SectionCard`/`StatusBadge`/`EmptyState`:** Reuse existing common components (sudah ada).
- **`TechnicianFilter`:** Existing component, mungkin perlu mode `singleSelect` — extend bila belum ada.
- **`apiClient`:** Reuse existing axios instance dengan auth interceptor.
- **Animation:** semua harus respect `prefers-reduced-motion` via framer-motion `useReducedMotion`.
