# iDesk Performance Baseline

**Date:** 2026-08-03
**Scope:** Phase 0 baseline before hardening.

## Automated contract probes

- Missing email user currently returns before `bcrypt.compare`; regression probe in `apps/backend/src/modules/auth/application/auth.service.spec.ts` records `bcrypt.compare` call count as `0`.
- Existing email user executes one `bcrypt.compare`; same spec records call count as `1`.
- These probes document the timing behavior before Phase 1. Phase 1 must change the first assertion to require one dummy-hash comparison.
- Health detailed snapshot returns sampler data without probing DB again; `apps/backend/src/modules/health/health.service.spec.ts` asserts `dataSource.query` is not called.

## Test baseline

Command:

```bash
npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/auth.service.spec.ts src/modules/health/health.service.spec.ts
```

Observed 2026-08-03:

- Test suites: 2 passed.
- Tests: 28 passed.
- Snapshots: 0.
- Runtime: 14.679 seconds.
- Node emitted existing `DEP0169` warning for `url.parse()`; no test failure.

Command:

```bash
npm run build --prefix apps/backend
```

Observed 2026-08-03: pass with no compiler output.

## Measurement protocol for runtime baseline

Run in a disposable development environment with test accounts and redacted identifiers. Do not place credentials, JWTs, cookies, or raw NIK values in logs or evidence.

1. Run 30 email-login attempts for existing user with valid password, existing user with invalid password, and missing user.
2. Run 30 NIK/HRIS login attempts for valid, invalid, ineligible, and simulated transport failure.
3. Run 30 refresh, logout, and password-change requests.
4. Record p50/p95 wall-clock latency, HTTP outcome, bcrypt call duration, and failed-login count.
5. Compare database query count per flow using development PostgreSQL statement logging or repository spies.
6. Record Redis enabled/disabled state, ping latency, connection errors, and restart behavior.
7. Run frontend dashboard, ticket list, ticket detail, and login navigation traces with React Profiler; record commit duration and rerender count separately from network latency.

No latency or percentage claim is made until these samples are collected.

## Query/index evidence protocol

Before adding an index:

```sql
SELECT schemaname, indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

For each candidate query, capture:

```sql
EXPLAIN (ANALYZE, BUFFERS) <candidate-query>;
```

Compare candidates against existing migrations:

- `apps/backend/src/migrations/1733500000000-AddMissingIndexes.ts`
- `apps/backend/src/migrations/1734768000000-AddMissingIndexes.ts`
- `apps/backend/src/migrations/1779000000000-AddPerfIndexes.ts`

Skip duplicate or overlapping indexes. Record query text, plan, row estimate, buffers, execution time, and authorization/pagination constraints in `2026-08-03-query-index-review.md` when Phase 2 begins.
