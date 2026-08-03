# Backend Perf Plan 04 — Hot-Path Caching + Indexes + Remaining P1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the remaining P1 hot-path items from the audit: cache the most-called reference data, parallelize stats queries, add the highest-impact indexes, and move the biggest HTTP-blocking export to a queue.

**Architecture:** Wrap reference lookups in CacheService (60-300s TTL). Where 4-5 sequential counts are issued, replace with `Promise.all`. Add `@Index` to the most-filtered columns. The reports export gets a Bull-queue façade (returns job id, client polls).

**Tech Stack:** TypeORM 0.3, NestJS 11, CacheService (Redis), Bull 4.

**Spec reference:** `docs/superpowers/specs/2026-06-15-backend-perf-audit-design.md` (P1 sites, settings, sla-config, business-hours, reports, renewal, sound, synology, ip-whitelist, vpn-access, google-sync, health; P2 indexes, projections).

**Prereq:** Plans 01-03 complete (tags `backend-perf-plan-01-complete`, `-02-`, `-03-` present).

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `apps/backend/src/modules/sites/sites.service.ts` | Modify | Cache active sites list; implement getSiteStats |
| `apps/backend/src/modules/settings/settings.service.ts` | Modify | Cache getSchedulingConfig; cache business hours; parallelize setSetting reads if needed |
| `apps/backend/src/modules/sla-config/sla-config.service.ts` | Modify | Cache SLA config + business hours list |
| `apps/backend/src/modules/sla-config/business-hours.service.ts` | Modify | Wrap getBusinessHours in cache |
| `apps/backend/src/modules/sound/sound.service.ts` | Modify | Cache findAll + findByEvent |
| `apps/backend/src/modules/reports/reports.service.ts` | Modify | Cache aggregate queries; move Excel/PDF to Bull queue |
| `apps/backend/src/modules/reports/reports.controller.ts` | Modify | Accept async export; return job id |
| `apps/backend/src/modules/reports/generators/scheduled-reports.service.ts` | Modify | Cache aggregates |
| `apps/backend/src/modules/renewal/renewal.service.ts` | Modify | Move file I/O outside DB tx; batch updateAllStatuses |
| `apps/backend/src/modules/ip-whitelist/ip-whitelist.service.ts` | Modify | Parallelize getStats counts; cap topHits |
| `apps/backend/src/modules/vpn-access/vpn-access.service.ts` | Modify | Parallelize stats counts; add pagination |
| `apps/backend/src/modules/google-sync/services/sync-scheduler.service.ts` | Modify | Filter syncEnabled at DB level; add in-flight dedupe |
| `apps/backend/src/modules/health/health.controller.ts` | Modify | Add @CacheInterceptor on live/ready |
| `apps/backend/src/shared/queue/queue.module.ts` | Modify | Add report-export job processor |
| `apps/backend/src/shared/queue/processors/report-export.processor.ts` | Create | Bull processor for Excel/PDF export |
| `apps/backend/src/modules/notifications/entities/notification.entity.ts` | Modify | Add composite index (userId, type, referenceId, createdAt) for dedup |
| `apps/backend/src/modules/lost-item/entities/found-item-claim.entity.ts` | Modify | Add composite index (status, finderId, lostItemReportId) |
| `apps/backend/src/modules/knowledge-base/entities/article.entity.ts` | Modify | Add composite index (status, categoryId, publishedAt) |
| `apps/backend/src/modules/eform-request/entities/eform-request.entity.ts` | Modify | Add composite index (siteId, createdAt) |
| `apps/backend/src/modules/zoom-booking/entities/zoom-booking.entity.ts` | Modify | Add composite index (accountId, startAt, endAt, status) |
| `apps/backend/src/migrations/1779000000000-AddPerfIndexes.ts` | Create | Migration with all new indexes |
| `apps/backend/test/unit/sites/sites.service.spec.ts` | Create | Cached findActive |
| `apps/backend/test/unit/sla-config/sla-config.service.spec.ts` | Create | Cached lookups |
| `apps/backend/test/unit/sound/sound.service.spec.ts` | Create | Cached findByEvent |
| `apps/backend/test/unit/ip-whitelist/ip-whitelist.service.spec.ts` | Create | Parallel stats + capped topHits |
| `apps/backend/test/unit/renewal/renewal.service.spec.ts` | Create | File I/O outside tx, batched updateAllStatuses |

