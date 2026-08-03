# TV Board Light Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign public TV Board into Light Command layout optimized for bright office TVs and label Oracle/K2 cards with a compact navy badge while keeping three realtime status columns.

**Architecture:** Backend derives `isOracleRequest` once in `TvBoardService` from canonical `ticketType` plus legacy `category`, then returns that boolean in the existing HTTP/socket `TvBoardData` contract. Frontend extends the existing socket type and restyles `BentoTvBoardPage` in place; no endpoint, query, polling, filter interaction, or Socket.IO event changes.

**Tech Stack:** NestJS, TypeORM, Jest, React, TypeScript, Tailwind CSS, Vitest, Socket.IO.

## Global Constraints

- Keep exactly three columns: Open, In Progress, Resolved. Oracle/K2 is never a fourth column.
- Keep public route `/tv/:token`, token authorization, existing `GET /tv/board/:token`, and `/tv-board` socket namespace unchanged.
- Keep board read-only and use current socket updates; do not add polling, query parameters, settings, or new events.
- Preserve all normal ticket visibility. Oracle/K2 differs only by navy `ORACLE / K2` badge.
- Derive Oracle/K2 as `ticket.ticketType === TicketType.ORACLE_REQUEST || ticket.category === 'ORACLE_REQUEST'`.
- Expose only `isOracleRequest`; do not expose `ticketType` or `category` through public TV endpoint/socket payload.
- Use Light Command palette: bright neutral background, white panels/cards, status accents slate/blue/emerald, red overdue, navy Oracle/K2 badge. Never use purple, teal, or amber for Oracle/K2 badge.
- Make status count and card description visible from distance; requester/assignee stay small and secondary.
- Motion only uses opacity/transform and respects Tailwind `motion-reduce`; socket data updates must not restart entry animations.
- No new dependencies. Reuse `Plus Jakarta Sans`, existing `PRIORITY_CONFIG`, and existing Lucide icons.
- Run all tests serially: backend Jest `--runInBand`; frontend Vitest `--maxWorkers=1 --no-file-parallelism`.

---

## File Structure

**Backend — modify:**
- `apps/backend/src/modules/tv-board/tv-board.service.ts` — adds safe derived Oracle/K2 flag to public board card projection.
- `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` — proves canonical, legacy, and normal ticket classification.
- `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts` — proves current room update payload preserves derived flag.

**Frontend — modify:**
- `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts` — adds `isOracleRequest` to shared public payload type.
- `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` — Light Command page, distance-readable status counts/descriptions, compact navy Oracle/K2 badge, stable reduced-motion-safe entry styling.
- `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` — verifies Oracle/K2 marker, normal card behavior, existing initial/error/overdue contracts.

No migrations, routes, backend controller/gateway logic, or frontend socket behavior changes.

---

### Task 1: Derive Oracle/K2 marker in public TV Board payload

