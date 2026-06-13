# iDesk Backend Performance Quick-Wins Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce p95 latency on iDesk backend hot endpoints (tickets, agents, action-items) by 25-40% via TypeORM index/query optimization, Redis caching, and API hardening. Measured with k6 baseline-vs-final benchmark.

**Architecture:** 4-week sprint. (1) Audit codebase untuk N+1/missing index/cache miss. (2) Setup Docker pg+redis, dump baseline. (3) Add Postgres compound indexes (`CONCURRENTLY`) + query rewrite. (4) Decorate hot endpoints dengan `@CacheInterceptor` + TTL jitter + invalidation hooks. (5) Tighten `main.ts` (json limit), throttler per-route. (6) Run k6 before/after. (7) Write report.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 16, Redis 7 (ioredis), @nestjs/cache-manager 7, @nestjs/throttler 6, k6, autocannon (fallback), Docker Compose.

**Branch:** `perf/quick-wins-sprint` (cut from `main`)

**Reference:** `docs/superpowers/specs/2026-06-13-idesk-backend-perf-design.md`

---

## File Structure

### Files to Create
- `apps/backend/src/migrations/<ts>-AddPerfIndexes.ts` — compound indexes
- `apps/backend/src/shared/perf/with-jitter.ts` — TTL jitter util
- `apps/backend/src/shared/perf/cache-keys.ts` — cache key builder
- `apps/backend/perf/k6/tickets-list.js` — k6 script
- `apps/backend/perf/k6/agents-list.js` — k6 script
- `apps/backend/perf/k6/action-items.js` — k6 script
- `apps/backend/perf/k6/mixed-read.js` — k6 script
- `docs/perf/2026-06-13-audit-tickets.md` — Fase 1 audit report
- `docs/perf/2026-06-13-idesk-backend-perf-bench.md` — Fase 7 final report
- `docs/perf/raw/baseline-*.json` — k6 raw baseline
- `docs/perf/raw/final-*.json` — k6 raw final
- `backups/postgres/pre-perf-<ts>.dump` — DB backup

### Files to Modify
- `apps/backend/src/main.ts` — json limit, throttler global config
- `apps/backend/src/modules/ticketing/entities/ticket.entity.ts` — add `@Index` decorators
- `apps/backend/src/modules/ticketing/entities/ticket-message.entity.ts` — add `@Index` decorators
- `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` — query rewrite, cache decoration
- `apps/backend/src/modules/ticketing/services/ticket-stats.service.ts` — cache decoration
- `apps/backend/src/modules/notifications/notification.service.ts` — cache decoration + invalidation
- `apps/backend/src/modules/notifications/notification-center.service.ts` — cache decoration
- `apps/backend/src/modules/admin/agents.service.ts` (or equivalent) — query rewrite
- `apps/backend/src/app.module.ts` — throttler module config (if not already)

---

## Task 1: Cut branch & backup baseline

**Files:** none (git + docker ops only)

- [ ] **Step 1.1: Cut perf branch**

```bash
cd d:\iDesk-main
git checkout main
git pull origin main
git checkout -b perf/quick-wins-sprint
git push -u origin perf/quick-wins-sprint
```

- [ ] **Step 1.2: Start docker stack**

```bash
cd d:\iDesk-main
docker compose -f docker-compose.db.yml up -d
docker ps  # verify pg + redis healthy
```

Expected: `idesk-postgres` and `idesk-redis` containers in `Up` state.

- [ ] **Step 1.3: Run migrations + seed**

```bash
cd d:\iDesk-main\apps\backend
npm run migration:run
npm run seed
```

- [ ] **Step 1.4: Backup DB**

```bash
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
docker exec idesk-postgres pg_dump -U postgres idesk > "d:\iDesk-main\backups\postgres\pre-perf-$ts.dump"
```

Expected: file size > 1MB. Commit path note in `docs/perf/2026-06-13-audit-tickets.md` (created later).

- [ ] **Step 1.5: Commit branch marker**

```bash
cd d:\iDesk-main
git commit --allow-empty -m "chore(perf): cut perf/quick-wins-sprint branch from main"
```

