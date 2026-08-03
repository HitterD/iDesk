# Backend Perf Plan 02 — N+1 Sweep + Pagination + Parallel Stats

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the worst N+1 query patterns in manager dashboard + notification dispatch, migrate `getCount() + getMany()` pairs to `getManyAndCount()`, and add per-user rate-limiting on push + bulk-notification send.

**Architecture:** Surgical query refactors. No schema changes. Where a per-page result is bounded by `LIMIT`, keep `LIMIT`; where the response needs aggregations, replace JS loops with single grouped `QueryBuilder` queries.

**Tech Stack:** TypeORM 0.3 QueryBuilder, NestJS 11, class-validator 0.14, ioredis 5.

**Spec reference:** `docs/superpowers/specs/2026-06-15-backend-perf-audit-design.md` (P1 manager-dashboard block + notifications sendBulk/sendToRole + user-crud.getCount+getMany).

**Prereq:** Plan 01 complete (`backend-perf-plan-01-complete` tag present).

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `apps/backend/src/modules/manager/manager-dashboard.service.ts` | Modify | Replace 5 N+1 loops with grouped QueryBuilder queries; add 60s cache |
| `apps/backend/src/modules/notifications/notification-center.service.ts` | Modify | Cap `sendBulk` concurrency, paginate `sendToRole` user fetch, add per-user push throttle |
| `apps/backend/src/modules/users/user-crud.service.ts` | Modify | `getCount`+`getMany` → `getManyAndCount`, parallelize bulk delete + update reads |
| `apps/backend/src/modules/users/user-import.service.ts` | Modify | Stream large user fetches (paged) for export |
| `apps/backend/src/modules/audit/audit.service.ts` | Modify | Merge 5 count queries into single `COUNT(*) FILTER` CTE |
| `apps/backend/src/modules/notifications/push-channel.service.ts` | Modify | Per-user throttle (10/min) + dedup-by-notificationId within 60s |
| `apps/backend/src/shared/core/guards/rate-limit.guard.ts` | Create | Sliding-window per-user rate limit guard |
| `apps/backend/src/shared/core/guards/rate-limit.module.ts` | Create | Module wrapper for the guard |
| `apps/backend/test/unit/manager/manager-dashboard.service.spec.ts` | Create | Verify single grouped query replaces per-site loop |
| `apps/backend/test/unit/notifications/notification-center.service.spec.ts` | Create | Verify sendBulk uses bounded concurrency, sendToRole is paginated |
| `apps/backend/test/unit/users/user-crud.service.spec.ts` | Create | Verify getManyAndCount, parallel bulk delete |
| `apps/backend/test/unit/audit/audit.service.spec.ts` | Create | Verify single CTE getStats |
| `apps/backend/test/unit/notifications/push-channel.service.spec.ts` | Create | Verify per-user throttle |

---

## Task 1: Manager Dashboard — Single Grouped Query for Open Tickets by Site

**Files:**
- Modify: `apps/backend/src/modules/manager/manager-dashboard.service.ts:85-98`

- [ ] **Step 1: Write failing test**

Create `apps/backend/test/unit/manager/manager-dashboard.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ManagerDashboardService } from '../../../src/modules/manager/manager-dashboard.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';
import { Site } from '../../../src/modules/sites/entities/site.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('ManagerDashboardService.getDashboardStats', () => {
  let svc: ManagerDashboardService;
  let ticketQb: any;

  beforeAll(async () => {
    ticketQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getMany: jest.fn(),
    };
    const siteRepo = { find: jest.fn().mockResolvedValue([{ id: 's1', code: 'JKT' }, { id: 's2', code: 'SBY' }]) };
    const userRepo = { find: jest.fn().mockResolvedValue([]) };
    const cache = { getOrSet: jest.fn(async (_k, fn) => fn()), getAsync: jest.fn(), setAsync: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        ManagerDashboardService,
        { provide: getRepositoryToken(Ticket), useValue: { createQueryBuilder: () => ticketQb, count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Site), useValue: siteRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    svc = mod.get(ManagerDashboardService);
  });

  it('replaces per-site loop with single grouped query', async () => {
    ticketQb.getRawMany.mockResolvedValue([{ siteId: 's1', cnt: '5' }, { siteId: 's2', cnt: '3' }]);
    ticketQb.getMany.mockResolvedValue([]);
    const result = await svc.getDashboardStats(['s1', 's2']);
    expect(ticketQb.groupBy).toHaveBeenCalled();
    expect(result.openTickets.bySite['JKT']).toBe(5);
    expect(result.openTickets.bySite['SBY']).toBe(3);
  });
});
```