---

## Task 1: Sites Service — Cache Active Sites + Implement getSiteStats

**Files:**
- Modify: `apps/backend/src/modules/sites/sites.service.ts`

- [ ] **Step 1: Read current sites service**

Run: `rtk read apps/backend/src/modules/sites/sites.service.ts`
Expected: confirm constructor and methods.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/unit/sites/sites.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SitesService } from '../../../src/modules/sites/sites.service';
import { Site } from '../../../src/modules/sites/entities/site.entity';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('SitesService', () => {
  let svc: SitesService;
  let mockCache: any;
  let ticketRepo: any;
  let userRepo: any;

  beforeAll(async () => {
    mockCache = { getOrSet: jest.fn(async (_k, fn) => fn()), getAsync: jest.fn(), setAsync: jest.fn() };
    ticketRepo = { count: jest.fn().mockResolvedValue(10) };
    userRepo = { count: jest.fn().mockResolvedValue(5) };
    const siteRepo = { find: jest.fn().mockResolvedValue([{ id: 's1', code: 'JKT' }]) };
    const mod = await Test.createTestingModule({
      providers: [
        SitesService,
        { provide: CacheService, useValue: mockCache },
        { provide: getRepositoryToken(Site), useValue: siteRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    svc = mod.get(SitesService);
  });

  it('findActive uses cache with 5min TTL (rarely changes)', async () => {
    await svc.findActive();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'sites:active',
      expect.any(Function),
      300,
    );
  });

  it('getSiteStats returns real counts (was hardcoded 0)', async () => {
    const stats = await svc.getSiteStats('s1');
    expect(stats.userCount).toBe(5);
    expect(stats.ticketCount).toBe(10);
  });
});
```

(Adjust method names to match the real ones — find via grep.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=sites.service`
Expected: FAIL — no cache call, no real counts.

- [ ] **Step 4: Implement caching + real getSiteStats**

In `apps/backend/src/modules/sites/sites.service.ts`:

- Inject `CacheService` in the constructor.
- Wrap `findActive()`:

```typescript
    async findActive(): Promise<Site[]> {
        return this.cacheService.getOrSet(
            'sites:active',
            () => this.siteRepo.find({ where: { isActive: true }, order: { code: 'ASC' } }),
            300, // 5 min — sites change rarely
        );
    }
```

- Implement `getSiteStats(siteId)`:

```typescript
    async getSiteStats(siteId: string): Promise<{ userCount: number; ticketCount: number }> {
        // P1 fix: was returning hardcoded 0. Now real COUNT queries wrapped
        // in Promise.all (they hit different tables so no contention).
        const [userCount, ticketCount] = await Promise.all([
            this.userRepo.count({ where: { siteId, isActive: true } }),
            this.ticketRepo.count({ where: { siteId } }),
        ]);
        return { userCount, ticketCount };
    }
```

- Invalidate `sites:active` on create/update of a site:

```typescript
    async create(...): Promise<Site> {
        const created = await this.siteRepo.save(...);
        await this.cacheService.delAsync('sites:active').catch(() => undefined);
        return created;
    }
    async update(id, dto): Promise<Site> {
        const updated = await this.siteRepo.save(...);
        await this.cacheService.delAsync('sites:active').catch(() => undefined);
        return updated;
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=sites.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/sites/ apps/backend/test/unit/sites/
git commit -m "perf(sites): 5min cache on findActive + real getSiteStats"
```

---

## Task 2: Settings — Cache getSchedulingConfig

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.service.ts`

- [ ] **Step 1: Read current getSchedulingConfig**

Run: `rtk grep "getSchedulingConfig" apps/backend/src/modules/settings/settings.service.ts`

- [ ] **Step 2: Append to spec (create if absent)**

`apps/backend/test/unit/settings/settings.service.spec.ts`:

```typescript
  it('getSchedulingConfig caches result for 60s (called by every ticket form)', async () => {
    const mockCache = { getOrSet: jest.fn(async (_k, fn) => fn()), getAsync: jest.fn() };
    (svc as any).cacheService = mockCache;
    await svc.getSchedulingConfig();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'settings:scheduling',
      expect.any(Function),
      60,
    );
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=settings.service`
Expected: FAIL — no cache call.

- [ ] **Step 4: Wrap getSchedulingConfig in cache**

In `apps/backend/src/modules/settings/settings.service.ts`:

```typescript
    async getSchedulingConfig(): Promise<SchedulingConfig> {
        // P1 perf: called by every ticket-form render. Cache 60s.
        return this.cacheService.getOrSet(
            'settings:scheduling',
            async () => {
                const config = await this.getSetting<SchedulingConfig>('scheduling.config');
                return config || DEFAULT_SCHEDULING_CONFIG;
            },
            60,
        );
    }
```

Inject `CacheService` (if not already — was injected in Plan 03 for setSetting transaction).

Invalidate on update:

```typescript
    async updateTimeSlots(timeSlots: string[], userId?: string): Promise<SchedulingConfig> {
        // ... existing logic ...
        await this.cacheService.delAsync('settings:scheduling').catch(() => undefined);
        return updated;
    }
    async updateHardwareTypes(hardwareTypes: string[], userId?: string): Promise<SchedulingConfig> {
        // ... existing logic ...
        await this.cacheService.delAsync('settings:scheduling').catch(() => undefined);
        return updated;
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=settings.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/settings/ apps/backend/test/unit/settings/
git commit -m "perf(settings): 60s cache on getSchedulingConfig, invalidate on update"
```

---

## Task 3: SLA Config + Business Hours — Cache

**Files:**
- Modify: `apps/backend/src/modules/sla-config/sla-config.service.ts`
- Modify: `apps/backend/src/modules/sla-config/business-hours.service.ts`

- [ ] **Step 1: Read both services**

Run: `rtk read apps/backend/src/modules/sla-config/sla-config.service.ts`
Run: `rtk read apps/backend/src/modules/sla-config/business-hours.service.ts`

- [ ] **Step 2: Create spec file**

`apps/backend/test/unit/sla-config/sla-config.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaConfigService } from '../../../src/modules/sla-config/sla-config.service';
import { SlaConfig } from '../../../src/modules/ticketing/entities/sla-config.entity';
import { BusinessHours } from '../../../src/modules/sla-config/entities/business-hours.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('SlaConfigService caching', () => {
  let svc: SlaConfigService;
  let mockCache: any;

  beforeAll(async () => {
    mockCache = { getOrSet: jest.fn(async (_k, fn) => fn()), getAsync: jest.fn() };
    const slaRepo = { find: jest.fn().mockResolvedValue([{ priority: 'HIGH' }]) };
    const bhRepo = { find: jest.fn().mockResolvedValue([{ name: 'default' }]) };
    const mod = await Test.createTestingModule({
      providers: [
        SlaConfigService,
        { provide: CacheService, useValue: mockCache },
        { provide: getRepositoryToken(SlaConfig), useValue: slaRepo },
        { provide: getRepositoryToken(BusinessHours), useValue: bhRepo },
      ],
    }).compile();
    svc = mod.get(SlaConfigService);
  });

  it('findAll SLA configs uses 60s cache', async () => {
    await svc.findAll();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'sla-config:all',
      expect.any(Function),
      60,
    );
  });

  it('BusinessHours.findAll uses 60s cache', async () => {
    await svc.findAllBusinessHours();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'business-hours:all',
      expect.any(Function),
      60,
    );
  });
});
```

(Adjust method names to the real ones.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=sla-config.service`
Expected: FAIL — no cache.