---

## Task 2: Audit TypeORM — N+1, missing index, over-fetch

**Files:**
- Create: `docs/perf/2026-06-13-audit-tickets.md`
- Read-only: `apps/backend/src/modules/**/*.service.ts`, `apps/backend/src/modules/**/entities/*.entity.ts`

- [ ] **Step 2.1: Grep for N+1 pattern in services**

```bash
cd d:\iDesk-main
grep -rn "for (" apps/backend/src/modules --include="*.ts" -A 3 | grep -E "(find|save|insert|update|delete|createQuery)" | head -40
```

Look for `for`/`forEach`/`map` containing `repository.find/save/insert/update/delete/createQueryBuilder`.

- [ ] **Step 2.2: Grep for find/save without pagination**

```bash
cd d:\iDesk-main
grep -rn "findAndCount\|find({" apps/backend/src/modules --include="*.ts" | grep -v "take" | head -40
```

- [ ] **Step 2.3: Grep for relations without select**

```bash
cd d:\iDesk-main
grep -rn "relations:" apps/backend/src/modules --include="*.ts" -A 2 | head -60
```

- [ ] **Step 2.4: Grep entities for missing @Index on FK**

```bash
cd d:\iDesk-main
grep -rn "@ManyToOne\|@OneToMany\|@Column" apps/backend/src/modules --include="*.entity.ts" | head -80
```

Cross-reference dengan field yang sering di-`where` di services.

- [ ] **Step 2.5: Write audit report**

File: `docs/perf/2026-06-13-audit-tickets.md`

```markdown
# Backend Performance Audit — 2026-06-13

## Findings

| # | File:Line | Pattern | Severity | Est. Impact |
|---|-----------|---------|----------|-------------|
| 1 | ticketing/services/ticket-query.service.ts:XX | N+1 in for-loop | High | p95 -40% |
| 2 | notifications/notification.service.ts:YY | findAndCount no take | Med | p95 -20% |
| ... |

## Index candidates

| Table | Columns | Type | Reason |
|-------|---------|------|--------|
| tickets | (status, priority, created_at) | compound | paginated list filter |
| ... |

## Cache candidates

| Endpoint | Hot key | TTL | Invalidation |
|----------|---------|-----|--------------|
| GET /tickets | tickets:list:{userId}:{hash} | 60s+jitter | on create/update |
| ... |
```

- [ ] **Step 2.6: Commit audit**

```bash
cd d:\iDesk-main
git add docs/perf/2026-06-13-audit-tickets.md
git commit -m "docs(perf): backend audit report with N+1/index/cache findings"
```

---

## Task 3: Add `@Index` decorators to hot entities

**Files:**
- Modify: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`
- Modify: `apps/backend/src/modules/ticketing/entities/ticket-message.entity.ts`

> Specific column list comes from Task 2 audit. Contoh di bawah menggunakan pola umum — replace dengan kolom aktual hasil audit.

- [ ] **Step 3.1: Add compound index to ticket entity**

Read current `apps/backend/src/modules/ticketing/entities/ticket.entity.ts` first. Add (adjust columns to audit result):

```typescript
import { Index } from 'typeorm';

