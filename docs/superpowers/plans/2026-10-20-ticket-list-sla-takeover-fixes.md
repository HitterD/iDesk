# Ticket List, SLA Pause & PIC Takeover Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the IT Support ticket list stat cards and filters, make the Waiting Vendor SLA pause visible and consistent, and require PIC-takeover confirmation when a non-PIC agent moves a ticket to In Progress.

**Architecture:** Backend (NestJS + TypeORM) gains a multi-value `status` filter, an `overdue` filter, an active-only critical count, an `isOverdue` reset on SLA resume, extend-while-paused, and a takeover rule enforced in `updateTicket`/`bulkUpdate` (409 without confirmation). Frontend (React + TanStack Query + Tailwind v4) wires new cards/filters, renders the paused SLA without a target, and shows the existing `ReassignConfirmDialog` from every status-change entry point.

**Tech Stack:** NestJS, TypeORM (Postgres), Jest 29 (backend); React, TanStack Query, Vitest 4 + jsdom (frontend).

**Spec (agreed with user in grilling session, 2026-10-20):**
1. Card "Resolved" and its filter = RESOLVED + CLOSED. Dropdown gets "Selesai (Resolved + Closed)"; Resolved and Closed stay as separate options.
2. New clickable card "Waiting Vendor"; card "Overdue" becomes clickable.
3. While WAITING_VENDOR the ticket has **no SLA target**: UI shows "Dijeda · sisa X · sejak <tgl>", progress frozen. On resume target = resume + remaining business minutes; `isOverdue` reset if the new target is in the future; overdue again once the new target passes. Extend SLA allowed while paused (adds to remaining). WAITING_VENDOR → RESOLVED allowed directly. No data backfill.
4. "Critical" counts CRITICAL tickets with status TODO/IN_PROGRESS/WAITING_VENDOR only; clicking filters active ones; flame icon / red dot hidden on RESOLVED/CLOSED/CANCELLED rows (priority badge stays).
5. Ticket assigned to agent A (manual or auto), agent B sets IN_PROGRESS → reassign-confirmation modal (existing one, with reason). Applies to list row, detail page, quick action, Kanban, bulk (one summary modal). Backend rejects with 409 without confirmation; confirmed takeover + status change are atomic and audited. ADMIN/MANAGER may choose "ubah status tanpa alihkan PIC". Unassigned ticket → auto-assigned to the actor, no modal.
6. Tests serial: backend `npx jest <file> --runInBand`, one file at a time.

## Global Constraints

- Backend tests: run from `apps/backend` with `npx jest <path> --runInBand`, **one file per run, never in parallel** (machine hangs otherwise).
- Frontend tests: run from `apps/frontend` with `npx vitest run <path>`, one file per run.
- `ticket-update.service.ts` is already 902 lines — new takeover logic goes in a new file, not inline.
- UI copy in Indonesian, matching existing strings (e.g. "Dijeda", "sisa", "jam kerja").
- Status constants: reuse `TICKET_DONE_STATUSES`, `TICKET_INACTIVE_STATUSES` (`entities/ticket.entity.ts:31-34`); add `TICKET_ACTIVE_STATUSES = [TODO, IN_PROGRESS, WAITING_VENDOR]` there.
- Error code string for takeover: `REASSIGN_CONFIRMATION_REQUIRED` (exported constant, used by backend and frontend).

## Review Focus

1. Stale UI: list shows ticket unassigned, but another agent took it meanwhile → backend 409 must open the modal (frontend handles 409 code, not only the pre-check). Test in Task 8.
2. Actor **is** the current PIC → no modal, no 409. Test in Task 5.
3. Extend while paused with `newTargetDate` (date mode) → rejected 400 with a clear message, since there is no target while paused. Test in Task 4.
4. Comma-separated status with an invalid value (`status=RESOLVED,FOO`) → 400, not a SQL error. Test in Task 1.
5. Resume after pause where remaining was 0 (already late before pause) → stays overdue (`isOverdue` not reset). Test in Task 3.

---