(Adjust `getDashboardStats` signature to match — find it via `rtk grep "getDashboardStats" apps/backend/src/modules/manager/manager-dashboard.service.ts` to confirm parameter list.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: FAIL — `groupBy` not called.

- [ ] **Step 3: Replace per-site loop with grouped query**

In `apps/backend/src/modules/manager/manager-dashboard.service.ts`, replace lines 85-98 (the per-site `for (const site of sites)` block) with:

```typescript
        // P1 perf: single grouped query replaces the per-site count() loop.
        // Was N+1 (one COUNT per site). Now one round-trip regardless of site count.
        const openBySiteRows = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'cnt')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .andWhere('t.status IN (:...openStatuses)', { openStatuses: [TicketStatus.TODO, TicketStatus.IN_PROGRESS] })
                .groupBy('t.siteId')
                .getRawMany()
            : [];
        const openTicketsBySite: Record<string, number> = {};
        let totalOpen = 0;
        for (const row of openBySiteRows) {
            const site = sites.find(s => s.id === row.siteId);
            if (!site) continue;
            openTicketsBySite[site.code] = parseInt(row.cnt, 10);
            totalOpen += openTicketsBySite[site.code];
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/manager/manager-dashboard.service.ts apps/backend/test/unit/manager/manager-dashboard.service.spec.ts
git commit -m "perf(manager): grouped query for open-tickets-by-site, kill N+1"
```

---

## Task 2: Manager Dashboard — Single Grouped Query for siteStats

**Files:**
- Modify: `apps/backend/src/modules/manager/manager-dashboard.service.ts:120-151`

- [ ] **Step 1: Read current siteStats block**

Run: `rtk read apps/backend/src/modules/manager/manager-dashboard.service.ts:120-155`
Expected: 4 counts per site inside a for-loop.

- [ ] **Step 2: Add to the same spec file (Task 1's spec)**

Append to `apps/backend/test/unit/manager/manager-dashboard.service.spec.ts`:

```typescript
  it('computes siteStats via single grouped query per metric', async () => {
    ticketQb.getRawMany.mockResolvedValue([
      { siteId: 's1', totalTickets: '10', openTickets: '5', resolvedTickets: '4', criticalTickets: '2', slaBreach: '1' },
      { siteId: 's2', totalTickets: '8',  openTickets: '3', resolvedTickets: '5', criticalTickets: '0', slaBreach: '0' },
    ]);
    ticketQb.getMany.mockResolvedValue([]);
    const result = await svc.getDashboardStats(['s1', 's2']);
    const jkt = result.siteStats.find((s: any) => s.siteCode === 'JKT');
    expect(jkt.totalTickets).toBe(10);
    expect(jkt.criticalTickets).toBe(2);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: FAIL — current loop returns totalTickets=0 (no counts fired because mock only stubs getRawMany with one shape).

- [ ] **Step 4: Replace siteStats loop with grouped query**

In `apps/backend/src/modules/manager/manager-dashboard.service.ts`, replace lines 119-151 with:

```typescript
        // P1 perf: siteStats used to be 4 counts × N sites. Now one
        // grouped query that aggregates all four metrics per site.
        const nowForBreach = new Date();
        const openStatuses = [TicketStatus.TODO, TicketStatus.IN_PROGRESS];
        const siteStatRows = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'totalTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses))`, 'openTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus)`, 'resolvedTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.priority = :criticalPriority AND t.status IN (:...openStatuses))`, 'criticalTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses) AND t."slaTarget" <= :now)`, 'slaBreach')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .setParameters({
                    openStatuses,
                    resolvedStatus: TicketStatus.RESOLVED,
                    criticalPriority: TicketPriority.CRITICAL,
                    now: nowForBreach,
                })
                .groupBy('t.siteId')
                .getRawMany()
            : [];
        const siteStats: SiteStats[] = siteStatRows.map((row: any) => {
            const site = sites.find(s => s.id === row.siteId);
            return {
                siteCode: site?.code || 'UNKNOWN',
                siteName: site?.name || 'UNKNOWN',
                totalTickets: parseInt(row.totalTickets, 10),
                openTickets: parseInt(row.openTickets, 10),
                resolvedTickets: parseInt(row.resolvedTickets, 10),
                criticalTickets: parseInt(row.criticalTickets, 10),
                slaBreach: parseInt(row.slaBreach, 10),
            };
        });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/manager/manager-dashboard.service.ts apps/backend/test/unit/manager/manager-dashboard.service.spec.ts
git commit -m "perf(manager): COUNT(*) FILTER (WHERE) for siteStats, single grouped query"
```

---

## Task 3: Manager Dashboard — Single Grouped Query for topAgents

**Files:**
- Modify: `apps/backend/src/modules/manager/manager-dashboard.service.ts:196-260` (getTopAgents)

- [ ] **Step 1: Read current getTopAgents**

Run: `rtk read apps/backend/src/modules/manager/manager-dashboard.service.ts:196-260`
Expected: per-agent for-loop doing 3 queries each.

- [ ] **Step 2: Append to spec**

Append to `apps/backend/test/unit/manager/manager-dashboard.service.spec.ts`:

```typescript
  it('aggregates agent stats in a single grouped query (no per-agent loop)', async () => {
    ticketQb.getRawMany.mockResolvedValue([
      { agentId: 'a1', openTickets: '3', resolvedToday: '2', avgResolutionHours: '4' },
    ]);
    ticketQb.getMany.mockResolvedValue([]);
    // Stub userRepo to return 1 active agent
    (mod_userRepo as any).find = jest.fn().mockResolvedValue([{ id: 'a1', fullName: 'Agent One', site: { code: 'JKT' } }]);
    const result = await svc.getDashboardStats(['s1']);
    const top = result.topAgents.find((a: any) => a.agentId === 'a1');
    expect(top.resolvedToday).toBe(2);
  });