**Files:**
- Modify: `apps/backend/src/modules/tv-board/tv-board.service.ts`
- Modify: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`
- Modify: `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`

**Interfaces:**
- Consumes: `TicketType.ORACLE_REQUEST` from `apps/backend/src/modules/ticketing/entities/ticket.entity.ts` and legacy `Ticket.category` string.
- Produces: `TvBoardCard.isOracleRequest: boolean` in all `TvBoardData.open`, `.inProgress`, and `.resolved` card arrays.
- Existing controller and gateway already transport `TvBoardData`, so no new endpoint/event is required.

- [ ] **Step 1: Add failing service classification cases**

In `tv-board.service.spec.ts`, import `TicketType` beside `TicketStatus` and `TicketPriority`. Replace current two ticket fixture entries with three explicit cases, then assert derived output:

```typescript
{
    id: 't1',
    status: TicketStatus.TODO,
    description: 'Printer rusak',
    user: { fullName: 'Budi' },
    assignedTo: null,
    priority: TicketPriority.MEDIUM,
    slaTarget: null,
    isOverdue: false,
    ticketType: TicketType.ORACLE_REQUEST,
},
{
    id: 't2',
    status: TicketStatus.IN_PROGRESS,
    description: 'Permintaan K2 lama',
    user: { fullName: 'Ani' },
    assignedTo: { fullName: 'Agen Oracle' },
    priority: TicketPriority.HIGH,
    slaTarget: new Date('2026-07-25'),
    isOverdue: true,
    category: 'ORACLE_REQUEST',
},
{
    id: 't3',
    status: TicketStatus.RESOLVED,
    description: 'Laptop lambat',
    user: { fullName: 'Cici' },
    assignedTo: { fullName: 'Agen A' },
    priority: TicketPriority.LOW,
    slaTarget: null,
    isOverdue: false,
    ticketType: TicketType.SERVICE,
    category: 'GENERAL',
},
```

After `getBoardData`, assert each data path explicitly:

```typescript
expect(data.open[0]).toMatchObject({ id: 't1', isOracleRequest: true });
expect(data.inProgress[0]).toMatchObject({ id: 't2', isOracleRequest: true });
expect(data.resolved[0]).toMatchObject({ id: 't3', isOracleRequest: false });
```

- [ ] **Step 2: Run service spec and verify failure**

Run:

```bash
cd apps/backend
npx jest --runInBand tv-board.service.spec.ts
```

Expected: FAIL because `isOracleRequest` is absent from `TvBoardCard` projection.

- [ ] **Step 3: Add boolean to public card projection**

In `tv-board.service.ts`, import `TicketType` and extend the interface:

```typescript
import { Ticket, TicketStatus, TicketType } from '../ticketing/entities/ticket.entity';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
}
```

Add only this property to current `toCard` mapper:

```typescript
isOracleRequest:
    t.ticketType === TicketType.ORACLE_REQUEST ||
    t.category === 'ORACLE_REQUEST',