### Task 1: Multi-status and overdue list filters (backend)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/dto/pagination.dto.ts:30-34` (status doc), add `overdue?: boolean`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:301-303`, `:869`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:165` (ApiQuery for `overdue`)
- Test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`

**Interfaces:**
- Produces: `GET /tickets/paginated?status=RESOLVED,CLOSED` (comma list, each must be a `TicketStatus`, else `BadRequestException`), `?overdue=true`. Exported `OVERDUE_SQL` constant (the predicate now inline at `:869`) reused by stats and the filter.

- [ ] **Step 1: Write failing tests** in `ticket-query.service.spec.ts` (follow the existing qb-mock style in that file):
  - `findAllPaginated with status "RESOLVED,CLOSED" applies ticket.status IN (:...statuses)` → asserts `andWhere` called with `'ticket.status IN (:...statuses)'`, `{ statuses: ['RESOLVED','CLOSED'] }`.
  - `single status still uses IN with one value` → `{ statuses: ['TODO'] }`.
  - `invalid status value throws BadRequestException` → `status: 'RESOLVED,FOO'`.
  - `overdue=true applies OVERDUE_SQL predicate`.
- [ ] **Step 2: Run** `npx jest src/modules/ticketing/services/ticket-query.service.spec.ts --runInBand` → FAIL.
- [ ] **Step 3: Implement.** Parse `status.split(',').map(trim).filter(Boolean)`, validate against `Object.values(TicketStatus)`. `overdue` DTO field: `@IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()`. Extract `OVERDUE_SQL` = the `:869` predicate without `CASE`, use in both places.
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `fix(tickets): allow multi-status and overdue filters on the ticket list`

### Task 2: Active-only critical count (backend)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts:34` (add `TICKET_ACTIVE_STATUSES`)
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:862-870,1024`
- Test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`

**Interfaces:**
- Produces: `getDashboardStats().critical` = count of `priority = 'CRITICAL' AND status IN (TODO, IN_PROGRESS, WAITING_VENDOR)`. `byPriority` unchanged (still all statuses — used by charts).

- [ ] **Step 1: Failing test** `computeDashboardStats returns critical from activeCritical select, not byPriority` → mock `getRawOne` returning `{ ..., activeCritical: '2' }` and priority rows `CRITICAL: 5`; expect `critical === 2`, `byPriority.CRITICAL === 5`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — add `.addSelect(\`SUM(CASE WHEN ticket.priority = 'CRITICAL' AND ticket.status IN (${TICKET_ACTIVE_STATUSES_SQL}) THEN 1 ELSE 0 END)\`, 'activeCritical')` to the status-count query; return `critical: activeCritical`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(stats): count only active tickets as critical`

### Task 3: Reset overdue on SLA resume (backend)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/sla-clock.service.ts:139-155` (`release`)
- Test: `apps/backend/src/modules/ticketing/services/sla-clock.service.spec.ts`

**Interfaces:**
- Produces: `release(ticket, now)` additionally sets `ticket.isOverdue = false` when the new `slaTarget > now`. Same rule already used by `changePriority` (`:187`).

- [ ] **Step 1: Failing tests:**
  - `release clears isOverdue when resumed target is in the future` (remaining 300, isOverdue true → false).
  - `release keeps isOverdue when remaining is 0` (remaining 0 → target == now → stays true).
- [ ] **Step 2: Run** `npx jest src/modules/ticketing/services/sla-clock.service.spec.ts --runInBand` → FAIL.
- [ ] **Step 3: Implement** inside the `slaRemainingMinutes != null` branch.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(sla): clear overdue flag when a paused SLA resumes with time left`

### Task 4: Extend SLA while Waiting Vendor (backend)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-sla-extend.service.ts:14,73-120`
- Test: `apps/backend/src/modules/ticketing/services/ticket-sla-extend.spec.ts`

**Interfaces:**
- Produces: `EXTENDABLE_STATUSES = [IN_PROGRESS, TODO, WAITING_VENDOR]`. When the clock is held (`ticket.slaRemainingMinutes != null`): only `minutes` mode is valid → `slaRemainingMinutes += minutes`, `slaTarget` untouched; `newTargetDate` → `BadRequestException('SLA sedang dijeda; perpanjang dengan jumlah menit, bukan tanggal')`. `SlaAdjustment` row still written (previousTarget/newTarget = current `slaTarget`, `minutes` = added). Running-clock behaviour unchanged.

- [ ] **Step 1: Failing tests:**
  - `extends a paused ticket by adding to slaRemainingMinutes` (status WAITING_VENDOR, remaining 120, minutes 60 → remaining 180, slaTarget unchanged, adjustment saved).
  - `rejects newTargetDate while paused` → BadRequestException.
  - Existing test asserting WAITING_VENDOR is rejected → update to the new rule.