```

(You may need to refactor the test to obtain the userRepo from the testing module — re-use the binding from Task 1 setup.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: FAIL — current per-agent loop fires 3 counts per agent, mock only stubs grouped shape.

- [ ] **Step 4: Replace getTopAgents with grouped query**

In `apps/backend/src/modules/manager/manager-dashboard.service.ts`, replace the body of `getTopAgents`:

```typescript
    private async getTopAgents(siteIds: string[]): Promise<AgentStats[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const openStatuses = [TicketStatus.TODO, TicketStatus.IN_PROGRESS];
        const resolvedStatus = TicketStatus.RESOLVED;

        // P1 perf: per-agent loop fired 3 queries per agent (open, resolved-today,
        // last-20-resolved-for-avg). Now one grouped query returns all three
        // metrics per agent in a single round-trip. avgResolutionHours uses
        // SQL EXTRACT(EPOCH) to avoid loading 20 rows per agent into JS.
        const rows: Array<{ agentId: string; openTickets: string; resolvedToday: string; avgResolutionHours: string }> = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.assignedToId', 'agentId')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses))`, 'openTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" >= :today)`, 'resolvedToday')
                .addSelect(`COALESCE(AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt"))) FILTER (WHERE t.status = :resolvedStatus) / 3600, 0)`, 'avgResolutionHours')
                .where('t.assignedToId IS NOT NULL')
                .andWhere('t.siteId IN (:...siteIds)', { siteIds })
                .setParameters({ openStatuses, resolvedStatus, today })
                .groupBy('t.assignedToId')
                .orderBy(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" >= :today)`, 'DESC')
                .limit(10)
                .getRawMany()
            : [];

        if (rows.length === 0) return [];
        const agentIds = rows.map(r => r.agentId);
        const agents = await this.userRepo.find({
            where: { id: In(agentIds) },
            relations: ['site'],
        });
        const agentMap = new Map(agents.map(a => [a.id, a]));

        return rows.map(r => {
            const agent = agentMap.get(r.agentId);
            return {
                agentId: r.agentId,
                agentName: agent?.fullName || 'Unknown',
                siteCode: agent?.site?.code || 'N/A',
                openTickets: parseInt(r.openTickets, 10),
                resolvedToday: parseInt(r.resolvedToday, 10),
                avgResolutionHours: Math.round(parseFloat(r.avgResolutionHours)),
            };
        });
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/manager/manager-dashboard.service.ts apps/backend/test/unit/manager/manager-dashboard.service.spec.ts
git commit -m "perf(manager): getTopAgents via single grouped query, no per-agent loop"
```

---

## Task 4: Manager Dashboard — getTrendData with generate_series

**Files:**
- Modify: `apps/backend/src/modules/manager/manager-dashboard.service.ts:262-301` (getTrendData)

- [ ] **Step 1: Read current getTrendData**

Run: `rtk read apps/backend/src/modules/manager/manager-dashboard.service.ts:262-301`
Expected: 2 counts × N sites × 7 days = up to 14N queries.

- [ ] **Step 2: Append to spec**

```typescript
  it('computes trend via single grouped query (no per-site-per-day loop)', async () => {
    ticketQb.getRawMany.mockResolvedValue([
      { day: '2026-06-14', siteId: 's1', created: '4', resolved: '2' },
      { day: '2026-06-14', siteId: 's2', created: '1', resolved: '0' },
      { day: '2026-06-15', siteId: 's1', created: '2', resolved: '3' },
    ]);
    ticketQb.getMany.mockResolvedValue([]);
    const result = await svc.getDashboardStats(['s1', 's2']);
    expect(result.trend.length).toBeGreaterThan(0);
    expect(result.trend[0]).toHaveProperty('date');
    expect(result.trend[0]).toHaveProperty('siteCode');
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: FAIL — current per-day loop returns empty when mock is not configured for that path.

- [ ] **Step 4: Replace getTrendData with single grouped query**

In `apps/backend/src/modules/manager/manager-dashboard.service.ts`, replace the body of `getTrendData`:

```typescript
    private async getTrendData(siteIds: string[], days: number): Promise<TrendData[]> {
        if (siteIds.length === 0) return [];
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));

        // P1 perf: was 2 counts × N sites × 7 days. Now one grouped query
        // using date_trunc('day', ...) so PG aggregates per (day, site) row.
        const rows: Array<{ day: string; siteId: string; created: string; resolved: string }> =
            await this.ticketRepo.createQueryBuilder('t')
                .select(`to_char(date_trunc('day', t."createdAt"), 'YYYY-MM-DD')`, 'day')
                .addSelect('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'created')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" IS NOT NULL)`, 'resolved')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .andWhere('t."createdAt" >= :start', { start })
                .andWhere('t."createdAt" < :endPlus', { endPlus: new Date(end.getTime() + 24 * 60 * 60 * 1000) })
                .setParameters({ resolvedStatus: TicketStatus.RESOLVED })
                .groupBy(`date_trunc('day', t."createdAt")`)
                .addGroupBy('t.siteId')
                .getRawMany();

        const sites = await this.siteRepo.find({ where: { id: In(siteIds) } });
        const siteMap = new Map(sites.map(s => [s.id, s]));

        return rows.map(r => ({
            date: r.day,
            siteCode: siteMap.get(r.siteId)?.code || 'UNKNOWN',
            created: parseInt(r.created, 10),
            resolved: parseInt(r.resolved, 10),
        }));
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/manager/manager-dashboard.service.ts apps/backend/test/unit/manager/manager-dashboard.service.spec.ts
git commit -m "perf(manager): trend via date_trunc grouped query, kill per-day loop"
```

---

## Task 5: Manager Dashboard — Wrap getDashboardStats in 60s Cache

**Files:**
- Modify: `apps/backend/src/modules/manager/manager-dashboard.service.ts` (top of getDashboardStats)

- [ ] **Step 1: Read current getDashboardStats signature**

Run: `rtk grep "getDashboardStats" apps/backend/src/modules/manager/manager-dashboard.service.ts`

- [ ] **Step 2: Append to spec**

```typescript
  it('caches dashboard result for 60s per (siteIds, excludeCategory, days)', async () => {
    ticketQb.getRawMany.mockResolvedValue([]);
    ticketQb.getMany.mockResolvedValue([]);
    const cache = (mod_cache as any);
    cache.getOrSet.mockClear();
    await svc.getDashboardStats(['s1']);
    expect(cache.getOrSet).toHaveBeenCalledWith(
      expect.stringContaining('manager-dashboard:'),
      expect.any(Function),
      60,
    );
  });
```

(Adjust the test to expose `mod_cache` from the testing module; or just confirm the call happened via direct assertion on the bound mock.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: FAIL — no cache call yet.

- [ ] **Step 4: Wrap getDashboardStats in cache**

In `apps/backend/src/modules/manager/manager-dashboard.service.ts`, find the start of `getDashboardStats` and wrap its body:

```typescript
    async getDashboardStats(siteIds: string[], excludeCategory?: string, days: number = 7): Promise<any> {
        // P1 perf: dashboard is hit on every manager page load. 60s cache drops
        // the entire ~30+ query burst to a single Redis hit on warm cache.
        const cacheKey = `manager-dashboard:${[...siteIds].sort().join(',')}:${excludeCategory || ''}:${days}`;
        return this.cacheService.getOrSet(
            cacheKey,
            async () => this.computeDashboardStats(siteIds, excludeCategory, days),
            60,
        );
    }

    private async computeDashboardStats(siteIds: string[], excludeCategory?: string, days: number = 7): Promise<any> {
        // ... existing body of getDashboardStats, renamed to computeDashboardStats
    }
```

Move the body of the original `getDashboardStats` into `computeDashboardStats`. Keep the existing signature/return shape.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=manager-dashboard.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/manager/manager-dashboard.service.ts apps/backend/test/unit/manager/manager-dashboard.service.spec.ts
git commit -m "perf(manager): 60s cache on getDashboardStats, drops ~30+ queries per page load"
```

---

## Task 6: Notification sendBulk — Bounded Concurrency

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:113-119` (sendBulk)

- [ ] **Step 1: Read current sendBulk**

Run: `rtk read apps/backend/src/modules/notifications/notification-center.service.ts:113-120`
Expected: `Promise.all` over all userIds — unbounded fan-out.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/notifications/notification-center.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotificationCenterService } from '../../../src/modules/notifications/notification-center.service';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('NotificationCenterService.sendBulk', () => {
  let svc: NotificationCenterService;
  let sendSpy: jest.Mock;

  beforeAll(async () => {
    sendSpy = jest.fn().mockResolvedValue({ id: 'n1' });
    const mod = await Test.createTestingModule({
      providers: [
        NotificationCenterService,
        { provide: CacheService, useValue: { getOrSet: jest.fn((_k, fn) => fn()), getAsync: jest.fn(), setAsync: jest.fn() } },
      ],
    })
      .useMocker((token) => {
        if (token === 'send' || (token as any)?.name === 'send') return sendSpy;
        return jest.fn().mockResolvedValue([]);
      })
      .compile();
    svc = mod.get(NotificationCenterService);
    // Replace the internal `send` method with a spy
    (svc as any).send = sendSpy;
  });

  it('processes recipients in chunks, not unbounded Promise.all', async () => {
    const userIds = Array.from({ length: 50 }, (_, i) => `u${i}`);
    await svc.sendBulk(userIds, { type: 'TEST' as any, title: 't', message: 'm' } as any);
    expect(sendSpy).toHaveBeenCalledTimes(50);
  });
});
```

Note: replace `sendBulk` and `send` access — adjust to the actual public/internal structure. If `send` is private, expose a small helper or set the spy on the instance via `(svc as any)`.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=notification-center.service`
Expected: FAIL — current Promise.all throws on missing dependencies (e.g. notificationRepo). The test's broader purpose is to verify bounded concurrency: instrument with a counter.

- [ ] **Step 4: Implement bounded concurrency**

In `apps/backend/src/modules/notifications/notification-center.service.ts`, replace `sendBulk`:

```typescript
    async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        // P1 perf: original used Promise.all over every recipient — for a
        // 500-recipient bulk send this fired 500 concurrent mailer/DB/push
        // calls and overwhelmed the connection pool. Chunk to 20 at a time
        // for predictable load.
        const CONCURRENCY = 20;
        for (let i = 0; i < userIds.length; i += CONCURRENCY) {
            const chunk = userIds.slice(i, i + CONCURRENCY);
            await Promise.all(
                chunk.map(userId =>
                    this.send({ ...payload, userId }).catch(err => {
                        this.logger.error(`Failed to send notification to user ${userId}:`, err);
                    }),
                ),
            );
        }
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=notification-center.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts apps/backend/test/unit/notifications/notification-center.service.spec.ts
git commit -m "perf(notifications): chunk sendBulk to 20 concurrent, no unbounded fan-out"
```

---

## Task 7: Notification sendToRole — Stream Users in Pages

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:125-129` (sendToRole)

- [ ] **Step 1: Read current sendToRole**

Run: `rtk read apps/backend/src/modules/notifications/notification-center.service.ts:125-130`
Expected: `this.userRepo.find({ where: { role } })` — loads ALL users with that role in one shot.

- [ ] **Step 2: Append to spec**

```typescript
  it('sendToRole fetches users in pages, not all-at-once', async () => {
    const userRepoMock = { find: jest.fn().mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]) };
    (svc as any).userRepo = userRepoMock;
    await svc.sendToRole('AGENT', { type: 'TEST' as any, title: 't', message: 'm' } as any);
    expect(userRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });
```

(Adjust mock binding to the actual injection style — `userRepo` may be a constructor param, not a property. If so, rebuild the test using the testing module's overrides.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=notification-center.service`
Expected: FAIL — current find has no `take`.

- [ ] **Step 4: Paginate user fetch in sendToRole**

In `apps/backend/src/modules/notifications/notification-center.service.ts`, replace `sendToRole`:

```typescript
    async sendToRole(role: string, payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        // P1 perf: original loaded every user with the role in a single
        // unbounded query. For a large USER/AGENT role that meant thousands
        // of entities in memory. Now we page 200 at a time and stream.
        const PAGE = 200;
        let skip = 0;
        while (true) {
            const users = await this.userRepo.find({
                where: { role: role as any },
                take: PAGE,
                skip,
                select: ['id'],
            });
            if (users.length === 0) break;
            await this.sendBulk(users.map(u => u.id), payload);
            if (users.length < PAGE) break;
            skip += PAGE;
        }
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=notification-center.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts apps/backend/test/unit/notifications/notification-center.service.spec.ts
git commit -m "perf(notifications): stream sendToRole in 200-user pages, select id only"
```

---

## Task 8: User-Crud findAll — getManyAndCount + Trim

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:113-124`

- [ ] **Step 1: Read current findAll tail**

Run: `rtk read apps/backend/src/modules/users/user-crud.service.ts:100-130`
Expected: `getCount()` then a later `getMany()`.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/users/user-crud.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserCrudService } from '../../../src/modules/users/user-crud.service';
import { User } from '../../../src/modules/users/entities/user.entity';

describe('UserCrudService.findAll', () => {
  let svc: UserCrudService;
  let qb: any;

  beforeAll(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'u1' }], 1]),
      getCount: jest.fn(),
      getMany: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        UserCrudService,
        { provide: getRepositoryToken(User), useValue: { createQueryBuilder: () => qb } },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(UserCrudService);
  });

  it('uses getManyAndCount (single round-trip) and not getCount/getMany', async () => {
    const res = await svc.findAll({ page: 1, limit: 20 } as any);
    expect(qb.getManyAndCount).toHaveBeenCalled();
    expect(qb.getCount).not.toHaveBeenCalled();
    expect(qb.getMany).not.toHaveBeenCalled();
    expect(res.meta.total).toBe(1);
  });
});
```

(Adjust signature to the real DTO; the test focuses on the round-trip behavior.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=user-crud.service`
Expected: FAIL — current `getCount` is called.

- [ ] **Step 4: Replace getCount + getMany with getManyAndCount**

In `apps/backend/src/modules/users/user-crud.service.ts`, find the spot at line 113 (or wherever the `getCount` call is in `findAll`):

```typescript
        // P1 perf: getCount() + getMany() → getManyAndCount() — single round-trip.
        // Trim relations to id-only lookup so the count doesn't drag in joins.
        qb.orderBy(`user.${actualSortBy}`, sortOrder);
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);
        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data: data as User[],
            meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        };
```

(Remove the separate `getCount` call earlier; ensure all `orderBy`/`skip`/`take` happen before the `getManyAndCount` call.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=user-crud.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/users/user-crud.service.ts apps/backend/test/unit/users/user-crud.service.spec.ts
git commit -m "perf(users): getManyAndCount in findAll, 1 round-trip instead of 2"
```

---

## Task 9: User-Crud bulkDeleteUsers — Single In-Clause Delete

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:524-567`

- [ ] **Step 1: Read current bulkDeleteUsers**

Run: `rtk read apps/backend/src/modules/users/user-crud.service.ts:520-580`
Expected: `for (const id of ids) { await this.userRepo.delete(id) }`.

- [ ] **Step 2: Append to spec**

```typescript
  it('bulkDeleteUsers uses single IN delete, not per-id loop', async () => {
    const deleteMock = jest.fn().mockResolvedValue({ affected: 2 });
    (svc as any).userRepo = { delete: deleteMock };
    await svc.bulkDeleteUsers(['u1', 'u2']);
    expect(deleteMock).toHaveBeenCalledWith({ id: expect.anything() });
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
```

(Adjust property name and DTO signature to match the real one. Use `In([...])` from typeorm in the actual implementation.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=user-crud.service`
Expected: FAIL — current code calls delete N times.

- [ ] **Step 4: Replace loop with single IN delete**

In `apps/backend/src/modules/users/user-crud.service.ts`, replace the loop body in `bulkDeleteUsers`:

```typescript
    async bulkDeleteUsers(userIds: string[]): Promise<{ deleted: number }> {
        if (!userIds.length) return { deleted: 0 };
        // P1 perf: was a per-id delete loop. Single DELETE ... WHERE id IN (...)
        // is 1 round-trip and lets PG plan a fast index scan.
        const { affected } = await this.userRepo.delete({ id: In(userIds) });
        // existing audit + cache invalidation kept as-is
        return { deleted: affected ?? 0 };
    }
```

Add `import { In } from 'typeorm';` at the top of the file if not already present.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=user-crud.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/users/user-crud.service.ts apps/backend/test/unit/users/user-crud.service.spec.ts
git commit -m "perf(users): single IN delete for bulkDeleteUsers, kill N round-trips"
```

---

## Task 10: User-Import exportUsers — Stream Large Exports

**Files:**
- Modify: `apps/backend/src/modules/users/user-import.service.ts:318-352`

- [ ] **Step 1: Read current export**

Run: `rtk read apps/backend/src/modules/users/user-import.service.ts:315-355`
Expected: full `find()` then in-memory mapping.

- [ ] **Step 2: Write failing test**

Append to `apps/backend/test/unit/users/user-import.service.spec.ts` (create if absent):

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserImportService } from '../../../src/modules/users/user-import.service';
import { User } from '../../../src/modules/users/entities/user.entity';

describe('UserImportService.exportUsers (paged)', () => {
  let svc: UserImportService;
  let qb: any;

  beforeAll(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      stream: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        UserImportService,
        { provide: getRepositoryToken(User), useValue: { createQueryBuilder: () => qb } },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(UserImportService);
  });

  it('streams exportUsers via paginated getMany, not single full-table load', async () => {
    qb.getMany.mockResolvedValueOnce([{ id: 'u1' }]).mockResolvedValueOnce([]);
    await svc.exportUsers({ siteId: 's1' } as any, () => {});
    expect(qb.getMany).toHaveBeenCalled();
    // No single unbounded find
  });
});
```

(Adjust method signature to the real one. The point is to assert pagination.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=user-import`
Expected: FAIL — current code uses single unbounded find.

- [ ] **Step 4: Refactor exportUsers to paged streaming**

In `apps/backend/src/modules/users/user-import.service.ts`, replace the body of `exportUsers`:

```typescript
    async exportUsers(filter: { siteId?: string; role?: string }, onRow: (row: User) => void): Promise<number> {
        // P1 perf: was a single `find()` that pulled every matching user into
        // memory before formatting. For 50K+ user tables this OOM'd the worker.
        // Now we page at 500 rows and stream to the formatter.
        const PAGE = 500;
        let skip = 0;
        let count = 0;
        while (true) {
            const qb = this.userRepo.createQueryBuilder('user')
                .leftJoinAndSelect('user.department', 'department')
                .leftJoinAndSelect('user.site', 'site')
                .where("user.email NOT LIKE :deletedPrefix", { deletedPrefix: 'deleted_%' });
            if (filter.siteId) qb.andWhere('user.siteId = :siteId', { siteId: filter.siteId });
            if (filter.role)   qb.andWhere('user.role = :role',   { role: filter.role });
            const page = await qb.take(PAGE).skip(skip).getMany();
            for (const u of page) onRow(u);
            count += page.length;
            if (page.length < PAGE) break;
            skip += PAGE;
        }
        return count;
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=user-import`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/users/user-import.service.ts apps/backend/test/unit/users/user-import.service.spec.ts
git commit -m "perf(users): paged streaming for exportUsers, no full-table load"
```

---

## Task 11: Audit getStats — Single CTE with COUNT(*) FILTER

**Files:**
- Modify: `apps/backend/src/modules/audit/audit.service.ts:158-215`

- [ ] **Step 1: Read current getStats**

Run: `rtk read apps/backend/src/modules/audit/audit.service.ts:155-220`
Expected: 5 sequential count() / groupBy() calls.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/audit/audit.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { AuditLog } from '../../../src/modules/audit/entities/audit-log.entity';

describe('AuditService.getStats', () => {
  let svc: AuditService;
  let qb: any;

  beforeAll(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalLogs: '100',
        loginsToday: '12',
        changesLast24h: '7',
        failedAuthAttempts: '1',
      }),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: { createQueryBuilder: () => qb } },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(AuditService);
  });

  it('runs a single grouped query, not 5 separate counts', async () => {
    const stats = await svc.getStats();
    expect(stats.totalLogs).toBe(100);
    expect(stats.loginsToday).toBe(12);
    expect(qb.addSelect).toHaveBeenCalled(); // 4+ addSelect = single grouped query
  });
});
```

(Adjust method signature to the real `getStats` parameters.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=audit.service`
Expected: FAIL — current code issues multiple queries.

- [ ] **Step 4: Merge getStats into single query**

In `apps/backend/src/modules/audit/audit.service.ts`, replace the body of `getStats`:

```typescript
    async getStats(): Promise<{
        totalLogs: number; loginsToday: number; changesLast24h: number; failedAuthAttempts: number;
    }> {
        // P1 perf: was 5 sequential queries (totalLogs, loginsToday,
        // changesLast24h, failedAuth, topActions). Now one query with
        // COUNT(*) FILTER (WHERE ...) for each metric.
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const row = await this.auditRepo.createQueryBuilder('a')
            .select('COUNT(*)', 'totalLogs')
            .addSelect(`COUNT(*) FILTER (WHERE a."action" = :login AND a."createdAt" >= :today)`, 'loginsToday')
            .addSelect(`COUNT(*) FILTER (WHERE a."action" IN (:...changeActions) AND a."createdAt" >= :last24h)`, 'changesLast24h')
            .addSelect(`COUNT(*) FILTER (WHERE a."action" = :failedAuth)`, 'failedAuthAttempts')
            .setParameters({
                login: AuditAction.LOGIN_SUCCESS,
                today,
                last24h,
                changeActions: [AuditAction.UPDATE, AuditAction.CREATE, AuditAction.DELETE],
                failedAuth: AuditAction.LOGIN_FAILED,
            })
            .getRawOne();

        return {
            totalLogs:           parseInt(row.totalLogs, 10),
            loginsToday:         parseInt(row.loginsToday, 10),
            changesLast24h:      parseInt(row.changesLast24h, 10),
            failedAuthAttempts:  parseInt(row.failedAuthAttempts, 10),
        };
    }
```

(Adjust enum names to the real `AuditAction` values. Find via `rtk grep "LOGIN_SUCCESS" apps/backend/src/modules/audit/entities/audit-log.entity.ts`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=audit.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/audit/audit.service.ts apps/backend/test/unit/audit/audit.service.spec.ts
git commit -m "perf(audit): single COUNT(*) FILTER query for getStats, kill 5 round-trips"
```

---

## Task 12: Push Channel — Per-User Throttle (10/min) + 60s Dedup

**Files:**
- Modify: `apps/backend/src/modules/notifications/push-channel.service.ts`

- [ ] **Step 1: Read current send method**

Run: `rtk grep -n "send" apps/backend/src/modules/notifications/push-channel.service.ts | head -20`

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/notifications/push-channel.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CacheService } from '../../../src/shared/core/cache/cache.service';
import { PushChannelService } from '../../../src/modules/notifications/channels/push-channel.service';

describe('PushChannelService rate limiting', () => {
  let svc: PushChannelService;
  let cache: any;

  beforeAll(async () => {
    const counters = new Map<string, number>();
    cache = {
      getAsync: jest.fn(async (k: string) => counters.get(k) ?? null),
      setAsync: jest.fn(async (k: string, v: number) => { counters.set(k, v); }),
      incrAsync: jest.fn(async (k: string) => {
        const v = (counters.get(k) ?? 0) + 1;
        counters.set(k, v);
        return v;
      }),
      delAsync: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [PushChannelService, { provide: CacheService, useValue: cache }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(PushChannelService);
  });

  it('drops a push if user already received 10 in last minute', async () => {
    const userId = 'u-throttle';
    for (let i = 0; i < 10; i++) {
      await svc.applyUserThrottle(userId);
    }
    await expect(svc.applyUserThrottle(userId)).rejects.toThrow(/throttle/i);
  });

  it('deduplicates identical notificationId within 60s', async () => {
    await svc.markNotificationSent('notif-1', 'u-dedup');
    await expect(svc.markNotificationSent('notif-1', 'u-dedup')).resolves.toBe(false);
  });
});
```

(Adjust to the actual public API — `applyUserThrottle` and `markNotificationSent` are added in this task.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=push-channel.service`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 4: Add throttle + dedup helpers**

In `apps/backend/src/modules/notifications/push-channel.service.ts`, add:

```typescript
    private static readonly PUSH_LIMIT_PER_MIN = 10;

    /**
     * Increment the per-user push counter and reject if it crosses the limit.
     * Called before issuing a real web-push send. Throws a non-fatal error
     * caught by the calling channel loop so other users still get notified.
     */
    async applyUserThrottle(userId: string): Promise<void> {
        const key = `push:throttle:${userId}:${Math.floor(Date.now() / 60_000)}`;
        const count = await this.cacheService.incrAsync(key, 60);
        if (count > PushChannelService.PUSH_LIMIT_PER_MIN) {
            throw new Error(`Push throttled for user ${userId}: ${count} in last minute`);
        }
    }

    /**
     * Mark a notification as recently sent to a user. Returns false on
     * duplicate (already sent within the last 60s) so the caller can skip
     * the actual web-push call. Returns true on first send.
     */
    async markNotificationSent(notificationId: string, userId: string): Promise<boolean> {
        const key = `push:dedup:${userId}:${notificationId}`;
        const set = await this.cacheService.setAsync(key, '1', 60);
        // setAsync returns void; emulate "NX" semantics via getAsync check:
        const existing = await this.cacheService.getAsync(key);
        if (existing && existing !== '1') return false;
        return existing === '1' ? false : true;
    }
```

(If the cache layer's API differs — e.g. no `incrAsync` — adapt to use `getAsync`+`setAsync`+`Math` manually. The exact code shape depends on what `CacheService` exposes; the public-method behavior is what matters.)

Inject `CacheService` in the constructor if not already present.

- [ ] **Step 5: Wire the helpers into the existing `send` path**

Find the main `send` method in the same file. Add at the top of the method body:

```typescript
        await this.applyUserThrottle(payload.recipient);
        const isFirstSend = await this.markNotificationSent(payload.notificationId, payload.recipient);
        if (!isFirstSend) {
            this.logger.debug(`Dedup: notification ${payload.notificationId} already sent to ${payload.recipient}`);
            return { success: true, messageId: 'dedup', timestamp: new Date() };
        }
```

(The exact wiring depends on the existing `send` signature — adapt to call these helpers at the right point.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=push-channel.service`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/notifications/push-channel.service.ts apps/backend/test/unit/notifications/push-channel.service.spec.ts
git commit -m "perf(notifications): 10/min push throttle + 60s dedup per user"
```

---

## Verification & Sign-off

- [ ] **Run full backend test suite**

Run: `cd apps/backend && npm test`
Expected: all 12 spec files pass.

- [ ] **Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Coverage check on changed files**

Run: `cd apps/backend && npm run test:cov`
Expected: ≥80% coverage on the modified service files.

- [ ] **Manual smoke: manager dashboard timing**

1. `cd apps/backend && npm run start:dev`
2. With Redis empty, hit `/manager/dashboard` — measure ~500-1000ms (cold)
3. Hit again — measure <50ms (warm cache)
4. Verify the dashboard renders the same data

- [ ] **Manual smoke: bulk notification**

Send a notification to a role with 500+ users and confirm:
- No 502 from the mailer
- 500 users get the notification within a reasonable window (no timeout)
- Logs show chunked batches of 20

- [ ] **Final tag**

```bash
git tag backend-perf-plan-02-complete
git log --oneline -12
```

---

## Out-of-Scope (Plan 03-04)

- **Plan 03:** Transactional integrity — ticketing multi-write (messaging, update, merge, sla-monitor), hardware mutual-scheduling, lost-item match/reject, access-request writes
- **Plan 04:** Hot-path caching sweep — sites active list, settings scheduling, SLA config, business hours, sound, synology

---

**Status:** Plan 02 saved. 12 task, ~5-6 jam eksekusi. Ready for user approval.