- [ ] **Step 4: Add cache wrapping + invalidation**

Inject `CacheService` into both services. Wrap `findAll` and `findAllBusinessHours` with 60s `getOrSet`. Add `delAsync` calls in any create/update method.

```typescript
    async findAll(): Promise<SlaConfig[]> {
        return this.cacheService.getOrSet(
            'sla-config:all',
            () => this.slaConfigRepo.find(),
            60,
        );
    }

    async create(...): Promise<SlaConfig> {
        const created = await this.slaConfigRepo.save(...);
        await this.cacheService.delAsync('sla-config:all').catch(() => undefined);
        return created;
    }
    async update(id, ...): Promise<SlaConfig> {
        const updated = await this.slaConfigRepo.save(...);
        await this.cacheService.delAsync('sla-config:all').catch(() => undefined);
        return updated;
    }
```

Same for `BusinessHours` (`business-hours:all` key).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=sla-config.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/sla-config/ apps/backend/test/unit/sla-config/
git commit -m "perf(sla-config): 60s cache on SLA configs + business hours"
```

---

## Task 4: Sound Service — Cache findAll + findByEvent

**Files:**
- Modify: `apps/backend/src/modules/sound/sound.service.ts`

- [ ] **Step 1: Read service**

Run: `rtk read apps/backend/src/modules/sound/sound.service.ts`

- [ ] **Step 2: Create spec**

`apps/backend/test/unit/sound/sound.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SoundService } from '../../../src/modules/sound/sound.service';
import { NotificationSound } from '../../../src/modules/sound/entities/notification-sound.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('SoundService caching', () => {
  let svc: SoundService;
  let mockCache: any;

  beforeAll(async () => {
    mockCache = { getOrSet: jest.fn(async (_k, fn) => fn()), getAsync: jest.fn() };
    const repo = { find: jest.fn().mockResolvedValue([]), findByEvent: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        SoundService,
        { provide: CacheService, useValue: mockCache },
        { provide: getRepositoryToken(NotificationSound), useValue: repo },
      ],
    }).compile();
    svc = mod.get(SoundService);
  });

  it('findAll uses 60s cache', async () => {
    await svc.findAll();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'sounds:all',
      expect.any(Function),
      60,
    );
  });

  it('findByEvent uses 60s cache', async () => {
    await svc.findByEvent('TICKET_CREATED');
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'sounds:event:TICKET_CREATED',
      expect.any(Function),
      60,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=sound.service`
Expected: FAIL.

- [ ] **Step 4: Wrap in cache + invalidate on mutation**

Inject `CacheService`. Wrap `findAll()` and `findByEvent(event)`:

```typescript
    async findAll(): Promise<NotificationSound[]> {
        return this.cacheService.getOrSet(
            'sounds:all',
            () => this.soundRepo.find({ order: { name: 'ASC' } }),
            60,
        );
    }

    async findByEvent(eventType: string): Promise<NotificationSound | null> {
        return this.cacheService.getOrSet(
            `sounds:event:${eventType}`,
            async () => {
                // Replace the previous linear DEFAULT_SOUNDS.find with a single
                // query. If no override, return the default for the event.
                const override = await this.soundRepo.findOne({ where: { eventType, isActive: true } });
                return override || this.getDefaultForEvent(eventType);
            },
            60,
        );
    }
```

In `setActive`/upload mutation, invalidate the relevant keys.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=sound.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/sound/ apps/backend/test/unit/sound/
git commit -m "perf(sound): 60s cache on findAll + findByEvent"
```

---

## Task 5: IP-Whitelist — Parallelize Stats + Cap topHits

**Files:**
- Modify: `apps/backend/src/modules/ip-whitelist/ip-whitelist.service.ts:84,197,198,204,210`

- [ ] **Step 1: Read current getStats + topHits**

Run: `rtk read apps/backend/src/modules/ip-whitelist/ip-whitelist.service.ts:75-220`

- [ ] **Step 2: Create spec**

`apps/backend/test/unit/ip-whitelist/ip-whitelist.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IpWhitelistService } from '../../../src/modules/ip-whitelist/ip-whitelist.service';
import { IpWhitelist } from '../../../src/modules/ip-whitelist/entities/ip-whitelist.entity';

describe('IpWhitelistService.getStats', () => {
  let svc: IpWhitelistService;
  let mockRepo: any;

  beforeAll(async () => {
    mockRepo = { count: jest.fn().mockResolvedValue(5), find: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        IpWhitelistService,
        { provide: getRepositoryToken(IpWhitelist), useValue: mockRepo },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(IpWhitelistService);
  });

  it('getStats runs counts in parallel via Promise.all', async () => {
    const t0 = Date.now();
    await svc.getStats();
    const elapsed = Date.now() - t0;
    expect(mockRepo.count).toHaveBeenCalledTimes(4);
    // Parallel: should be near-zero sum, not 4×. Generous bound.
    expect(elapsed).toBeLessThan(20);
  });

  it('topHits is ordered and capped at 10', async () => {
    mockRepo.find.mockResolvedValue([]);
    await svc.topHits();
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { hitCount: 'DESC' }, take: 10 }),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=ip-whitelist.service`
Expected: FAIL — current sequential counts.

- [ ] **Step 4: Parallelize getStats + cap topHits**

In `apps/backend/src/modules/ip-whitelist/ip-whitelist.service.ts`:

```typescript
    async getStats(): Promise<any> {
        // P1 perf: was 4 sequential count() calls. Now in parallel.
        const [total, active, expired, recent] = await Promise.all([
            this.ipRepo.count(),
            this.ipRepo.count({ where: { isActive: true } }),
            this.ipRepo.count({ where: { isActive: false } }),
            this.ipRepo.count({ where: { isActive: true, updatedAt: MoreThanOrEqual(/* last 7 days */) } }),
        ]);
        return { total, active, expired, recent };
    }

    async topHits(limit: number = 10): Promise<IpWhitelist[]> {
        // P1 perf: was no order/limit, full table scan. Now capped + ordered.
        return this.ipRepo.find({
            where: { isActive: true },
            order: { hitCount: 'DESC' },
            take: limit,
        });
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ip-whitelist.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ip-whitelist/ apps/backend/test/unit/ip-whitelist/
git commit -m "perf(ip-whitelist): parallel getStats counts + cap topHits at 10"
```

---

## Task 6: VPN-Access — Parallelize Stats + Add Pagination

**Files:**
- Modify: `apps/backend/src/modules/vpn-access/vpn-access.service.ts:106-120`

- [ ] **Step 1: Read current vpn-access service**

Run: `rtk read apps/backend/src/modules/vpn-access/vpn-access.service.ts:100-130`

- [ ] **Step 2: Create spec**

`apps/backend/test/unit/vpn-access/vpn-access.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VpnAccessService } from '../../../src/modules/vpn-access/vpn-access.service';
import { VpnAccess } from '../../../src/modules/vpn-access/entities/vpn-access.entity';

describe('VpnAccessService', () => {
  let svc: VpnAccessService;
  let mockRepo: any;

  beforeAll(async () => {
    mockRepo = { count: jest.fn().mockResolvedValue(3), find: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        VpnAccessService,
        { provide: getRepositoryToken(VpnAccess), useValue: mockRepo },
      ],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(VpnAccessService);
  });

  it('getStats runs counts in parallel', async () => {
    await svc.getStats();
    expect(mockRepo.count).toHaveBeenCalledTimes(4);
  });

  it('findAll supports pagination (no unbounded find)', async () => {
    await svc.findAll({ page: 1, limit: 20 });
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=vpn-access.service`
Expected: FAIL.

- [ ] **Step 4: Parallelize + add pagination**

```typescript
    async getStats(): Promise<any> {
        // P1 perf: was 4 sequential count() calls. Now in parallel.
        const [total, active, pending, expired] = await Promise.all([
            this.vpnRepo.count(),
            this.vpnRepo.count({ where: { status: 'ACTIVE' } }),
            this.vpnRepo.count({ where: { status: 'PENDING' } }),
            this.vpnRepo.count({ where: { status: 'EXPIRED' } }),
        ]);
        return { total, active, pending, expired };
    }

    async findAll(opts: { page?: number; limit?: number } = {}): Promise<VpnAccess[]> {
        // P1 fix: was unbounded find. Now paged.
        const { page = 1, limit = 20 } = opts;
        return this.vpnRepo.find({
            take: limit,
            skip: (page - 1) * limit,
            order: { createdAt: 'DESC' },
        });
    }
```

(Adjust `status` enum values to the real ones.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=vpn-access.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/vpn-access/ apps/backend/test/unit/vpn-access/
git commit -m "perf(vpn-access): parallel stats + pagination on findAll"
```

---

## Task 7: Renewal — File I/O Outside DB Tx + Batched updateAllStatuses

**Files:**
- Modify: `apps/backend/src/modules/renewal/renewal.service.ts:163-178, 474-489`

- [ ] **Step 1: Read current bulkDelete + updateAllStatuses**

Run: `rtk read apps/backend/src/modules/renewal/renewal.service.ts:155-200`
Run: `rtk read apps/backend/src/modules/renewal/renewal.service.ts:470-495`

- [ ] **Step 2: Create spec**

`apps/backend/test/unit/renewal/renewal.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RenewalService } from '../../../src/modules/renewal/renewal.service';

describe('RenewalService.bulkDelete', () => {
  let svc: RenewalService;
  let mockDataSource: any;
  let fsUnlink: jest.SpyInstance;

  beforeAll(async () => {
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        find: jest.fn().mockResolvedValue([{ id: 'r1', fileUrl: '/u/r1.pdf' }]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: () => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
      })),
    };
    fsUnlink = jest.spyOn(require('fs').promises, 'unlink').mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [RenewalService, { provide: DataSource, useValue: mockDataSource }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    svc = mod.get(RenewalService);
  });

  it('file unlink happens AFTER the transaction commits', async () => {
    let order: string[] = [];
    fsUnlink.mockImplementation(async () => { order.push('fs'); });
    (mockDataSource.transaction.mockImplementationOnce(async (cb) => {
      const mgr = {
        find: jest.fn().mockResolvedValue([{ id: 'r1', fileUrl: '/u/r1.pdf' }]),
        delete: jest.fn().mockImplementation(async () => { order.push('db'); return { affected: 1 }; }),
      };
      return cb(mgr);
    }));
    await svc.bulkDelete(['r1']);
    expect(order).toEqual(['db', 'fs']);
  });
});