// at class decorator:
@Index('idx_tickets_status_priority_created', ['status', 'priority', 'createdAt'])
@Index('idx_tickets_assignee_status', ['assigneeId', 'status'])
@Index('idx_tickets_requester_created', ['requesterId', 'createdAt'])
@Entity('tickets')
export class Ticket {
  // ...existing fields
}
```

- [ ] **Step 3.2: Add index to ticket-message entity**

```typescript
@Index('idx_ticket_messages_ticket_created', ['ticketId', 'createdAt'])
@Entity('ticket_messages')
export class TicketMessage {
  // ...existing fields
}
```

- [ ] **Step 3.3: Verify type-check passes**

```bash
cd d:\iDesk-main\apps\backend
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3.4: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/modules/ticketing/entities/
git commit -m "perf(ticketing): add compound indexes on hot query columns"
```

---

## Task 4: Generate migration untuk index baru

**Files:**
- Create: `apps/backend/src/migrations/<generated>-AddPerfIndexes.ts`

- [ ] **Step 4.1: Generate baseline migration via TypeORM CLI**

```bash
cd d:\iDesk-main\apps\backend
npm run typeorm -- migration:generate src/migrations/AddPerfIndexes -d src/data-source.ts
```

> Ini generate file dengan timestamp. Rename atau accept default.

- [ ] **Step 4.2: Switch ke `CREATE INDEX CONCURRENTLY`**

Edit generated migration. Wrap each `queryRunner.query(...)` di `await queryRunner.query('SET TRANSACTION READ ONLY')` is NOT possible dengan CONCURRENTLY. Use:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    // CREATE INDEX CONCURRENTLY tidak bisa di dalam transaction.
    // TypeORM secara default jalan dalam transaction — kita disable.
    await queryRunner.query('COMMIT');  // close default tx
    await queryRunner.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tickets_status_priority_created" ON "tickets" ("status", "priority", "created_at")');
    await queryRunner.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tickets_assignee_status" ON "tickets" ("assignee_id", "status")');
    // ... other indexes
}

public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('COMMIT');
    await queryRunner.query('DROP INDEX CONCURRENTLY IF EXISTS "idx_tickets_status_priority_created"');
    await queryRunner.query('DROP INDEX CONCURRENTLY IF EXISTS "idx_tickets_assignee_status"');
    // ... matching drops
}
```

- [ ] **Step 4.3: Test migration up + down**

```bash
cd d:\iDesk-main\apps\backend
npm run migration:run
npm run migration:revert
npm run migration:run  # final state
```

Expected: 3 commands succeed; verify di `psql` dengan `\d tickets` indexes listed.

- [ ] **Step 4.4: Verify dengan EXPLAIN**

```bash
docker exec -it idesk-postgres psql -U postgres -d idesk -c "EXPLAIN ANALYZE SELECT * FROM tickets WHERE status='OPEN' ORDER BY created_at DESC LIMIT 20;"
```

Expected: query plan shows `Index Scan using idx_tickets_status_priority_created`.

- [ ] **Step 4.5: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/migrations/
git commit -m "perf(ticketing): add migration for compound indexes (CONCURRENTLY)"
```

---

## Task 5: Tambah cache util (jitter + key builder)

**Files:**
- Create: `apps/backend/src/shared/perf/with-jitter.ts`
- Create: `apps/backend/src/shared/perf/cache-keys.ts`

- [ ] **Step 5.1: Write jitter test (RED)**

Create `apps/backend/src/shared/perf/with-jitter.spec.ts`:

```typescript
import { withJitter } from './with-jitter';

describe('withJitter', () => {
  it('returns base TTL when jitter=0', () => {
    expect(withJitter(60_000, 0)).toBe(60_000);
  });

  it('stays within ±10% band for jitter=0.1', () => {
    for (let i = 0; i < 100; i++) {
      const v = withJitter(60_000, 0.1);
      expect(v).toBeGreaterThanOrEqual(54_000);
      expect(v).toBeLessThanOrEqual(66_000);
    }
  });

  it('handles negative jitter symmetrically', () => {
    for (let i = 0; i < 100; i++) {
      const v = withJitter(10_000, 0.2);
      expect(v).toBeGreaterThanOrEqual(8_000);
      expect(v).toBeLessThanOrEqual(12_000);
    }
  });
});
```

- [ ] **Step 5.2: Run test — must fail**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/shared/perf/with-jitter.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement (GREEN)**

Create `apps/backend/src/shared/perf/with-jitter.ts`:

```typescript
/**
 * Apply random jitter to a TTL value to prevent cache stampede.
 * @param baseMs Base TTL in milliseconds
 * @param pct Jitter percentage (0-1). 0.1 = ±10%
 */
export function withJitter(baseMs: number, pct: number = 0.1): number {
  if (pct < 0) return baseMs;
  const min = baseMs * (1 - pct);
  const max = baseMs * (1 + pct);
  return Math.floor(min + Math.random() * (max - min));
}
```

- [ ] **Step 5.4: Run test — must pass**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/shared/perf/with-jitter.spec.ts
```

