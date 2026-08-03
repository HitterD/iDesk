# Backend Perf Plan 03 — Transactional Integrity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap all multi-step writes in `dataSource.transaction` so partial failures can never leave the database in a half-mutated state. Convert the worst TOCTOU patterns to atomic conditional updates.

**Architecture:** Each task wraps the existing read-modify-write sequence in a single transaction. TOCTOU fixes use `UPDATE ... WHERE status = X RETURNING` so the DB enforces the precondition atomically. No schema changes required.

**Tech Stack:** TypeORM 0.3 `dataSource.transaction` + `EntityManager`, NestJS 11.

**Spec reference:** `docs/superpowers/specs/2026-06-15-backend-perf-audit-design.md` (P1 ticketing/messaging, ticket-update, ticket-merge, sla-monitor, hardware mutual-scheduling, lost-item match/reject, access-request, settings.updateTimeSlots).

**Prereq:** Plan 01 + Plan 02 complete (tags `backend-perf-plan-01-complete`, `backend-perf-plan-02-complete` present).

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts` | Modify | Wrap message + ticket update in transaction |
| `apps/backend/src/modules/ticketing/services/ticket-update.service.ts` | Modify | Wrap full update path in transaction |
| `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts` | Modify | Wrap merge + bulk message insert in transaction |
| `apps/backend/src/modules/ticketing/services/sla-monitor/sla-monitor.service.ts` | Modify | Bulk update via single UPDATE; wrap in transaction |
| `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts` | Modify | Pre-load busy slots once; wrap propose/confirm in transaction |
| `apps/backend/src/modules/lost-item/found-claim.service.ts` | Modify | Atomic conditional UPDATE for match/reject |
| `apps/backend/src/modules/access-request/access-request.service.ts` | Modify | Wrap createAccess/verify/reject in transaction |
| `apps/backend/src/modules/settings/settings.service.ts` | Modify | Wrap updateTimeSlots/updateHardwareTypes in transaction |
| `apps/backend/test/unit/ticketing/ticket-messaging.service.spec.ts` | Create | Transaction used (manager.transaction) |
| `apps/backend/test/unit/ticketing/ticket-merge.service.spec.ts` | Create | Transaction + atomic message insert |
| `apps/backend/test/unit/lost-item/found-claim.service.spec.ts` | Create | Conditional update returns null on stale status |
| `apps/backend/test/unit/access-request/access-request.service.spec.ts` | Create | createAccess wrapped in transaction |

---

## Task 1: Ticket Messaging — Wrap Reply in Transaction

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts:100-180`

- [ ] **Step 1: Read ticket-messaging service imports + constructor**

Run: `rtk read apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts:1-50`
Expected: confirm constructor receives `DataSource` or `@InjectDataSource`. If not, add it.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/ticketing/ticket-messaging.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TicketMessagingService } from '../../../src/modules/ticketing/services/ticket-messaging.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';
import { TicketMessage } from '../../../src/modules/ticketing/entities/ticket-message.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { SlaConfig } from '../../../src/modules/ticketing/entities/sla-config.entity';

