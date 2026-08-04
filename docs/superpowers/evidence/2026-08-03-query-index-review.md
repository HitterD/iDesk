# iDesk Query, Index, and N+1 Review — Task 2.4

**Date:** 2026-08-04
**Scope:** Evidence for Phase 2.4 (cache, index, N+1 fixes) per
`docs/superpowers/plans/2026-08-03-idesk-audit-hardening.md:492-528`.

## Evidence-quality caveat

The dev database (`idesk_db` in the `idesk-postgres` container) holds single-digit to
low-double-digit row counts on every relevant table (`tickets`=9, `users`=5,
`agent_daily_workload`=16, `audit_logs`=6 at time of writing). `EXPLAIN (ANALYZE, BUFFERS)`
against this data cannot produce realistic cost/row estimates or support before/after
performance percentage claims. Per the plan's Global Constraint ("no performance percentage
claims without baseline measurement") and CLAUDE.md §6/§9, this review reports **query-plan
structure and index usage only** — which access path the planner chooses and whether it is an
index scan or sequential scan — not timing or throughput numbers.

## Step 1 — Index duplication check

Compared every index candidate considered below against the three existing index migrations
(`1733500000000-AddMissingIndexes.ts`, `1734768000000-AddMissingIndexes.ts`,
`1779000000000-AddPerfIndexes.ts`) and the live `pg_indexes` catalog. `tickets` already carries
single-column indexes on `assignedToId`, `siteId`, `createdAt`, `category`, `priority`, plus
composites on `(status, priority)` and `(status, slaTarget)`:

```
IDX_143c60f935aa86982b2074fadd  tickets(category)
IDX_1af00915273d692d395dc0fffb  tickets(status, "slaTarget")
IDX_1cfb61a749963bfba02395e118  tickets(priority)
IDX_4bb45e096f521845765f657f5c  tickets("userId")
IDX_7712f291901ceeb504b329df62  tickets("assignedToId")
IDX_8e9b89b151c4e9c7919b93ee4f  tickets(status, priority)
IDX_e0b40b37db23653c23ec376cfe  tickets("siteId")
IDX_e5a32949aaaa731c7ec0dc89e9  tickets("createdAt")
```

## Step 2 — N+1 fixes

Three genuine N+1 loops found (repeated per-agent DB round trips), all fixed by batching into
one query per report/lookup instead of one per agent. No authorization filter, pagination, or
response shape changed — only the query strategy.

### 2a. `ManagerReportsService.getAgentPerformance` (`apps/backend/src/modules/manager/manager-reports.service.ts:175`)

Before: for each agent, 3 sequential queries (`count` assigned, `count` resolved, `find`
resolved tickets) — 3N queries for N agents.

After: one grouped `COUNT(*) ... GROUP BY assignedToId` query builder call for "assigned in
period", one `find` with `assignedToId IN (...agentIds)` for resolved tickets, then in-memory
grouping per agent — 2 queries total regardless of agent count. Short-circuits to 0 queries when
there are no agents.

`EXPLAIN (ANALYZE, BUFFERS)` on the grouped count query (dev DB, 9 ticket rows):

```
GroupAggregate  (cost=0.14..8.18 rows=1 width=24) (actual time=0.076..0.077 rows=0 loops=1)
  Group Key: "assignedToId"
  ->  Index Scan using "IDX_e5a32949aaaa731c7ec0dc89e9" on tickets t
        Index Cond: ("createdAt" BETWEEN ...)
        Filter: ("assignedToId" = ...)
```

Planner uses the existing `createdAt` index (index scan, not seq scan). No new index needed —
existing single-column index already gives an index-scan access path.

Regression test: `apps/backend/src/modules/manager/manager-reports.service.spec.ts` asserts
`ticketRepo.createQueryBuilder` and `ticketRepo.find` are each called exactly once regardless of
agent count (3 agents in the test), and that `ticketRepo.count` is never called (the old
per-agent count path). A second test asserts zero ticket queries when there are no agents.

### 2b. `WorkloadService.getAllAgentWorkloads` (`apps/backend/src/modules/workload/workload.service.ts:94`)

Before: for each agent, `getAgentWorkload` (`findOne` + conditional `save`) then a `find` for
active tickets — 2+ queries per agent.