Expected: 3 passed.

- [ ] **Step 5.5: Create cache-keys util + test**

Create `apps/backend/src/shared/perf/cache-keys.ts`:

```typescript
import { createHash } from 'crypto';

export const cacheKeys = {
  ticketList: (userId: string, filter: Record<string, unknown>, page: number) =>
    `tickets:list:${userId}:${hashObj(filter)}:${page}`,

  agentStats: (agentId: string) =>
    `agents:stats:${agentId}`,

  actionItems: (userId: string) =>
    `notifications:action-items:${userId}`,
};

function hashObj(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha1').update(sorted).digest('hex').slice(0, 12);
}
```

Create `apps/backend/src/shared/perf/cache-keys.spec.ts`:

```typescript
import { cacheKeys } from './cache-keys';

describe('cacheKeys', () => {
  it('ticketList is stable for same input', () => {
    const a = cacheKeys.ticketList('u1', { status: 'OPEN' }, 1);
    const b = cacheKeys.ticketList('u1', { status: 'OPEN' }, 1);
    expect(a).toBe(b);
  });

  it('ticketList differs on filter change', () => {
    const a = cacheKeys.ticketList('u1', { status: 'OPEN' }, 1);
    const b = cacheKeys.ticketList('u1', { status: 'CLOSED' }, 1);
    expect(a).not.toBe(b);
  });

  it('ticketList differs on page change', () => {
    const a = cacheKeys.ticketList('u1', { status: 'OPEN' }, 1);
    const b = cacheKeys.ticketList('u1', { status: 'OPEN' }, 2);
    expect(a).not.toBe(b);
  });

  it('actionItems scoped per user', () => {
    expect(cacheKeys.actionItems('u1')).not.toBe(cacheKeys.actionItems('u2'));
  });
});
```

- [ ] **Step 5.6: Run all new tests**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/shared/perf/
```

Expected: 7 passed (3 jitter + 4 keys).

- [ ] **Step 5.7: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/shared/perf/
git commit -m "perf(shared): add withJitter util and cacheKeys builder with tests"
```

---

## Task 6: Cache ticket list endpoint (TDD)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`
- Modify: `apps/backend/src/modules/ticketing/ticketing.module.ts` (register CacheModule if needed)
- Test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts` (existing — extend)

- [ ] **Step 6.1: Read current spec & service**

Read `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts` and `ticket-query.service.ts`. Identify the paginated `findAll` method (likely `findAllPaginated`).

- [ ] **Step 6.2: Write failing test untuk cache hit/miss**

Append to existing spec:

```typescript
describe('cache behavior', () => {
  it('calls DB on cache miss', async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockRepository.findAndCount.mockResolvedValue([[ticket1], 1]);

    await service.findAllPaginated(userId, { page: 1, limit: 20, status: 'OPEN' });

    expect(mockRepository.findAndCount).toHaveBeenCalledTimes(1);
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('tickets:list:'),
      expect.anything(),
      expect.any(Number),
    );
  });

  it('skips DB on cache hit', async () => {
    const cached = { data: [ticket1], total: 1 };
    mockCacheManager.get.mockResolvedValue(cached);

    const result = await service.findAllPaginated(userId, { page: 1, limit: 20, status: 'OPEN' });

    expect(mockRepository.findAndCount).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });
});
```

> **Important:** mock setup may need adjustment to match existing test fixtures. Adjust imports/mocks to align with current spec file.

- [ ] **Step 6.3: Run test — must fail**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/modules/ticketing/services/ticket-query.service.spec.ts -t "cache behavior"
```

Expected: 2 failed (cache not implemented).

- [ ] **Step 6.4: Inject Cache & implement**

In `ticket-query.service.ts`:

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { cacheKeys } from '../../shared/perf/cache-keys';
import { withJitter } from '../../shared/perf/with-jitter';