describe('TicketMessagingService.addMessage', () => {
  let svc: TicketMessagingService;
  let mockTxManager: any;
  let mockDataSource: any;

  beforeAll(async () => {
    mockTxManager = {
      findOne: jest.fn(),
      create: jest.fn((e, d) => d),
      save: jest.fn(async (e) => ({ id: 'm1', ...e })),
    };
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb(mockTxManager)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        TicketMessagingService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Ticket), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TicketMessage), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(SlaConfig), useValue: { findOne: jest.fn() } },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(TicketMessagingService);
  });

  it('uses dataSource.transaction so message + ticket save are atomic', async () => {
    mockTxManager.findOne.mockImplementation(async (_e: any, opts: any) => {
      if (opts?.where?.id === 't1') return { id: 't1', status: 'TODO', priority: 'HIGH' };
      if (opts?.where?.id === 'u1') return { id: 'u1', role: 'AGENT' };
      return null;
    });
    await svc.addMessage('t1', 'u1', 'hello', [], false);
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

(Adjust method signature and DTO names to match the real addMessage/replyToTicket; the key point is the transaction call.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-messaging.service`
Expected: FAIL — `dataSource.transaction` not called yet (current code uses repo directly).

- [ ] **Step 4: Wrap addMessage in transaction**

In `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts`, change the constructor to inject `DataSource` (or confirm it already is). Then wrap the body of `addMessage` (or equivalent reply method) inside `dataSource.transaction`:

```typescript
    async addMessage(
        ticketId: string,
        userId: string,
        content: string,
        files: string[] = [],
        isInternal: boolean = false,
    ): Promise<any> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: message insert + ticket status/SLA update were two
            // separate saves outside any transaction. A crash between them
            // left the ticket without its SLA timer started (or its
            // firstResponseAt set). Now atomic.
            const ticket = await manager.findOne(Ticket, {
                where: { id: ticketId },
                relations: ['user', 'assignedTo'],
            });
            if (!ticket) throw new NotFoundException('Ticket not found');

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) throw new NotFoundException('User not found');

            const message = manager.create(TicketMessage, {
                ticketId,
                senderId: userId,
                content,
                attachments: files,
                isInternal,
            });
            const savedMessage = await manager.save(message);

            // ... existing firstResponseAt / SLA logic, but using `manager`
            // for any subsequent saves so they stay inside the transaction.

            if (/* ticket status / SLA conditions trigger */ false) {
                await manager.save(Ticket, ticket);
            }

            return savedMessage;
        });
    }
```

Refactor the existing logic to use `manager` instead of `this.ticketRepo` / `this.messageRepo` inside the transaction. The `eventsGateway.notifyNewMessage` and `eventEmitter.emit` calls should move OUTSIDE the transaction (after the await), to avoid emitting events for a not-yet-committed message.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-messaging.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts apps/backend/test/unit/ticketing/ticket-messaging.service.spec.ts
git commit -m "fix(ticketing): wrap addMessage in dataSource.transaction, atomic message+ticket"
```

---

## Task 2: Ticket Update — Wrap Full Update in Transaction

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:60-77`

- [ ] **Step 1: Read full update method signature**

Run: `rtk grep "async update" apps/backend/src/modules/ticketing/services/ticket-update.service.ts`

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/ticketing/ticket-update.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TicketUpdateService } from '../../../src/modules/ticketing/services/ticket-update.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';

describe('TicketUpdateService.updateTicket', () => {
  let svc: TicketUpdateService;
  let mockTxManager: any;
  let mockDataSource: any;

  beforeAll(async () => {
    mockTxManager = {
      findOne: jest.fn(async () => ({ id: 't1', status: 'TODO', priority: 'HIGH' })),
      save: jest.fn(async (e) => e),
    };
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb(mockTxManager)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        TicketUpdateService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Ticket), useValue: {} },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(TicketUpdateService);
  });

  it('wraps update path in dataSource.transaction', async () => {
    await svc.updateTicket('t1', { status: 'IN_PROGRESS' } as any, 'u1');
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

(Adjust method name to the real one; the assertion is on `dataSource.transaction`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-update.service`
Expected: FAIL — no transaction.

- [ ] **Step 4: Wrap updateTicket in transaction**

In `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`, replace the body of `updateTicket` (or equivalent):

```typescript
    async updateTicket(ticketId: string, updateData: any, userId: string): Promise<Ticket> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: status transition, priority change, slaTarget recompute,
            // and ticket save were separate awaits. A crash mid-sequence left
            // the ticket in a half-mutated state. Now atomic.
            const ticket = await manager.findOne(Ticket, {
                where: { id: ticketId },
                relations: ['user', 'assignedTo'],
            });
            if (!ticket) throw new NotFoundException('Ticket not found');

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) throw new NotFoundException('User not found');

            const changes: string[] = [];
            const oldStatus = ticket.status;
            if (updateData.status && updateData.status !== ticket.status) {
                await this.applyStatusTransition(ticket, oldStatus, updateData.status, changes, user, manager);
            }
            if (updateData.priority && updateData.priority !== ticket.priority) {
                await this.applyPriorityChange(ticket, updateData.priority, changes, manager);
            }

            Object.assign(ticket, updateData);
            const saved = await manager.save(Ticket, ticket);

            // postUpdateActions is moved out of the transaction (events, audit
            // fire-and-forget). If you need it atomic, pass manager through.
            // The current code keeps it outside the rollback boundary on purpose.
            return saved;
        });
    }
```