```

Do not alter `find()` conditions, status grouping, resolved date range, or waiting vendor count.

- [ ] **Step 4: Run service spec and verify pass**

Run:

```bash
cd apps/backend
npx jest --runInBand tv-board.service.spec.ts
```

Expected: PASS, including canonical ticket type, legacy category, and normal ticket cases.

- [ ] **Step 5: Extend gateway payload regression assertion**

In `tv-board.gateway.spec.ts`, change mocked `getBoardData` return to include one Oracle card:

```typescript
getBoardData: jest.fn().mockResolvedValue({
    siteCode: 'SPJ',
    open: [{ id: 'oracle-1', isOracleRequest: true }],
    inProgress: [],
    resolved: [],
    waitingVendorCount: 0,
}),
```

Change final event assertion to prove the same `tv-board:update` payload includes flag:

```typescript
expect(toReturn.emit).toHaveBeenCalledWith(
    'tv-board:update',
    expect.objectContaining({
        siteCode: 'SPJ',
        open: [expect.objectContaining({ id: 'oracle-1', isOracleRequest: true })],
    }),
);
```

- [ ] **Step 6: Run backend TV Board suite**

Run:

```bash
cd apps/backend
npx jest --runInBand tv-board
npx tsc --noEmit
```

Expected: all TV Board suites and typecheck PASS.

- [ ] **Step 7: Commit backend payload contract**

```bash
git add apps/backend/src/modules/tv-board/tv-board.service.ts apps/backend/src/modules/tv-board/tv-board.service.spec.ts apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts
git commit -m "feat(tv-board): mark Oracle K2 tickets in board payload"
```

---

### Task 2: Implement Light Command public board and navy Oracle/K2 badge

**Files:**
- Modify: `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`
- Modify: `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`
- Modify: `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`

**Interfaces:**
- Consumes: `TvBoardCard.isOracleRequest` from Task 1 HTTP/socket payload.
- Produces: distance-readable Light Command board while preserving `data-testid="tv-board-card"`, all three status columns, initial API fetch, invalid-token state, and socket state behavior.

- [ ] **Step 1: Add failing frontend Oracle/K2 display test**

In `BentoTvBoardPage.smoke.test.tsx`, make first mock card Oracle/K2 and second normal:

```typescript
{ id: 't1', description: 'Akses Oracle gagal', requesterName: 'Budi', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: true },
{ id: 't2', description: 'Printer rusak', requesterName: 'Cici', assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true, isOracleRequest: false },
```

Add assertions after initial fetch:

```typescript
expect(await screen.findByText('ORACLE / K2')).toBeInTheDocument();
expect(screen.getByText('Akses Oracle gagal')).toBeInTheDocument();
expect(screen.getByText('Printer rusak')).toBeInTheDocument();
```

Keep existing assertions for site name, Open/In Progress/Resolved, Waiting Vendor, and invalid link. In the overdue case, replace both `Server down` lookups with `Printer rusak`, and replace normal-card lookup `Printer rusak` with `Akses Oracle gagal`:

```typescript
const overdueCard = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
const normalCard = (await screen.findByText('Akses Oracle gagal')).closest('div[data-testid="tv-board-card"]');
```

- [ ] **Step 2: Run smoke spec and verify failure**

Run:

```bash
cd apps/frontend
npx vitest run --pool=forks --maxWorkers=1 --no-file-parallelism BentoTvBoardPage.smoke.test.tsx
```

Expected: FAIL because `ORACLE / K2` is not rendered and `TvBoardCard` does not yet accept `isOracleRequest`.

- [ ] **Step 3: Extend shared socket payload type**

In `useTvBoardSocket.ts`, append one field to `TvBoardCard`:

```typescript
export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
}
```

Do not change socket construction, reconnection options, event names, or state lifecycle.

- [ ] **Step 4: Restyle card for readable description and compact metadata**

In `BentoTvBoardPage.tsx`, keep `TvBoardCardView` local and `data-testid="tv-board-card"`. Replace its current card markup with Light Command classes:

```tsx
<div
    data-testid="tv-board-card"
    className={`relative overflow-hidden rounded-[18px] bg-white p-5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.32)] ring-1 ring-slate-200/80 motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${
        card.isOverdue ? 'ring-2 ring-red-600 bg-red-50/40' : ''
    }`}