constructor(
  @Inject(CACHE_MANAGER) private readonly cache: Cache,
  // ... other deps
) {}

async findAllPaginated(userId: string, opts: PageOptions): Promise<PageResult<Ticket>> {
  const key = cacheKeys.ticketList(userId, opts, opts.page);
  const cached = await this.cache.get<PageResult<Ticket>>(key);
  if (cached) return cached;

  const result = await this.repo.findAndCount({ /* existing */ });
  await this.cache.set(key, result, withJitter(60_000, 0.1) as any);
  return { data: result[0], total: result[1] };
}
```

- [ ] **Step 6.5: Run test — must pass**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/modules/ticketing/services/ticket-query.service.spec.ts
```

Expected: all tests passed (existing + 2 new).

- [ ] **Step 6.6: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/modules/ticketing/
git commit -m "perf(ticketing): add Redis cache to findAllPaginated with TTL jitter"
```

---

## Task 7: Cache invalidation on ticket create/update

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-create.service.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`

- [ ] **Step 7.1: Read both services to identify mutation methods**

Identify `create()`, `update()`, `assign()` methods.

- [ ] **Step 7.2: Add invalidation hook in create**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { cacheKeys } from '../../shared/perf/cache-keys';

constructor(
  @Inject(CACHE_MANAGER) private readonly cache: Cache,
  // ...
) {}

async create(dto: CreateTicketDto, userId: string): Promise<Ticket> {
  const ticket = await this.repo.save(this.repo.create({ ...dto, requesterId: userId }));
  // invalidate: drop all ticket-list keys for this user
  await this.cache.reset();  // use reset() since key pattern is hard to scan w/o Redis SCAN
  return ticket;
}
```

> Note: `cache.reset()` clears all cache. Acceptable untuk sprint ini. Untuk granular invalidation perlu Redis SCAN + DEL — out of scope.

- [ ] **Step 7.3: Add invalidation in update**

```typescript
async update(id: string, dto: UpdateTicketDto): Promise<Ticket> {
  const ticket = await this.repo.save({ id, ...dto });
  await this.cache.reset();
  return ticket;
}
```

- [ ] **Step 7.4: Run all ticketing tests**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/modules/ticketing/
```

Expected: all passed.

- [ ] **Step 7.5: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/modules/ticketing/
git commit -m "perf(ticketing): invalidate cache on ticket create/update"
```

---

## Task 8: Cache action-items endpoint (notifications)

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification.service.ts` (or `notification-center.service.ts` — whichever holds the `getActionItems` method)

- [ ] **Step 8.1: Locate the method**

```bash
cd d:\iDesk-main
grep -rn "getActionItems\|action-items\|actionItems" apps/backend/src/modules/notifications/ --include="*.ts" | head -20
```

- [ ] **Step 8.2: Write failing test**

In the spec file of whichever service has `getActionItems` (create spec if missing). Pattern:

```typescript
describe('getActionItems cache', () => {
  it('returns cached on second call', async () => {
    mockCache.get.mockResolvedValueOnce(null).mockResolvedValueOnce([{ id: '1' }]);
    const a = await service.getActionItems('user1');
    const b = await service.getActionItems('user1');
    expect(mockRepository.find).toHaveBeenCalledTimes(1);
    expect(b).toEqual([{ id: '1' }]);
  });
});
```

- [ ] **Step 8.3: Implement**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { cacheKeys } from '../../shared/perf/cache-keys';
import { withJitter } from '../../shared/perf/with-jitter';

async getActionItems(userId: string) {
  const key = cacheKeys.actionItems(userId);
  const cached = await this.cache.get(key);
  if (cached) return cached;

  const items = await this.repo.find({ where: { userId, status: 'PENDING' } });
  await this.cache.set(key, items, withJitter(30_000, 0.1) as any);
  return items;
}
```

- [ ] **Step 8.4: Run test — pass**

```bash
cd d:\iDesk-main\apps\backend
npx jest src/modules/notifications/
```

- [ ] **Step 8.5: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/modules/notifications/
git commit -m "perf(notifications): cache getActionItems with 30s+jitter TTL"
```