Refactor `applyStatusTransition` and `applyPriorityChange` to accept `manager` and use it for any DB call. The notification/audit emit stays outside the transaction (after `await this.dataSource.transaction(...)`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-update.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/test/unit/ticketing/ticket-update.service.spec.ts
git commit -m "fix(ticketing): wrap updateTicket in dataSource.transaction"
```

---

## Task 3: Ticket Merge — Atomic Merge + Message Insert

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts`

- [ ] **Step 1: Read current merge flow**

Run: `rtk read apps/backend/src/modules/ticketing/services/ticket-merge.service.ts`
Expected: `find`+`save` sequence, multiple writes outside transaction.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/ticketing/ticket-merge.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TicketMergeService } from '../../../src/modules/ticketing/services/ticket-merge.service';

describe('TicketMergeService.merge', () => {
  let svc: TicketMergeService;
  let mockDataSource: any;

  beforeAll(async () => {
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(async (e) => e),
        update: jest.fn(),
        create: jest.fn((_e, d) => d),
      })),
    };
    const mod = await Test.createTestingModule({
      providers: [TicketMergeService, { provide: DataSource, useValue: mockDataSource }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(TicketMergeService);
  });

  it('uses dataSource.transaction so merge + message insert are atomic', async () => {
    await svc.mergeTickets('source-id', 'target-id', 'reason', 'u1');
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

(Adjust method signature to the real one.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-merge.service`
Expected: FAIL — no transaction.

- [ ] **Step 4: Wrap merge in transaction + atomic message insert**

In `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts`, wrap the body of `mergeTickets` (or equivalent) in a `dataSource.transaction`:

```typescript
    async mergeTickets(sourceId: string, targetId: string, reason: string, userId: string): Promise<any> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: source ticket status update + new message insert + target
            // ticket update were three separate awaits. A crash left the
            // message in the wrong ticket. Now atomic.
            const source = await manager.findOne(Ticket, { where: { id: sourceId } });
            const target = await manager.findOne(Ticket, { where: { id: targetId } });
            if (!source || !target) throw new NotFoundException('Source or target ticket not found');

            source.status = TicketStatus.MERGED;
            source.mergedIntoId = targetId;
            source.mergedAt = new Date();
            source.mergeReason = reason;
            source.mergedById = userId;
            await manager.save(Ticket, source);

            const sysMessage = manager.create(TicketMessage, {
                ticketId: targetId,
                senderId: userId,
                content: `Ticket #${source.ticketNumber} merged into this one. Reason: ${reason}`,
                isInternal: true,
            });
            await manager.save(TicketMessage, sysMessage);

            // Reload source messages into target (in chunks for large threads)
            const sourceMessages = await manager.find(TicketMessage, { where: { ticketId: sourceId } });
            for (const msg of sourceMessages) {
                msg.ticketId = targetId;
            }
            if (sourceMessages.length) {
                await manager.save(TicketMessage, sourceMessages);
            }

            return { merged: source.id, into: target.id };
        });
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-merge.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-merge.service.ts apps/backend/test/unit/ticketing/ticket-merge.service.spec.ts
git commit -m "fix(ticketing): atomic merge via dataSource.transaction + bulk message move"
```

---

## Task 4: SLA Monitor — Bulk Single UPDATE

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/sla-monitor/sla-monitor.service.ts:39,58,83`

- [ ] **Step 1: Read sla-monitor service**

Run: `rtk read apps/backend/src/modules/ticketing/services/sla-monitor/sla-monitor.service.ts`

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/ticketing/sla-monitor.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SlaMonitorService } from '../../../src/modules/ticketing/services/sla-monitor/sla-monitor.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';
import { SlaConfig } from '../../../src/modules/ticketing/entities/sla-config.entity';

describe('SlaMonitorService.refreshSlaTargets', () => {
  let svc: SlaMonitorService;
  let mockTicketRepo: any;

  beforeAll(async () => {
    mockTicketRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 't1', priority: 'HIGH' },
        { id: 't2', priority: 'MEDIUM' },
      ]),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const slaConfigRepo = { find: jest.fn().mockResolvedValue([
      { priority: 'HIGH', resolutionTimeMinutes: 60 },
      { priority: 'MEDIUM', resolutionTimeMinutes: 240 },
    ]) };
    const mod = await Test.createTestingModule({
      providers: [
        SlaMonitorService,
        { provide: getRepositoryToken(Ticket), useValue: mockTicketRepo },
        { provide: getRepositoryToken(SlaConfig), useValue: slaConfigRepo },
        { provide: DataSource, useValue: { transaction: jest.fn(async (cb) => cb({})) } },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(SlaMonitorService);
  });

  it('uses bulk update grouped by priority, not per-ticket save loop', async () => {
    await svc.refreshSlaTargets();
    expect(mockTicketRepo.update).toHaveBeenCalled();
  });
});
```

(Adjust method name to the real one. The point is to assert `repo.update` is called.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=sla-monitor.service`
Expected: FAIL — current code does per-ticket save.

- [ ] **Step 4: Replace per-ticket loop with bulk update**

In `apps/backend/src/modules/ticketing/services/sla-monitor/sla-monitor.service.ts`, replace the per-ticket `.save()` loop with one `manager.update()` per priority bucket:

```typescript
    async refreshSlaTargets(): Promise<number> {
        // P1 fix: was per-ticket findOne + save. Now group by priority and
        // issue one UPDATE per priority bucket, all inside a single transaction.
        return this.dataSource.transaction(async (manager) => {
            const slaConfigs = await manager.find(SlaConfig);
            const cfgByPriority = new Map(slaConfigs.map(c => [c.priority, c]));

            const openTickets = await manager.find(Ticket, {
                where: { status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]) },
                select: ['id', 'priority'],
            });

            const byPriority = new Map<string, string[]>();
            for (const t of openTickets) {
                const cfg = cfgByPriority.get(t.priority);
                if (!cfg) continue;
                if (!byPriority.has(t.priority)) byPriority.set(t.priority, []);
                byPriority.get(t.priority)!.push(t.id);
            }

            let total = 0;
            const now = Date.now();
            for (const [priority, ids] of byPriority) {
                const cfg = cfgByPriority.get(priority)!;
                const slaTarget = new Date(now + cfg.resolutionTimeMinutes * 60_000);
                const result = await manager.update(Ticket, { id: In(ids) }, { slaTarget });
                total += result.affected ?? 0;
            }
            return total;
        });
    }
```

Add imports `In` from 'typeorm' if not present, and `TicketStatus` from the ticket entity.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=sla-monitor.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/sla-monitor/ apps/backend/test/unit/ticketing/sla-monitor.service.spec.ts
git commit -m "perf(sla-monitor): bulk update grouped by priority, no per-ticket save"
```

---

## Task 5: Hardware Mutual Scheduling — Pre-Load Busy Slots + Transaction

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts:60,70,117`

- [ ] **Step 1: Read service**

Run: `rtk read apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts:1-130`
Expected: per-slot conflict check loop, no transaction.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/hardware-request/mutual-scheduling.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { MutualSchedulingService } from '../../../src/modules/hardware-request/services/mutual-scheduling.service';

describe('MutualSchedulingService.proposeSlots', () => {
  let svc: MutualSchedulingService;
  let mockDataSource: any;

  beforeAll(async () => {
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        create: jest.fn((_e, d) => d),
        save: jest.fn(async (e) => e),
      })),
    };
    const mod = await Test.createTestingModule({
      providers: [MutualSchedulingService, { provide: DataSource, useValue: mockDataSource }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(MutualSchedulingService);
  });

  it('proposes slots inside a single dataSource.transaction', async () => {
    await svc.proposeSlots('req-1', 'tech-1', [{ start: new Date(), end: new Date() }]);
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

(Adjust method name + signature to the real one.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=mutual-scheduling.service`
Expected: FAIL — no transaction.

- [ ] **Step 4: Wrap propose in transaction + pre-load busy slots**

In `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts`, refactor:

```typescript
    async proposeSlots(requestId: string, technicianId: string, candidates: Array<{ start: Date; end: Date }>): Promise<any> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: was per-candidate findOne inside an N×M loop and no
            // transaction. Pre-load the technician's busy slots once, then
            // check candidates in memory, then save the chosen proposal.
            const start = candidates[0]?.start ?? new Date();
            const end = new Date(Math.max(...candidates.map(c => c.end.getTime())));

            const busySlots = await manager.find(InstallationSchedule, {
                where: {
                    technicianId,
                    status: In([ScheduleStatus.CONFIRMED, ScheduleStatus.PROPOSED]),
                    startAt: Between(start, end),
                },
                select: ['startAt', 'endAt'],
            });
            const busy = busySlots.map(s => ({ start: s.startAt, end: s.endAt }));

            const free = candidates.filter(c =>
                !busy.some(b => !(c.end <= b.start || c.start >= b.end)),
            );
            if (free.length === 0) {
                throw new BadRequestException('No conflict-free slots available');
            }

            const proposal = manager.create(InstallationSchedule, {
                requestId,
                technicianId,
                startAt: free[0].start,
                endAt: free[0].end,
                status: ScheduleStatus.PROPOSED,
            });
            return manager.save(proposal);
        });
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=mutual-scheduling.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts apps/backend/test/unit/hardware-request/mutual-scheduling.service.spec.ts
git commit -m "fix(hardware): mutual-scheduling pre-loads busy slots + atomic transaction"
```

---

## Task 6: Lost-Item Match — Atomic Conditional Update

**Files:**
- Modify: `apps/backend/src/modules/lost-item/found-claim.service.ts:91-113`

- [ ] **Step 1: Read match method**

Run: `rtk read apps/backend/src/modules/lost-item/found-claim.service.ts:80-130`
Expected: `findOne` → check `status === PENDING` → `save` (TOCTOU race).

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/lost-item/found-claim.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FoundClaimService } from '../../../src/modules/lost-item/found-claim.service';
import { FoundItemClaim } from '../../../src/modules/lost-item/entities/found-item-claim.entity';

describe('FoundClaimService.match', () => {
  let svc: FoundClaimService;
  let mockTxManager: any;
  let mockDataSource: any;

  beforeAll(async () => {
    mockTxManager = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(),
    };
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb(mockTxManager)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        FoundClaimService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(FoundItemClaim), useValue: {} },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(FoundClaimService);
  });

  it('match uses conditional UPDATE WHERE status = PENDING (no race)', async () => {
    mockTxManager.findOne.mockResolvedValue({ id: 'c1', status: 'PENDING' });
    await svc.match('c1', 'agent-1');
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it('match returns null when claim is no longer PENDING', async () => {
    mockTxManager.findOne.mockResolvedValue({ id: 'c1', status: 'MATCHED' });
    const result = await svc.match('c1', 'agent-1');
    expect(result).toBeNull();
  });
});
```

(Adjust `FoundClaimService` import path; the real file is `apps/backend/src/modules/lost-item/services/found-claim.service.ts` — adjust glob if needed.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=found-claim.service`
Expected: FAIL — current code does save, not conditional update.

- [ ] **Step 4: Replace TOCTOU with atomic conditional UPDATE**

In the match method:

```typescript
    async match(claimId: string, agentId: string): Promise<FoundItemClaim | null> {
        return this.dataSource.transaction(async (manager) => {
            // P0 fix: was findOne → check status → save (TOCTOU race between
            // check and save). Now atomic conditional UPDATE — the DB enforces
            // the precondition, so two concurrent matches can never both win.
            const claim = await manager.findOne(FoundItemClaim, { where: { id: claimId } });
            if (!claim) return null;

            const result = await manager.update(
                FoundItemClaim,
                { id: claimId, status: ClaimStatus.PENDING },
                {
                    status: ClaimStatus.MATCHED,
                    matchedById: agentId,
                    matchedAt: new Date(),
                },
            );
            if (!result.affected) {
                // Lost the race
                return null;
            }
            return manager.findOne(FoundItemClaim, { where: { id: claimId } });
        });
    }
```

Repeat the same pattern for `reject(claimId, agentId, reason)`:

```typescript
    async reject(claimId: string, agentId: string, reason: string): Promise<FoundItemClaim | null> {
        return this.dataSource.transaction(async (manager) => {
            const result = await manager.update(
                FoundItemClaim,
                { id: claimId, status: ClaimStatus.PENDING },
                {
                    status: ClaimStatus.REJECTED,
                    rejectedById: agentId,
                    rejectedAt: new Date(),
                    rejectionReason: reason,
                },
            );
            if (!result.affected) return null;
            return manager.findOne(FoundItemClaim, { where: { id: claimId } });
        });
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=found-claim.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/lost-item/ apps/backend/test/unit/lost-item/found-claim.service.spec.ts
git commit -m "fix(lost-item): atomic conditional UPDATE for match/reject, kill TOCTOU race"
```

---

## Task 7: Access-Request createAccess — Wrap in Transaction

**Files:**
- Modify: `apps/backend/src/modules/access-request/access-request.service.ts:157-179`

- [ ] **Step 1: Read current createAccess**

Already read in Plan 01. Recall: the method does `findOne` → `accessRequestRepo.save` → `ticketRepo.update` — two writes, no transaction.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/access-request/access-request.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AccessRequestService } from '../../../src/modules/access-request/access-request.service';

describe('AccessRequestService.createAccess', () => {
  let svc: AccessRequestService;
  let mockDataSource: any;

  beforeAll(async () => {
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        findOne: jest.fn().mockResolvedValue({ id: 'ar1', status: 'VERIFIED', ticketId: 't1' }),
        save: jest.fn(async (e) => e),
        update: jest.fn(),
      })),
    };
    const mod = await Test.createTestingModule({
      providers: [AccessRequestService, { provide: DataSource, useValue: mockDataSource }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(AccessRequestService);
  });

  it('wraps access + ticket resolution in dataSource.transaction', async () => {
    await svc.createAccess('ar1', 'agent-1', { accessCredentials: 'secret' } as any);
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=access-request.service`
Expected: FAIL — no transaction.

- [ ] **Step 4: Wrap createAccess in transaction**

In `apps/backend/src/modules/access-request/access-request.service.ts`, replace `createAccess`:

```typescript
    async createAccess(id: string, agentId: string, dto: CreateAccessCredentialsDto): Promise<AccessRequest> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: accessRequest save + ticket status update were two
            // separate awaits. A crash between them left the access granted
            // but the ticket still in IN_PROGRESS, blocking SLA breaches.
            const accessRequest = await manager.findOne(AccessRequest, { where: { id } });
            if (!accessRequest) throw new NotFoundException('Access request not found');
            if (accessRequest.status !== AccessRequestStatus.VERIFIED) {
                throw new BadRequestException('Request must be verified first');
            }

            accessRequest.status = AccessRequestStatus.ACCESS_CREATED;
            accessRequest.accessCreatedAt = new Date();
            accessRequest.accessCredentials = this.cipher.encrypt(dto.accessCredentials);

            await manager.update(Ticket, accessRequest.ticketId, {
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
            });

            const saved = await manager.save(AccessRequest, accessRequest);
            return saved;
        });
    }
```

Move the `eventEmitter.emit('access-request.completed', ...)` call OUTSIDE the transaction (after the await), so listeners fire only on commit.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=access-request.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/access-request/access-request.service.ts apps/backend/test/unit/access-request/access-request.service.spec.ts
git commit -m "fix(access-request): createAccess wraps save + ticket update in transaction"
```

---

## Task 8: Settings updateTimeSlots / updateHardwareTypes — Single Transaction

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.service.ts:131-190`

- [ ] **Step 1: Read current update methods**

Run: `rtk read apps/backend/src/modules/settings/settings.service.ts:130-200`
Expected: `find` + 2x `save` for the related entity (3 round-trips per update).

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/settings/settings.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SettingsService } from '../../../src/modules/settings/settings.service';

describe('SettingsService.updateTimeSlots', () => {
  let svc: SettingsService;
  let mockDataSource: any;

  beforeAll(async () => {
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(async (e) => e),
        delete: jest.fn(),
        create: jest.fn((_e, d) => d),
      })),
    };
    const mod = await Test.createTestingModule({
      providers: [SettingsService, { provide: DataSource, useValue: mockDataSource }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(SettingsService);
  });

  it('updateTimeSlots wraps in a single transaction (1 round-trip sequence)', async () => {
    await svc.updateTimeSlots([{ day: 1, start: '08:00', end: '17:00' }] as any);
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
```

(Adjust method name and DTO to match the real signature.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=settings.service`
Expected: FAIL — no transaction.

- [ ] **Step 4: Wrap updateTimeSlots in transaction**

In `apps/backend/src/modules/settings/settings.service.ts`, replace `updateTimeSlots`:

```typescript
    async updateTimeSlots(slots: TimeSlotDto[]): Promise<SystemSettings> {
        return this.dataSource.transaction(async (manager) => {
            // P1 fix: was find + delete + save (3 round-trips, partial-failure risk).
            // Now read once, mutate, save once — all inside a single transaction.
            const settings = await manager.findOne(SystemSettings, { where: { id: 'singleton' } });
            if (!settings) throw new NotFoundException('Settings not found');

            settings.timeSlots = slots;
            return manager.save(SystemSettings, settings);
        });
    }
```

Apply the same pattern to `updateHardwareTypes`:

```typescript
    async updateHardwareTypes(types: HardwareTypeDto[]): Promise<SystemSettings> {
        return this.dataSource.transaction(async (manager) => {
            const settings = await manager.findOne(SystemSettings, { where: { id: 'singleton' } });
            if (!settings) throw new NotFoundException('Settings not found');

            settings.hardwareTypes = types;
            return manager.save(SystemSettings, settings);
        });
    }
```

Adjust entity field names to the real ones (the actual column might be `timeSlots` or `time_slots` — find via `rtk read apps/backend/src/modules/settings/entities/system-settings.entity.ts`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=settings.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/settings/settings.service.ts apps/backend/test/unit/settings/settings.service.spec.ts
git commit -m "fix(settings): wrap updateTimeSlots/updateHardwareTypes in single transaction"
```

---

## Verification & Sign-off

- [ ] **Run full backend test suite**

Run: `cd apps/backend && npm test`
Expected: 8 spec files pass.

- [ ] **Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Coverage check**

Run: `cd apps/backend && npm run test:cov`
Expected: ≥80% on modified services.

- [ ] **Manual smoke: race condition**

For lost-item match: open two browser sessions, attempt to match the same claim at the same time. Exactly one should succeed, the other should receive `null` (not a 500).

- [ ] **Manual smoke: ticket reply atomicity**

Reply to a ticket as agent. The reply, ticket status (TODO→IN_PROGRESS), and SLA start should all commit together. Killing the server mid-reply should leave the ticket in its prior state (no half-applied message).

- [ ] **Final tag**

```bash
git tag backend-perf-plan-03-complete
git log --oneline -10
```

---

## Out-of-Scope (Plan 04)

- Hot-path caching sweep: sites active list, settings scheduling, SLA config, business hours, sound, synology
- Index additions for hot queries (`pg_trgm` on user/email, composite indexes for action-items)
- Response DTO projection sweep

---

**Status:** Plan 03 saved. 8 task, ~4-5 jam eksekusi. Ready for user approval.