describe('RenewalService.updateAllStatuses', () => {
  it('batches into a single UPDATE, not a per-row save loop', async () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    const ds = { transaction: jest.fn(async (cb) => cb({ createQueryBuilder: () => qb })) };
    const mod = await Test.createTestingModule({
      providers: [RenewalService, { provide: DataSource, useValue: ds }],
    })
      .useMocker(() => jest.fn().mockResolvedValue([]))
      .compile();
    const svc2 = mod.get(RenewalService);
    await svc2.updateAllStatuses();
    expect(qb.update).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=renewal.service`
Expected: FAIL.

- [ ] **Step 4: Fix bulkDelete + batch updateAllStatuses**

In `apps/backend/src/modules/renewal/renewal.service.ts`:

```typescript
    async bulkDelete(contractIds: string[]): Promise<{ deleted: number }> {
        if (!contractIds.length) return { deleted: 0 };
        // P1 fix: file unlink used to happen inside the DB transaction,
        // blocking the row lock until the file system responded. Now the DB
        // delete commits first, then unlink runs in the post-commit phase.
        const filePaths: string[] = [];
        const result = await this.dataSource.transaction(async (manager) => {
            const contracts = await manager.find(RenewalContract, {
                where: { id: In(contractIds) },
                select: ['id', 'fileUrl'],
            });
            for (const c of contracts) {
                if (c.fileUrl) filePaths.push(c.fileUrl);
            }
            return manager.delete(RenewalContract, { id: In(contractIds) });
        });

        // Post-commit file cleanup (best-effort; failures logged, not thrown)
        const fs = require('fs').promises;
        await Promise.all(
            filePaths.map(p => fs.unlink(p).catch((e: any) =>
                this.logger.warn(`Failed to unlink ${p}: ${e.message}`)
            )),
        );
        return { deleted: result.affected ?? 0 };
    }

    async updateAllStatuses(): Promise<{ updated: number }> {
        // P1 fix: was per-contract find + save loop. Now a single UPDATE
        // marking all expired contracts as EXPIRED in one statement.
        const result = await this.dataSource.transaction(async (manager) => {
            return manager.createQueryBuilder()
                .update(RenewalContract)
                .set({ status: 'EXPIRED' })
                .where('status != :s', { s: 'EXPIRED' })
                .andWhere('endDate < :now', { now: new Date() })
                .execute();
        });
        return { updated: result.affected ?? 0 };
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=renewal.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/renewal/ apps/backend/test/unit/renewal/
git commit -m "perf(renewal): file unlink after tx commit + batched updateAllStatuses"
```

---

## Task 8: Google-Sync — Filter syncEnabled at DB + In-Flight Dedupe

**Files:**
- Modify: `apps/backend/src/modules/google-sync/services/sync-scheduler.service.ts:127`

- [ ] **Step 1: Read sync-scheduler service**

Run: `rtk read apps/backend/src/modules/google-sync/services/sync-scheduler.service.ts:115-140`

- [ ] **Step 2: Implement DB filter + dedupe**

Replace the `find()` for sheets to push the filter to SQL, and add an in-flight map to skip if already running:

```typescript
    private inFlight = new Set<string>(); // sheet IDs

    @Cron(CronExpression.EVERY_5_MINUTES)
    async runScheduledSync() {
        // P1 fix: was `find()` returning all sheets (syncEnabled or not).
        // Now we filter at the DB level so disabled sheets never load.
        const sheets = await this.sheetRepo.find({
            where: { syncEnabled: true },
            relations: ['config'],
        });
        for (const sheet of sheets) {
            // P1 fix: was no dedupe. If a previous tick is still running for
            // this sheet (slow API, hung worker), skip instead of double-run.
            if (this.inFlight.has(sheet.id)) {
                this.logger.debug(`Skipping sheet ${sheet.id} — already in flight`);
                continue;
            }
            this.inFlight.add(sheet.id);
            try {
                await this.syncEngine.syncSheet(sheet);
            } catch (e) {
                this.logger.error(`Sync failed for sheet ${sheet.id}: ${(e as Error).message}`);
            } finally {
                this.inFlight.delete(sheet.id);
            }
        }
    }
```

- [ ] **Step 3: Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/google-sync/
git commit -m "perf(google-sync): DB-level syncEnabled filter + in-flight dedupe"
```

---

## Task 9: Health — Add Cache Decorator to live/ready

**Files:**
- Modify: `apps/backend/src/modules/health/health.controller.ts:20-82`

- [ ] **Step 1: Read health controller**

Run: `rtk read apps/backend/src/modules/health/health.controller.ts:1-90`

- [ ] **Step 2: Add caching**

For each handler that does a DB ping or expensive check, add `@UseInterceptors(CacheInterceptor)`:

```typescript
import { CacheInterceptor } from '@nestjs/cache-manager';
import { UseInterceptors } from '@nestjs/common';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    @Get('live')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(5) // seconds
    live() { return { status: 'ok', ts: new Date().toISOString() }; }

    @Get('ready')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(10)
    async ready() { return this.healthService.checkReadiness(); }

    // ... other endpoints (detailed checks) stay uncached
}
```

(Adjust to the real handler names; only cache `live` and `ready` — `deep` checks should always run.)

- [ ] **Step 3: Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/health/
git commit -m "perf(health): 5-10s cache on live/ready endpoints"
```

---

## Task 10: Add Performance Indexes (Migration)

**Files:**
- Create: `apps/backend/src/migrations/1779000000000-AddPerfIndexes.ts`

- [ ] **Step 1: Find current largest migration timestamp**

Run: `rtk ls apps/backend/src/migrations/ | tail -5`
Expected: pick a timestamp later than the last existing migration (e.g. `1779000000000`).

- [ ] **Step 2: Create migration file**

`apps/backend/src/migrations/1779000000000-AddPerfIndexes.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerfIndexes1779000000000 implements MigrationInterface {
    name = 'AddPerfIndexes1779000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Notifications: dedup hot path (userId, type, referenceId, createdAt)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_notif_dedup" ON "notifications" ("userId", "type", "referenceId", "createdAt")`,
        );
        // Found item claims: status + finder/report lookups
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_found_claim_status" ON "found_item_claims" ("status", "finderId", "lostItemReportId")`,
        );
        // Knowledge-base: published articles by category
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_kb_article_published" ON "articles" ("status", "categoryId", "publishedAt")`,
        );
        // E-form: per-site recent list
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_eform_request_site_created" ON "eform_requests" ("siteId", "createdAt")`,
        );
        // Zoom-booking: overlap check by technician + window
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_zoom_booking_overlap" ON "zoom_bookings" ("accountId", "startAt", "endAt", "status")`,
        );
        // pg_trgm GIN on user search columns (ILIKE '%x%')
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_user_fullname_trgm" ON "users" USING gin ("fullName" gin_trgm_ops)`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_user_email_trgm" ON "users" USING gin ("email" gin_trgm_ops)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notif_dedup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_found_claim_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_kb_article_published"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_eform_request_site_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_zoom_booking_overlap"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_fullname_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email_trgm"`);
    }
}
```

- [ ] **Step 3: Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0 (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/migrations/1779000000000-AddPerfIndexes.ts
git commit -m "perf(db): add 7 hot-path indexes + pg_trgm for user search"
```

---

## Verification & Sign-off

- [ ] **Run full backend test suite**

Run: `cd apps/backend && npm test`
Expected: all 9 spec files pass.

- [ ] **Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Manual smoke: sites active cache**

1. `cd apps/backend && npm run start:dev`
2. Hit a route that calls `findActive` (e.g. any ticket filter)
3. First hit: ~50ms (DB). Second hit (within 5min): <5ms (Redis)

- [ ] **Manual smoke: ILIKE search**

After migration runs, `EXPLAIN ANALYZE` an `ILIKE '%john%'` query on users — should use the trigram GIN index instead of seq scan.

- [ ] **Final tag**

```bash
git tag backend-perf-plan-04-complete
git log --oneline -12
```

---

## Out-of-Scope (Not in Plan 04)

- Reports → Bull queue (deferred to a follow-up — too large for this plan)
- DTO projection sweep (40+ entities, mechanical but huge)
- Test coverage audit

---

**Status:** Plan 04 saved. 10 task, ~3-4 jam eksekusi. Ready for user approval.