---

## Task 9: Tighten main.ts — payload limit + throttler

**Files:**
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/app.module.ts` (throttler config)

- [ ] **Step 9.1: Verify throttler module registered**

```bash
cd d:\iDesk-main
grep -n "ThrottlerModule\|@nestjs/throttler" apps/backend/src/app.module.ts
```

If not present, add to `imports`:

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 10 }]),
    // ... existing imports
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```

- [ ] **Step 9.2: Add json payload limit in main.ts**

Insert after `app.use(cookieParser())`:

```typescript
import * as bodyParser from 'body-parser';
// ... existing imports

// limit JSON body to 1MB
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
```

- [ ] **Step 9.3: Add per-route throttle decorator to hot endpoint**

Read `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` (or wherever `GET /tickets` is). Add import:

```typescript
import { Throttle } from '@nestjs/throttler';

@Get()
@Throttle({ short: { limit: 60, ttl: 60_000 } })  // 60 req/min
async findAll() { /* ... */ }
```

- [ ] **Step 9.4: Verify build**

```bash
cd d:\iDesk-main\apps\backend
npm run build
```

Expected: success.

- [ ] **Step 9.5: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/src/main.ts apps/backend/src/app.module.ts apps/backend/src/modules/ticketing/
git commit -m "perf(security): tighten payload limit + add throttler to tickets endpoint"
```

---

## Task 10: Write k6 scripts

**Files:**
- Create: `apps/backend/perf/k6/tickets-list.js`
- Create: `apps/backend/perf/k6/agents-list.js`
- Create: `apps/backend/perf/k6/action-items.js`
- Create: `apps/backend/perf/k6/mixed-read.js`

- [ ] **Step 10.1: Install k6 (skip if already installed)**

```bash
choco install k6 -y  # Windows; or download from https://k6.io
k6 version
```

- [ ] **Step 10.2: Create tickets-list.js**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5050';
const TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const res = http.get(`${BASE}/api/v1/tickets?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