>
    <div className={`absolute inset-y-0 left-0 w-1.5 ${priorityConfig.barColor}`} />
    <div className="pl-2">
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                {card.isOracleRequest && (
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white">
                        ORACLE / K2
                    </span>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${priorityConfig.badgeColor}`}>
                    {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
                    {priorityConfig.label}
                </span>
            </div>
            {card.isOverdue ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                    <Clock className="h-3.5 w-3.5" /> Overdue
                </span>
            ) : card.slaTarget ? (
                <span className="text-[11px] font-medium text-slate-500">
                    Target {new Date(card.slaTarget).toLocaleDateString('id-ID')}
                </span>
            ) : null}
        </div>
        <p className="mb-5 line-clamp-3 text-lg font-bold leading-snug tracking-[-0.01em] text-slate-900">
            {card.description}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><User className="h-3.5 w-3.5 shrink-0" />{card.requesterName}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-600"><UserCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />{card.assignedToName ?? 'Unassigned'}</span>
        </div>
    </div>
</div>
```

Keep `border-red-600` in overdue card class so existing smoke test remains meaningful. Do not use `PRIORITY_CONFIG.ORACLE_REQUEST`; Oracle/K2 badge must stay navy regardless of ticket priority.

- [ ] **Step 5: Restyle shell/header/columns as Light Command**

In `BentoTvBoardPage.tsx`:

1. Remove `dark:` variants from the page-specific board classes; TV Board must consistently render light command regardless of saved application theme.
2. Use this page shell and header structure:

```tsx
<div className="min-h-[100dvh] bg-[#edf2f7] p-4 font-sans text-slate-900 md:p-6">
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1920px] flex-col gap-4 md:min-h-[calc(100dvh-3rem)] md:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-white px-6 py-5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 md:px-8">
```

3. Keep site name/short label left. Make time central and visually dominant with `text-4xl font-bold tracking-[-0.04em] tabular-nums`; keep formatted date below in `text-xs`.
4. Render waiting vendor/overdue as compact pills. Keep same text literals `Waiting Vendor: {count}` and `Overdue: {count}` for existing tests.
5. Make board grid `grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6`.
6. Use each column shell `rounded-[24px] bg-slate-100/80 p-1 ring-1 ring-slate-200/80`; inner surface `rounded-[20px] bg-white` to create double-bezel hierarchy without heavy borders/shadows.
7. Use status header count as `text-2xl font-bold tabular-nums`, keeping current title and `Resolved (Hari ini)` behavior.
8. Set content padding to `p-4 md:p-5` and preserve `overflow-y-auto`; empty states remain centered with existing Indonesian copy.
9. Apply `motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none` only to static header and columns. Do not key animations on ticket data or socket state.
10. Update loading and invalid-token screens to white/slate light command palette while preserving visible Indonesian message text.

- [ ] **Step 6: Run frontend smoke test and verify pass**

Run:

```bash
cd apps/frontend
npx vitest run --pool=forks --maxWorkers=1 --no-file-parallelism BentoTvBoardPage.smoke.test.tsx
```

Expected: PASS, including Oracle/K2 badge, three columns, waiting vendor, overdue border, initial API fetch, and invalid token state.

- [ ] **Step 7: Run frontend typecheck**

Run:

```bash
cd apps/frontend
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 8: Commit frontend board redesign**

```bash
git add apps/frontend/src/features/public/hooks/useTvBoardSocket.ts apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx
git commit -m "feat(tv-board): add Light Command board design"
```

---

### Task 3: Final serial regression

**Files:** no product source changes expected.

- [ ] **Step 1: Run backend TV Board tests and typecheck**

```bash
cd apps/backend
npx jest --runInBand tv-board
npx tsc --noEmit
```

Expected: all TV Board tests and TypeScript pass.

- [ ] **Step 2: Run frontend TV Board smoke test and typecheck**

```bash
cd apps/frontend
npx vitest run --pool=forks --maxWorkers=1 --no-file-parallelism BentoTvBoardPage.smoke.test.tsx
npx tsc --noEmit
```

Expected: smoke test and TypeScript pass.

- [ ] **Step 3: Review changed paths only**

```bash
cd ../..
git diff --check -- apps/backend/src/modules/tv-board apps/frontend/src/features/public/hooks/useTvBoardSocket.ts apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx
git status --short -- apps/backend/src/modules/tv-board apps/frontend/src/features/public/hooks/useTvBoardSocket.ts apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx
```

Expected: no whitespace errors; only files listed in Tasks 1–2 are changed.

- [ ] **Step 4: Manual visual verification**

1. Generate or reuse an active TV Board token in Settings → TV Board.
2. Open `/tv/:token` in a desktop-width browser or TV viewport.
3. Confirm fixed Light Command palette even when application theme is dark.
4. Confirm Open, In Progress, and Resolved remain exactly three columns.
5. Confirm a canonical Oracle/K2 ticket and legacy category-only Oracle/K2 ticket both show navy `ORACLE / K2` badge.
6. Confirm normal ticket does not show badge.
7. Change a ticket status or assignment, then confirm socket update changes the correct site board without page reload and without re-running entry animation.

- [ ] **Step 5: Commit only if final regression required a source fix**

```bash
git add <only-files-fixed-during-regression>
git commit -m "fix(tv-board): resolve redesign regression"
```

Skip when no source fix was required.