- [ ] **Step 2: Run** `npx jest src/modules/ticketing/services/ticket-sla-extend.spec.ts --runInBand` → FAIL.
- [ ] **Step 3: Implement** a held-clock branch before the date/minutes logic; keep the system message, saying "ditambah X menit (dijeda)".
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sla): allow extending SLA while waiting for vendor`

### Task 5: Status takeover rule (backend)

**Files:**
- Create: `apps/backend/src/modules/ticketing/services/status-takeover.ts`
- Modify: `apps/backend/src/modules/ticketing/dto/update-ticket.dto.ts:38-42` (`UpdateTicketStatusDto`)
- Modify: `apps/backend/src/modules/ticketing/dto/bulk-update.dto.ts` (add `takeover?`, `keepAssignee?`)
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:510,683-700`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:58-109` (`updateTicket` signature + `assignedTo` relation), `:569-` (`bulkUpdate` pre-check)
- Test: Create `apps/backend/src/modules/ticketing/services/status-takeover.spec.ts`; extend `ticket-update.service.spec.ts`

**Interfaces:**
- Produces in `status-takeover.ts`:
  ```ts
  export const REASSIGN_CONFIRMATION_REQUIRED = 'REASSIGN_CONFIRMATION_REQUIRED';
  export interface TakeoverOptions { takeover?: boolean; keepAssignee?: boolean; reason?: string }
  export type TakeoverDecision =
    | { kind: 'none' }                                  // not IN_PROGRESS, or actor is PIC
    | { kind: 'autoAssign' }                            // ticket unassigned → assign actor
    | { kind: 'takeover'; previousAssigneeId: string; reason: string }
    | { kind: 'keep' };                                 // ADMIN/MANAGER chose to keep PIC
  export function decideStatusTakeover(
    ticket: Pick<Ticket, 'assignedToId'> & { assignedTo?: { id: string; fullName: string } | null },
    newStatus: TicketStatus, oldStatus: TicketStatus,
    actor: { id: string; role: string }, opts: TakeoverOptions,
  ): TakeoverDecision;
  ```
  Throws `ConflictException({ code: REASSIGN_CONFIRMATION_REQUIRED, currentAssignee: { id, fullName } })` when assigned to someone else and neither flag set; `ForbiddenException` when `keepAssignee` by non ADMIN/MANAGER; `BadRequestException` when `takeover` without non-empty `reason`. Only fires when `newStatus === IN_PROGRESS && oldStatus !== IN_PROGRESS`. `autoAssign` only when actor role is in `TICKET_AGENT_ROLES` excluding MANAGER.
- `UpdateTicketStatusDto` adds `@IsOptional() @IsBoolean() takeover?`, `keepAssignee?`, `@IsOptional() @IsString() @MaxLength(500) @Sanitize({ removeHtml: true }) reason?`.
- `updateTicket(ticketId, updateData, userId, takeoverOpts?: TakeoverOptions)` — inside the existing transaction, applies the decision: `takeover`/`autoAssign` set `ticket.assignedToId = userId` and push `changes` entry `Ticket reassigned to <B> (was <A>) by <B>. Alasan: <reason>` (same wording as `assignTicket`, `:409-419`). After commit: audit `AuditAction.ASSIGN_TICKET` with `{ reason, via: 'status-takeover' }` and `workloadService.recalculateAgentWorkload` for old and new assignee (mirror `:429-476`).
- `bulkUpdate(..., updateData & TakeoverOptions)`: before the transaction, if `status === IN_PROGRESS`, run `decideStatusTakeover` per ticket; if any throws 409, throw one `ConflictException({ code, tickets: [{ id, ticketNumber, currentAssignee }] })`. With `takeover`, reassign those tickets in the loop using `updateData.reason`.

- [ ] **Step 1: Failing tests** in `status-takeover.spec.ts`:
  - `returns none when actor is the current PIC`
  - `returns none when new status is not IN_PROGRESS`
  - `returns autoAssign for an unassigned ticket`
  - `throws 409 with REASSIGN_CONFIRMATION_REQUIRED and currentAssignee when assigned to another agent`
  - `returns takeover with reason when confirmed`
  - `throws 400 when takeover has no reason`
  - `returns keep for ADMIN and MANAGER with keepAssignee`
  - `throws 403 for AGENT with keepAssignee`
- [ ] **Step 2: Run** `npx jest src/modules/ticketing/services/status-takeover.spec.ts --runInBand` → FAIL.
- [ ] **Step 3: Implement** `decideStatusTakeover`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Failing tests** in `ticket-update.service.spec.ts`:
  - `updateTicket IN_PROGRESS by non-PIC without takeover throws 409 and saves nothing`
  - `updateTicket with takeover saves assignedToId=actor and status IN_PROGRESS in the same transaction`
  - `bulkUpdate IN_PROGRESS rejects with 409 listing conflicting tickets`
- [ ] **Step 6: Run** `npx jest src/modules/ticketing/services/ticket-update.service.spec.ts --runInBand` → FAIL.
- [ ] **Step 7: Implement** DTO, controller pass-through (`dto.takeover`, `dto.keepAssignee`, `dto.reason`), `updateTicket` and `bulkUpdate` changes.
- [ ] **Step 8: Run** the same file → PASS. Then run `ticket-update.resolution.spec.ts` alone → PASS (regression).
- [ ] **Step 9: Commit** `feat(tickets): require PIC takeover confirmation when another agent starts a ticket`

### Task 6: Stat cards and filters (frontend)

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx:199,217-231,286-294,583-588,632-640`
- Modify: `apps/frontend/src/features/ticket-board/components/TicketListActiveFilters.tsx:41`
- Modify: `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx:271,453`
- Create: `apps/frontend/src/features/ticket-board/constants/statusFilters.ts`
- Test: Create `apps/frontend/src/features/ticket-board/constants/__tests__/statusFilters.test.ts`; extend `components/__tests__/TicketListRow.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`status` comma list, `overdue=true`), Task 2 (`critical`), existing `waitingVendor` in stats.
- Produces in `statusFilters.ts`: `DONE_STATUS_FILTER = 'RESOLVED,CLOSED'`, `ACTIVE_STATUS_FILTER = 'TODO,IN_PROGRESS,WAITING_VENDOR'`, `statusFilterLabel(value: string): string` (`'RESOLVED,CLOSED'` → `'Selesai'`, `ACTIVE_STATUS_FILTER` → `'Aktif'`, single values → existing labels).
- New page state `overdueFilter: boolean` → `params.append('overdue','true')`; included in the query key and `clearFilters`.
- Cards (7, grid `lg:grid-cols-7`): Total, Open, In Progress, **Waiting Vendor** (icon `Hourglass`, amber tokens, `setStatusFilter('WAITING_VENDOR')`), Resolved (`DONE_STATUS_FILTER`), Overdue (toggles `overdueFilter`, clears status), Critical (`priority=CRITICAL` + `ACTIVE_STATUS_FILTER`).
- Dropdown adds `{ value: DONE_STATUS_FILTER, label: 'Selesai (Resolved + Closed)' }` after Closed.
- Row: flame/red dot rendered only when `priority === 'CRITICAL' && !isTerminalStatus(status)` (`ticket-detail/constants.ts`).

- [ ] **Step 1: Failing tests:** `statusFilterLabel` cases above; `TicketListRow hides flame for CLOSED critical ticket`, `shows flame for IN_PROGRESS critical ticket`.
- [ ] **Step 2: Run** each file: `npx vitest run src/features/ticket-board/constants/__tests__/statusFilters.test.ts`, then `npx vitest run src/features/ticket-board/components/__tests__/TicketListRow.test.tsx` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** both → PASS. `npx tsc --noEmit -p apps/frontend` → no new errors.
- [ ] **Step 5: Commit** `fix(ticket-list): resolved card shows all finished tickets, add waiting vendor and overdue filters`

### Task 7: Paused SLA without target (frontend)

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/SlaProgress.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketSidebar.tsx:539-555`
- Modify: `apps/frontend/src/features/ticket-board/components/TargetDateCell.tsx:138-149`
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/types.ts:45` (add `lastPausedAt?: string | null` if missing)
- Test: Create `components/ticket-detail/__tests__/SlaProgress.test.tsx`; extend `components/__tests__/TargetDateCell.test.tsx`

**Interfaces:**
- `SlaProgress` new optional props `slaRemainingMinutes?: number | null`, `pausedAt?: string | null`. When paused: label `Dijeda · sisa <formatDuration(remaining*60000)>`; percent frozen at `(pausedAt − start) / (slaTarget − start)` (the target does not move during a pause, so this is the exact used ratio at pause time); `title` shows `Dijeda sejak <formatDateTimeID(pausedAt)>`, not the target.
- `TicketSidebar`: when status is WAITING_VENDOR, replace the "Target SLA" row with `InfoRow label="Dijeda sejak"` → `formatDateTimeID(lastPausedAt)`; target row hidden.
- `TargetDateCell` paused badge text: `Paused · sisa <x>` when `slaRemainingMinutes` is present, else `Paused`. Confirm the list payload includes `slaRemainingMinutes` (entity column, `ticket.entity.ts:252`); if `findAllPaginated` uses an explicit select, add it.
- WAITING_VENDOR → RESOLVED: verify `StatusSelect`, `QuickActionBar` and Kanban already offer Resolved from Waiting Vendor; if any path hides it, enable it. Backend already allows it (`applyStatusTransition`, `ticket-update.service.ts:111-138`).

- [ ] **Step 1: Failing tests:** `SlaProgress paused shows "Dijeda · sisa 2j 0m" and no target in title`; `SlaProgress paused freezes percent at pause time`; `TargetDateCell paused shows remaining`.
- [ ] **Step 2: Run** each test file alone → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** each → PASS.
- [ ] **Step 5: Commit** `fix(sla): show paused SLA as remaining time instead of a stale target`

### Task 8: Takeover confirmation on every status entry point (frontend)

**Files:**
- Create: `apps/frontend/src/features/ticket-board/hooks/useStatusTakeover.ts`
- Modify: `apps/frontend/src/features/ticket-board/components/ReassignConfirmDialog.tsx` (optional `onKeepAssignee?: () => void` → secondary button "Ubah status tanpa alihkan PIC"; optional `ticketsSummary?: { ticketNumber: string; assigneeName: string }[]` for bulk)
- Modify: `components/TicketListRow.tsx:135-141`, `hooks/useTicketListMutations.ts:98-134`, `pages/BentoTicketDetailPage.tsx:186-222`, `components/BentoTicketKanban.tsx:748-750,904-909,1117`, `components/BulkActionsBar.tsx:72`
- Test: Create `hooks/__tests__/useStatusTakeover.test.ts`; extend `components/__tests__/ReassignConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`takeover`, `keepAssignee`, `reason` body fields; 409 `{ code: 'REASSIGN_CONFIRMATION_REQUIRED', currentAssignee | tickets }`).
- Produces:
  ```ts
  export function needsTakeoverConfirm(
    ticket: { assignedTo?: { id: string } | null; status: string },
    newStatus: string, currentUserId: string,
  ): boolean; // true iff newStatus === 'IN_PROGRESS', status !== 'IN_PROGRESS', assignedTo && assignedTo.id !== currentUserId
  export function isTakeoverConflict(err: unknown): boolean; // axios 409 with that code
  export function useStatusTakeover(): {
    request: (ticket, newStatus, send: (opts: TakeoverOptions) => Promise<void>) => Promise<void>;
    dialogProps: ReassignConfirmDialogProps | null; // render <ReassignConfirmDialog {...dialogProps}/> when non-null
  };
  ```
  `request` opens the dialog when `needsTakeoverConfirm`, else calls `send({})` and, on `isTakeoverConflict`, opens the dialog with the server's `currentAssignee`. Confirm → `send({ takeover: true, reason })`; keep → `send({ keepAssignee: true })` (only offered to ADMIN/MANAGER). Dialog: current PIC → new PIC = current user.