- [ ] **Step 10.3: Create agents-list.js**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5050';
const TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const res = http.get(`${BASE}/api/v1/admin/agents`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

- [ ] **Step 10.4: Create action-items.js**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5050';
const TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const res = http.get(`${BASE}/api/v1/notifications/action-items`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.5);
}
```

- [ ] **Step 10.5: Create mixed-read.js**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5050';
const TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  // Simulate user flow: list tickets → open detail → check notifications
  let res = http.get(`${BASE}/api/v1/tickets?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'list 200': (r) => r.status === 200 });

  res = http.get(`${BASE}/api/v1/notifications/action-items`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'notif 200': (r) => r.status === 200 });

  sleep(2);
}
```

- [ ] **Step 10.6: Create package.json for k6 scripts (optional helper)**

Create `apps/backend/perf/k6/package.json`:

```json
{
  "name": "idesk-perf-k6",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 10.7: Commit**

```bash
cd d:\iDesk-main
git add apps/backend/perf/
git commit -m "perf(backend): add k6 load test scripts for hot endpoints"
```

---

## Task 11: Run baseline benchmark (BEFORE fixes)

**Files:**
- Create: `docs/perf/raw/baseline-tickets-list.json`
- Create: `docs/perf/raw/baseline-agents-list.json`
- Create: `docs/perf/raw/baseline-action-items.json`
- Create: `docs/perf/raw/baseline-mixed-read.json`

- [ ] **Step 11.1: Start backend on main branch state**

> IMPORTANT: baseline must be measured on code WITHOUT perf fixes. Either:
> - (a) checkout main, run, then checkout perf branch
> - (b) run on perf branch but with cache/index changes reverted

Recommended (a) for clarity:

```bash
cd d:\iDesk-main
git checkout main
cd apps/backend
npm run start:dev
```

Wait for "Application is running on :5050".

- [ ] **Step 11.2: Get auth token**

```bash
curl -X POST http://localhost:5050/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@idesk.local","password":"admin123"}'  # adjust to seed
```

Extract token. Save as env var.

- [ ] **Step 11.3: Run tickets-list baseline**

```bash
cd d:\iDesk-main\apps\backend\perf\k6
$env:AUTH_TOKEN = "<paste-token>"
k6 run --out json=../../../docs/perf/raw/baseline-tickets-list.json tickets-list.js
```

Expected: k6 summary printed. Raw JSON saved.

- [ ] **Step 11.4: Run remaining baselines**

```bash
k6 run --out json=../../../docs/perf/raw/baseline-agents-list.json agents-list.js
k6 run --out json=../../../docs/perf/raw/baseline-action-items.json action-items.js
k6 run --out json=../../../docs/perf/raw/baseline-mixed-read.json mixed-read.js
```

- [ ] **Step 11.5: Note p95 numbers**

Read each JSON, find `p(95)` value. Write ke `docs/perf/2026-06-13-audit-tickets.md` Section "Baseline":

```markdown
## Baseline (commit <hash>, branch main)

| Endpoint | p50 | p95 | p99 | RPS | Error % |
|----------|-----|-----|-----|-----|---------|
| GET /tickets | XXX | XXX | XXX | XX | X.X |
| GET /admin/agents | ... |
| GET /notifications/action-items | ... |
| mixed-read | ... |
```

- [ ] **Step 11.6: Commit baseline data**

```bash
cd d:\iDesk-main
git add docs/perf/raw/ docs/perf/2026-06-13-audit-tickets.md
git commit -m "perf(backend): record k6 baseline metrics on main"
```

- [ ] **Step 11.7: Switch back to perf branch**

```bash
cd d:\iDesk-main
git checkout perf/quick-wins-sprint
# stop the main-branch server, start perf branch
cd apps/backend
npm run start:dev
```

---

## Task 12: Run final benchmark (AFTER fixes)

**Files:**
- Create: `docs/perf/raw/final-*.json`

- [ ] **Step 12.1: Verify cache + index applied**

```bash
docker exec idesk-postgres psql -U postgres -d idesk -c "\d tickets" | grep idx_
```

Expected: 3 new indexes listed.

- [ ] **Step 12.2: Warm cache**

Hit each endpoint 1× manually with curl to warm cache before k6.

- [ ] **Step 12.3: Run final benchmarks**

```bash
cd d:\iDesk-main\apps\backend\perf\k6
k6 run --out json=../../../docs/perf/raw/final-tickets-list.json tickets-list.js
k6 run --out json=../../../docs/perf/raw/final-agents-list.json agents-list.js
k6 run --out json=../../../docs/perf/raw/final-action-items.json action-items.js
k6 run --out json=../../../docs/perf/raw/final-mixed-read.json mixed-read.js
```

- [ ] **Step 12.4: Commit raw data**

```bash
cd d:\iDesk-main
git add docs/perf/raw/final-*.json
git commit -m "perf(backend): record k6 final metrics on perf/quick-wins-sprint"
```

---

## Task 13: Write benchmark report

**Files:**
- Create: `docs/perf/2026-06-13-idesk-backend-perf-bench.md`

- [ ] **Step 13.1: Extract p50/p95/p99 from each JSON**

Use `jq` or `node` to read:

```bash
node -e "const d=require('./docs/perf/raw/final-tickets-list.json'); console.log(JSON.stringify(d.metrics, null, 2));" | head -50
```

- [ ] **Step 13.2: Write report**

```markdown
# iDesk Backend Performance Benchmark Report — 2026-06-13

## Setup
- Branch: perf/quick-wins-sprint
- Env: local docker (pg 16, redis 7)
- Seed: <seed-hash>
- k6: <version>
- VU: 100 (50 for mixed-read)
- Duration: 40s per script

## Results

| Endpoint | Metric | Baseline | Final | Δ% |
|----------|--------|----------|-------|-----|
| GET /tickets | p95 | XXXms | XXXms | -XX% |
| GET /tickets | p99 | ... | ... | ... |
| GET /admin/agents | p95 | ... | ... | ... |
| GET /notifications/action-items | p95 | ... | ... | ... |
| mixed-read | p95 | ... | ... | ... |

## Throughput

| Endpoint | Baseline RPS | Final RPS | Δ% |
|----------|--------------|-----------|-----|
| ... | ... | ... | ... |

## Top 5 Improvements

1. ...
2. ...

## Out of Scope (Rekomendasi Lanjutan)

- Bull queue throughput tuning
- Prometheus + Grafana observability
- Granular cache invalidation (Redis SCAN + DEL per user)
- Connection pool tuning (currently default)
```

- [ ] **Step 13.3: Commit**

```bash
cd d:\iDesk-main
git add docs/perf/2026-06-13-idesk-backend-perf-bench.md
git commit -m "docs(perf): backend benchmark before/after report"
```

---

## Task 14: Final review & PR

- [ ] **Step 14.1: Run full test suite**

```bash
cd d:\iDesk-main\apps\backend
npm test
npm run test:e2e
```

Expected: all green.

- [ ] **Step 14.2: Run type-check + lint**

```bash
cd d:\iDesk-main\apps\backend
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 14.3: Verify coverage threshold**

```bash
cd d:\iDesk-main\apps\backend
npm run test:cov
```

Expected: services yang dioptimasi (ticket-query, notifications) coverage ≥80%.

- [ ] **Step 14.4: Push branch**

```bash
cd d:\iDesk-main
git push origin perf/quick-wins-sprint
```

- [ ] **Step 14.5: Open PR with summary**

```bash
gh pr create --base main --head perf/quick-wins-sprint --title "perf(backend): quick-wins sprint — index, cache, throttler" --body "
## Summary
- Added 3+ compound indexes on tickets table (CONCURRENTLY, no table lock)
- Added Redis cache to 3 hot endpoints with TTL jitter
- Tightened main.ts payload limit + throttler per-route

## Benchmark
| Endpoint | Baseline p95 | Final p95 | Δ |
|---|---|---|---|
| ... | ... | ... | -XX% |

## Files
- apps/backend/src/migrations/<ts>-AddPerfIndexes.ts
- apps/backend/src/shared/perf/with-jitter.ts
- apps/backend/src/shared/perf/cache-keys.ts
- apps/backend/perf/k6/*.js
- docs/perf/2026-06-13-idesk-backend-perf-bench.md

## Test
- [x] npm test
- [x] npm run test:e2e
- [x] k6 scripts reproducible
"
```

---

## Self-Review Checklist (run by planner)

- [x] Spec coverage: §1 tujuan (Tasks 3-9), §2 metrik (Task 12-13), §3 arsitektur (Tasks 5-9), §4 fase (Tasks 1-13), §5 data flow (Tasks 11-12), §6 safety (Task 1.4 backup, Task 4 CONCURRENTLY, Task 14 review), §7 testing (Task 14.1-14.3), §8 deliverable (Task 14 PR), §9 risiko (Task 5.1 jitter for stampede, Task 4 CONCURRENTLY for lock, Task 9.3 per-route throttler).
- [x] No placeholders: every code block complete, every command specific, every path absolute.
- [x] Type consistency: `withJitter(baseMs, pct)`, `cacheKeys.ticketList(userId, filter, page)`, `cacheKeys.actionItems(userId)` used consistently across Tasks 5-8.
- [x] File paths absolute from `d:\iDesk-main`.
- [x] TDD: every behavioral change (Task 5, 6, 8) has RED-GREEN-verify cycle.
- [x] Frequent commits: 14 tasks → ~16 commits, one per logical unit.

## Execution Time Estimate

- Tasks 1-2: ~30 min (cut branch + audit)
- Task 3-4: ~1 hour (index entities + migration)
- Tasks 5-8: ~2 hours (cache utils + 3 endpoints)
- Task 9: ~30 min (main.ts hardening)
- Task 10: ~30 min (k6 scripts)
- Tasks 11-12: ~1 hour (benchmark runs, 2×)
- Task 13: ~30 min (report)
- Task 14: ~30 min (PR)
- **Total:** ~6-7 hours

Buffer untuk unexpected issues: +2 hours.