After: one `find` for existing workload rows across all agents, one `save` for only the missing
rows (skipped entirely if none missing), one `find` for active tickets across all agents with
in-memory grouping — 3 queries total (2 when no workload rows are missing), regardless of agent
count.

`EXPLAIN (ANALYZE, BUFFERS)` on the active-tickets batch query:

```
Index Scan using "IDX_7712f291901ceeb504b329df62" on tickets
  Index Cond: ("assignedToId" = ...)
  Filter: (("siteId" = ...) AND (status = ANY (...)))
```

Uses the existing `assignedToId` index. No new index justified.

Regression test: `apps/backend/src/modules/workload/workload.service.spec.ts` asserts
`workloadRepo.find`, `workloadRepo.save`, and `ticketRepo.find` are each called exactly once for
3 agents, and that no queries run when there are no agents.

### 2c. `WorkloadService.findBestAgentForAssignment` (`apps/backend/src/modules/workload/workload.service.ts:216`)

Before: for each available agent, `getAgentWorkload` (`findOne` + conditional `save`) — 1+ query
per agent, on the ticket-auto-assignment hot path.

After: same batch-fetch + batch-create-missing pattern as 2b — 1-2 queries total regardless of
agent count.

Regression test: same spec file, asserts `workloadRepo.find`/`save` called once for 3 agents.

### 2d. `WorkloadService.recalculateAgentWorkload` (`apps/backend/src/modules/workload/workload.service.ts:140`, minor)

Before: for each open ticket on the agent, `getPriorityWeight` — one `findOne` against the
5-row `priority_weights` table per ticket.

After: `priorityWeightRepo.find()` once before the loop, weights held in a `Map` and looked up
in memory per ticket. `priority_weights` is small and rarely written, so this is a straight win
with no staleness risk within the request.

Regression test: same spec file, asserts `priorityWeightRepo.find` called exactly once for 3
open tickets.

## Step 3 — New indexes

No new index migration was created. Every batched query from Step 2 already resolves to an
index scan (not a sequential scan) using one of the eight existing `tickets` indexes listed in
Step 1. Given the near-empty dev DB, there is no query-plan evidence that a new composite index
would change the access path, and adding one without that evidence would violate the plan's
"no new index without query evidence" constraint. Per YAGNI, `1785000002000-*` was not created.

## Step 4 — Cache policy for repeated reads

Reviewed for gaps against the plan's target paths (roles/permissions, site/department,
configuration):

- `PermissionsService.hasPermissionCached` — already cache-aside, 60s TTL, invalidated via
  `invalidatePermissionCache` (`permissions.service.ts:861-887`).
- `PageAccessGuard` — already cache-aside via `cacheService.getOrSet` (`pageAccess:{userId}`,
  configurable TTL, default 300s) (`page-access.guard.ts`).
- `SitesService.findActive` — already cached (`sites:active`, 300s TTL)
  (`sites.service.ts:1-70`).
- `manager-reports.service.ts` / `workload.service.ts` — request-scoped aggregate reads (agent
  performance, workload snapshot), not cached; each call reflects the current ticket state,
  which manager dashboards and auto-assignment both require to be fresh. Caching these would
  either need a very short TTL (marginal benefit given the fix already dropped query count to
  O(1) per report) or risk serving stale workload data to the auto-assignment algorithm. No gap
  found — left uncached deliberately.

No new cache namespace, TTL, or invalidation hook was added: the existing cache layer already
covers every repeated-read path in scope, and the N+1 fixes addressed the only uncached
hot-path queries found.

## Step 5 — Tests

Targeted:
```
npx jest --runInBand src/modules/workload/workload.service.spec.ts src/modules/manager/manager-reports.service.spec.ts
```
Result: 2 suites passed, 6 tests passed.

Adjacent (ticketing module, since `TicketUpdateService` calls
`WorkloadService.recalculateAgentWorkload`):
```
npx jest --runInBand src/modules/ticketing
```
Result: 12 suites passed, 44 tests passed.

Full suite:
```
npx jest --runInBand
```
Result: 73 of 76 suites passed (3 pre-existing skips), 432 of 439 tests passed (7 pre-existing
skips), 0 failures.

Type check: `npx tsc --noEmit` — exit 0.