- Mutations send `{ status, takeover?, keepAssignee?, reason? }` to `PATCH /tickets/:id/status`; bulk sends same flags to `PATCH /tickets/bulk/update`. Invalidate `['tickets']`, `['ticket', id]`, `['dashboard-stats']` after success (as today).

- [ ] **Step 1: Failing tests:** `needsTakeoverConfirm` truth table (PIC self → false, unassigned → false, other PIC + IN_PROGRESS → true, other PIC + WAITING_VENDOR → false); `isTakeoverConflict` true for 409+code, false for 409 without code; `ReassignConfirmDialog renders keep button only when onKeepAssignee is passed`.
- [ ] **Step 2: Run** each test file alone → FAIL.
- [ ] **Step 3: Implement** the hook and dialog props; wire the five call sites.
- [ ] **Step 4: Run** each file → PASS; `npx tsc --noEmit -p apps/frontend` → no new errors.
- [ ] **Step 5: Commit** `feat(tickets): confirm PIC takeover when another agent starts a ticket`

### Task 9: Manual verification

- [ ] Run the app (use the `run` skill). As agent B on a ticket assigned to A: list row, detail, quick action, Kanban drag, bulk → modal each time; confirm → PIC = B, timeline shows reason. As ADMIN → "tanpa alihkan PIC" keeps A.
- [ ] Cards: Resolved count == rows shown; Waiting Vendor and Overdue clickable; Critical excludes closed.
- [ ] Waiting Vendor ticket detail: no target date, "Dijeda · sisa …", extend by minutes works, Resolve directly works.
- [ ] Report results honestly, with any failing step quoted.
