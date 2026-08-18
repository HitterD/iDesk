# iDesk Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup seluruh rekomendasi audit terverifikasi pada `docs/docs_Improvement_V7_diff.md` secara bertahap, dimulai dari keamanan autentikasi, lalu Redis/performa, arsitektur, kualitas, observability, MFA, API platform, dokumentasi, dan deployment.

**Architecture:** Pertahankan business behavior dan error contract yang ada. Jadikan Redis source of truth untuk refresh session setelah cutover, users persistence entity sebagai canonical model, dan pecah `AuthService` hanya pada batas yang memiliki consumer nyata. Docker Compose di Linux menjadi target utama; Kubernetes Kustomize menjadi opsi setelah kontrak image, port, health, migration, dan secret stabil.

**Tech Stack:** NestJS 11, TypeScript 5.9, TypeORM 0.3, PostgreSQL, Redis 7, `ioredis`, `@nestjs/cache-manager`, `@nestjs/throttler`, `@nestjs/event-emitter`, Passport, JWT, bcrypt, React 19, Vite, Jest, Supertest, Vitest, Docker Compose, Kubernetes, Kustomize.

## Global Constraints

- Selesaikan security fix sebelum refactor luas.
- Docker Compose pada Linux tetap deployment utama; Kubernetes hanya follow-up opsional.
- Gunakan dependency yang sudah terpasang sebelum menambah dependency.
- Jangan menyimpan password, JWT, refresh token, MFA secret, atau secret deployment di source, database plaintext, atau log.
- Validasi seluruh input eksternal; jangan trim atau normalize password secara diam-diam.
- Gunakan `apps/backend/src/modules/users/entities/user.entity.ts` sebagai canonical persistence model.
- Redis wajib untuk refresh-session setelah cutover; Redis security state tidak boleh fallback ke in-memory cache.
- Default HRIS outage: fail closed.
- Pertahankan public error contract kecuali perubahan sudah diberi versioning dan compatibility test.
- Operasi keamanan yang mengubah state harus synchronous; side effect audit/notifikasi boleh event-driven dengan error logging dan metric.
- Setiap migration harus idempotent atau memiliki guard, reversible dalam rollback window, dan tidak dijalankan otomatis dari application startup.
- Tidak ada index baru tanpa query evidence, `EXPLAIN`, dan pemeriksaan duplicate/overlapping index.
- Setiap file yang diubah harus dibaca ulang; setiap task harus lulus targeted test sebelum commit.
- Tidak ada claim performance percentage tanpa baseline dan measurement.

---

## Master Execution Plan

Urutan dependency wajib:

1. **Phase 0:** baseline, flow inventory, query/index evidence, compatibility/threat/rollback matrices.
2. **Phase 1:** timing-safe login, refresh rotation/replay, rate limiting, password policy, cookies, HRIS resilience.
3. **Phase 2:** Redis Compose hardening, Redis adapter, refresh migration/cutover, cache policy, evidence-based indexes/N+1, frontend profiling.
4. **Phase 3:** canonical User boundary, typed auth contracts, service extraction, domain events.
5. **Phase 4:** configuration, type cleanup, normalization, structured logging, shared utility only when justified, edge-case tests.
6. **Phase 5:** privacy-safe activity monitoring, metrics, OpenTelemetry.
7. **Phase 6:** TOTP MFA with recovery and session policy.
8. **Phase 7:** API route inventory, `/v1` compatibility layer, bounded read-only GraphQL evaluation/implementation only with approved use case.
9. **Phase 8A:** Compose Linux operations and documentation.
10. **Phase 8B:** optional Kubernetes manifests and staging rollout.
11. Final cross-phase verification and release gate.

### Checkpoint and rollback policy

- Commit each task separately using the commit message specified in its task.
- Tag each phase only after its exit criteria pass.
- Before Phase 1, capture a database backup and export current configuration contract.
- Before refresh cutover, capture Redis/session migration counts and retain legacy column for rollback window.
- Before schema changes, run `npm run migration:show --prefix apps/backend` and backup PostgreSQL.
- Application rollback is allowed only while schema remains backward compatible.
- Refresh claim/storage incompatibility requires invalidating active refresh sessions, not silently accepting old state.
- Never revert an irreversible migration without tested database restore.

### Final verification commands

```bash
git diff --check
npm run test --prefix apps/backend -- --runInBand
npm run build --prefix apps/backend
npm run test:e2e --prefix apps/backend -- --runInBand
npm run test --prefix apps/frontend -- --runInBand
npm run build --prefix apps/frontend
```

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose restart backend redis
docker compose down
```

Record exact failures. Do not mark phase complete while tests fail or known security/data-loss issue remains unresolved.

---

## Phase 0 — Baseline and Verification

### Task 0.1: Inventory authentication flows and contracts

**Files:**
- Read: `docs/docs_Improvement_V7_diff.md`
- Read: `apps/backend/src/modules/auth/application/auth.service.ts`
- Read: `apps/backend/src/modules/auth/presentation/auth.controller.ts`
- Read: `apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts`
- Read: `apps/backend/src/modules/users/user-password.service.ts`
- Read: `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts`
- Read: `apps/backend/src/modules/hris-gateway/hris-sync.service.ts`
- Create: `docs/superpowers/evidence/2026-08-03-auth-baseline.md`

**Interfaces:**
- Consumes: Current email, NIK/HRIS, disabled-account, refresh, logout, reset, and change-password code paths.
- Produces: Flow matrix with current input, lookup, bcrypt/HRIS behavior, state mutation, cookie behavior, error code, audit side effect, and rollback observation.

- [ ] **Step 1: Trace each flow and record exact symbols/line ranges**

  Record both success and failure paths. Mark each audit claim `confirmed`, `not reproduced`, or `needs evidence`; do not infer behavior from the audit text alone.

- [ ] **Step 2: Record compatibility contract**

  Capture current route paths, DTO field names, error codes, JWT claims, cookie names/options, expiry values, and response fields. Include a rule that password and refresh state never appear in response DTOs.

- [ ] **Step 3: Add reproducible smoke commands**

  Document commands for backend unit tests, backend build, frontend tests/build, and Compose health checks. Use redacted fixtures and environment variables for credentials.

- [ ] **Step 4: Verify evidence document**

  Run:

  ```bash
  git diff --check -- docs/superpowers/evidence/2026-08-03-auth-baseline.md
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/evidence/2026-08-03-auth-baseline.md
  git commit -m "docs(audit): record authentication baseline"
  ```

### Task 0.2: Measure baseline latency, queries, and coverage

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.spec.ts`
- Modify: `apps/backend/src/modules/health/health.service.spec.ts`
- Create: `docs/superpowers/evidence/2026-08-03-performance-baseline.md`
- Create: `docs/superpowers/evidence/2026-08-03-threat-model.md`
- Create: `docs/superpowers/evidence/2026-08-03-migration-rollback-matrix.md`

**Interfaces:**
- Consumes: Existing Jest setup, auth service mocks, health service checks, Compose services, and PostgreSQL query logs.
- Produces: Repeatable baseline for auth p50/p95, bcrypt duration, query count, Redis availability, failed-login rate, and current relevant coverage.

- [ ] **Step 1: Add timing and contract probes**

  Add tests that measure with `performance.now()` only for local comparison, assert missing-user and existing-user login both execute the password verifier, and record query count through mocked repository calls rather than adding production instrumentation.

- [ ] **Step 2: Capture integration measurements**

  Run the same email login, NIK/HRIS login, refresh, logout, and password-change scenario at least 30 times in a controlled development environment. Record p50/p95 and sample size; redact identifiers.

- [ ] **Step 3: Capture query/index evidence**

  Enable PostgreSQL statement logging only in the measurement environment, identify repeated/N+1 query patterns, run `EXPLAIN (ANALYZE, BUFFERS)` for candidate queries, and record existing index names before proposing migrations.

- [ ] **Step 4: Write threat and rollback matrices**

  Include attacker goal, asset, entry point, control, detection, owner, and residual risk for timing attacks, refresh replay, brute force, proxy spoofing, cookie theft, HRIS outage, Redis outage, MFA recovery, and secret leakage. Map every planned migration to backup, compatibility window, rollback command, and session invalidation rule.

- [ ] **Step 5: Run baseline tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/auth.service.spec.ts src/modules/health/health.service.spec.ts
  npm run build --prefix apps/backend
  git add apps/backend/src/modules/auth/application/auth.service.spec.ts apps/backend/src/modules/health/health.service.spec.ts docs/superpowers/evidence
  git commit -m "test(audit): establish hardening baseline"
  ```

**Phase 0 exit:** every audit item is classified; baseline and threat model exist; critical flow contract tests pass; no estimated impact is presented without measurement.

---

## Phase 1 — Critical Security

### Task 1.1: Make email login timing-safe and typed

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.spec.ts`
- Create: `apps/backend/src/modules/auth/application/auth.types.ts`
- Create: `apps/backend/src/modules/auth/application/password-verifier.ts`
- Test: `apps/backend/src/modules/auth/application/password-verifier.spec.ts`

**Interfaces:**
- Consumes: `UsersService.findByEmail`, `bcrypt.compare`, existing `LoginValidationResult` behavior.
- Produces: `ValidatedUser`, `LoginValidationResult`, and `verifyPassword(pass: string, hash: string): Promise<boolean>` without `any`.

- [ ] **Step 1: Define safe auth boundary types**

  Define `ValidatedUser` with only fields needed by auth response/token generation: `id`, `email`, `fullName`, `role`, `isActive`, `mustChangePassword`, and optional `employeeId`, `departmentId`, `siteId`. Define failure codes as a string union matching current public codes.

- [ ] **Step 2: Add dummy-hash verifier**

  Store one precomputed bcrypt dummy hash as a non-secret constant. `verifyPassword` must call `bcrypt.compare` for both real and dummy hashes; never generate a hash on a request path.

- [ ] **Step 3: Normalize identifier and defer existence decision**

  Normalize email/NIK identifier only. Fetch user, select real hash or dummy hash, perform one comparison, then evaluate missing/inactive/wrong-password in current compatibility order. Mask email/NIK in audit descriptions.

- [ ] **Step 4: Update local strategy and tests**

  Return `ValidatedUser` from `LocalStrategy.validate`. Add tests asserting missing user invokes bcrypt comparison, inactive user does not bypass comparison, invalid password returns existing error code, successful result strips password, and no full identifier is sent to audit.

- [ ] **Step 5: Run targeted test and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/password-verifier.spec.ts src/modules/auth/application/auth.service.spec.ts
  git add apps/backend/src/modules/auth/application apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts
  git commit -m "fix(auth): make email login timing safe"
  ```

### Task 1.2: Add Redis-backed refresh session model and atomic rotation

**Files:**
- Create: `apps/backend/src/modules/auth/application/refresh-session.types.ts`
- Create: `apps/backend/src/modules/auth/infrastructure/refresh-session.store.ts`
- Create: `apps/backend/src/modules/auth/infrastructure/refresh-session.store.spec.ts`
- Modify: `apps/backend/src/shared/core/cache/cache.service.ts`
- Modify: `apps/backend/src/shared/core/cache/cache.module.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/users/user-password.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.spec.ts`

**Interfaces:**
- Consumes: Existing `CacheService`, `ioredis` client, `JwtService`, current login/refresh/logout calls.
- Produces: `RefreshSessionStore.create`, `consume`, `invalidateFamily`, and `invalidateUserSessions` with typed results; namespaced Redis keys `auth:refresh:{familyId}:{tokenId}`.

- [ ] **Step 1: Define claims and state**

  Define JWT refresh claims `{ sub: string; tokenId: string; familyId: string; parentId?: string; type: 'refresh'; rememberMe: boolean; iat: number; exp: number }`. Define stored state with token digest, user ID, family ID, parent ID, consumed flag/time, and expiry. Never store raw token.

- [ ] **Step 2: Implement atomic consume**

  Use a Redis Lua script or a single supported atomic Redis transaction to check state, reject consumed/missing/expired tokens, mark current token consumed, and return the family/user metadata. The operation must distinguish `valid`, `reused`, and `missing` without exposing that distinction to the HTTP caller.

- [ ] **Step 3: Rotate and issue child session**

  Generate `tokenId` and `familyId` with existing `uuid`; create child with `parentId` equal to consumed token ID; preserve `rememberMe`; set TTL from refresh expiry. On `reused`, invalidate the entire family and emit a security-event hook.

- [ ] **Step 4: Integrate login, refresh, logout, and invalidation**

  Replace per-request bcrypt comparison with store consume after migration flag is enabled. Logout invalidates the user/family state. Password change/reset and account disable call `invalidateUserSessions`. Return one generic unauthorized response for all invalid refresh states.

- [ ] **Step 5: Add concurrency/replay tests**

  Test one token consumed concurrently twice, replay after rotation, family invalidation, expiry TTL, remember-me expiry, logout, password-change invalidation, and Redis error propagation. Assert no raw token enters Redis mock calls or logs.

- [ ] **Step 6: Run targeted tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/infrastructure/refresh-session.store.spec.ts src/modules/auth/application/auth.service.spec.ts
  git add apps/backend/src/modules/auth apps/backend/src/modules/users/user-password.service.ts apps/backend/src/shared/core/cache
  git commit -m "fix(auth): rotate refresh sessions with replay detection"
  ```

### Task 1.3: Add IP-aware throttling and trusted proxy policy

**Files:**
- Modify: `apps/backend/src/modules/auth/presentation/auth.controller.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/app.module.ts` or current throttler module registration file
- Create: `apps/backend/src/shared/security/client-ip.ts`
- Create: `apps/backend/src/shared/security/client-ip.spec.ts`
- Modify: auth controller tests or create `apps/backend/src/modules/auth/presentation/auth.controller.spec.ts`

**Interfaces:**
- Consumes: Nest throttler, Express request, explicit `TRUSTED_PROXY` configuration.
- Produces: `getTrustedClientIp(request): string` and separate login/refresh/register/reset IP limits while preserving account-level limits.

- [ ] **Step 1: Define trusted proxy configuration**

  Parse a configured proxy count or trusted CIDR list at startup. Use `request.ip` when no trusted proxy is configured; accept forwarded headers only when the immediate proxy is trusted. Reject malformed values by using the direct socket/request address.

- [ ] **Step 2: Add endpoint-specific IP keys/limits**

  Apply limits to login, refresh, register, and reset. Keep current endpoint limits unless baseline evidence justifies a changed value. Do not use raw arbitrary `X-Forwarded-For` as limiter key.

- [ ] **Step 3: Test proxy and throttling behavior**

  Test direct client, trusted single proxy, untrusted forwarded header, malformed header, IPv4/IPv6 normalization, and independent login/refresh buckets. Verify rejected requests return existing throttler error contract.

- [ ] **Step 4: Run tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/shared/security/client-ip.spec.ts src/modules/auth/presentation/auth.controller.spec.ts
  git add apps/backend/src/main.ts apps/backend/src/modules/auth apps/backend/src/shared/security apps/backend/src/app.module.ts
  git commit -m "fix(auth): enforce trusted client IP limits"
  ```

### Task 1.4: Centralize password policy and cookie/session hardening

**Files:**
- Create: `apps/backend/src/modules/auth/application/password-policy.ts`
- Create: `apps/backend/src/modules/auth/application/password-policy.spec.ts`
- Modify: `apps/backend/src/modules/auth/presentation/dto/register.dto.ts`
- Modify: `apps/backend/src/modules/auth/presentation/dto/change-password.dto.ts`
- Modify: `apps/backend/src/modules/users/dto/reset-password.dto.ts`
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Modify: `apps/backend/src/modules/users/users.controller.ts`
- Modify: `apps/backend/src/modules/users/user-password.service.ts`
- Create: `apps/backend/src/modules/auth/presentation/cookie-options.ts`
- Modify: `apps/backend/src/modules/auth/presentation/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/presentation/auth.controller.spec.ts`

**Interfaces:**
- Consumes: class-validator DTOs, current route prefix, current access/refresh cookie names.
- Produces: `validatePasswordPolicy(password, context): PasswordPolicyResult` and one source for set/clear cookie options.

- [ ] **Step 1: Implement policy without silent password normalization**

  Enforce minimum 12 and a documented maximum, complexity, common-password rejection, and rejection of email/NIK/full-name fragments. Preserve existing stored passwords; apply policy only on create/change/reset. Reject overlong input before bcrypt.

- [ ] **Step 2: Apply policy consistently**

  Register, change-password, and reset-password must call the same validator and map failures to stable validation errors. Add DTO tests for boundary lengths, repeated characters, user information, Unicode handling, and valid passphrases.

- [ ] **Step 3: Centralize cookie options**

  Define typed access/refresh cookie options with HttpOnly, production Secure, SameSite strict, explicit domain configuration, and route path based on verified API prefix. Use identical options for `res.cookie` and `res.clearCookie`; do not narrow path until route-prefix integration test proves it.

- [ ] **Step 4: Test cookie parity and session invalidation**

  Assert set/clear option parity, no refresh token in JSON response, logout clears both cookies, password change invalidates refresh sessions, and current public response fields remain stable.

- [ ] **Step 5: Run tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/password-policy.spec.ts src/modules/auth/presentation/auth.controller.spec.ts
  git add apps/backend/src/modules/auth apps/backend/src/modules/users
  git commit -m "fix(auth): enforce password and cookie policy"
  ```

### Task 1.5: Harden HRIS timeout, outage classification, and logging

**Files:**
- Modify: `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts`
- Modify: `apps/backend/src/modules/hris-gateway/hris-sync.service.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.spec.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.hris.spec.ts`
- Create: `apps/backend/src/shared/security/sensitive-data.ts`

**Interfaces:**
- Consumes: Existing HRIS adapter/sync contracts and auth error mapping.
- Produces: bounded timeout, explicit `INVALID_CREDENTIALS`, `INELIGIBLE_EMPLOYEE`, and `HRIS_UNAVAILABLE` internal outcomes; fail-closed default.

- [ ] **Step 1: Add bounded timeout using existing HTTP/client capability**

  Configure timeout from validated environment, ensure timeout rejects, and ensure no retry can extend login beyond the configured bound. Do not log password or full NIK.

- [ ] **Step 2: Map outage and eligibility separately**

  Keep invalid credentials distinct from HRIS transport failure internally, but return the approved generic public auth error where compatibility requires it. Never provision a user during a failed/unknown HRIS verification.

- [ ] **Step 3: Add redaction helper**

  Mask identifiers to a short prefix/suffix and redact fields named password, token, cookie, secret, authorization, and NIK before audit/structured logging.

- [ ] **Step 4: Test outage behavior**

  Test timeout, connection failure, malformed HRIS response, invalid credential, inactive employee, successful provisioning, and local fallback only when explicitly approved by configuration. Default configuration must fail closed.

- [ ] **Step 5: Run tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/hris-gateway/hris-gateway.adapter.spec.ts src/modules/auth/application/auth.service.hris.spec.ts
  git add apps/backend/src/modules/hris-gateway apps/backend/src/modules/auth/application/auth.service.ts apps/backend/src/shared/security
  git commit -m "fix(auth): fail closed on HRIS outage"
  ```

**Phase 1 exit:** timing-safe login, atomic refresh rotation/replay invalidation, trusted IP throttling, unified password policy, cookie parity, and fail-closed HRIS tests pass.

---

## Phase 2 — Redis and Performance

### Task 2.1: Provision and harden Redis for Linux Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.db.yml`
- Modify: `.env.example` or current environment example file
- Modify: `apps/backend/src/modules/health/health.service.ts`
- Modify: `apps/backend/src/modules/health/health.controller.ts`
- Modify: `apps/backend/src/modules/health/health.service.spec.ts`
- Create: `docs/COMPOSE_LINUX_OPERATIONS.md`

**Interfaces:**
- Consumes: Existing Redis service, `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, health service, Docker network.
- Produces: authenticated Redis ping with `connected|disabled|error`, Compose lifecycle, backup/restore, and readiness contract.

- [ ] **Step 1: Lock production Redis configuration**

  Require non-empty `REDIS_PASSWORD` in production, remove public host exposure from production Compose, retain internal network access, enable AOF persistence, add restart policy, CPU/memory limits, and bounded log rotation. Keep development override explicit.

- [ ] **Step 2: Fix authenticated health check**

  Use the existing Redis client to execute authenticated `PING`; return latency and status. Do not return `disabled` when `REDIS_ENABLED=true`. Do not expose credentials or Redis command errors containing connection secrets.

- [ ] **Step 3: Align readiness semantics**

  Keep `/health/live` dependency-free. Make `/health/ready` require DB and Redis only when Redis security state is required; return HTTP 503 with stable body when required dependency is unavailable. Add tests for disabled, connected, and error states.

- [ ] **Step 4: Document Linux operations**

  Document `.env` permissions, host volume ownership, `docker compose config`, startup/restart, authenticated `redis-cli`, AOF backup copy, PostgreSQL backup, restore sequence, and rollback. Never print secret values in commands.

- [ ] **Step 5: Run Compose and health tests**

  ```bash
  docker compose config
  npm run test --prefix apps/backend -- --runInBand src/modules/health/health.service.spec.ts
  git diff --check
  git add docker-compose.yml docker-compose.db.yml apps/backend/src/modules/health docs/COMPOSE_LINUX_OPERATIONS.md .env.example
  git commit -m "ops(redis): harden Linux Compose provisioning"
  ```

### Task 2.2: Separate security Redis state from fallback cache

**Files:**
- Modify: `apps/backend/src/shared/core/cache/cache.service.ts`
- Modify: `apps/backend/src/shared/core/cache/cache.module.ts`
- Create: `apps/backend/src/shared/core/cache/redis-client.service.ts`
- Create: `apps/backend/src/shared/core/cache/redis-client.service.spec.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/refresh-session.store.ts`

**Interfaces:**
- Consumes: Existing global `AppCacheModule`, `ioredis`, cache keys, refresh-session store.
- Produces: one typed Redis client adapter; non-security cache may fallback to memory, refresh-session operations fail closed on Redis error.

- [ ] **Step 1: Extract typed client adapter**

  Define `RedisClientService.ping`, `get`, `set`, `del`, `eval`, and `health` with typed string/number results. Keep one global module; do not add a second cache module.

- [ ] **Step 2: Define namespaces and TTL policy**

  Use `auth:refresh`, `cache:roles`, `cache:permissions`, `cache:site`, `cache:department`, and `cache:config` prefixes. Add constants for TTLs and ensure every key has explicit owner/invalidation behavior.

- [ ] **Step 3: Remove unsafe security fallback**

  When Redis is unavailable, refresh store must return a controlled service-unavailable/internal failure that maps to generic auth failure; it must not use in-memory refresh state. Non-security cache can continue fallback with a logged metric.

- [ ] **Step 4: Replace production-wide `KEYS`/`FLUSHDB` usage**

  Scope clear/invalidation by namespace and use `SCAN` or explicit keys. Never flush a shared production Redis database from an application request.

- [ ] **Step 5: Test failure modes and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/shared/core/cache/redis-client.service.spec.ts src/modules/auth/infrastructure/refresh-session.store.spec.ts
  git add apps/backend/src/shared/core/cache apps/backend/src/modules/auth/infrastructure/refresh-session.store.ts
  git commit -m "fix(cache): fail closed for refresh session Redis state"
  ```

### Task 2.3: Migrate refresh sessions from User column to Redis

**Files:**
- Modify: `apps/backend/src/modules/users/entities/user.entity.ts`
- Modify: `apps/backend/src/modules/users/user-password.service.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Create: `apps/backend/src/migrations/1785000000000-PrepareRefreshSessionCutover.ts`
- Create: `apps/backend/src/migrations/1785000001000-RemoveLegacyRefreshTokenColumn.ts` after rollback window
- Create: `apps/backend/src/modules/auth/infrastructure/refresh-session.migration.spec.ts`
- Modify: `docs/superpowers/evidence/2026-08-03-migration-rollback-matrix.md`

**Interfaces:**
- Consumes: Task 1.2 refresh store, current `hashedRefreshToken` column, TypeORM migrations.
- Produces: feature-flagged dual-read/dual-write cutover with Redis as source of truth and explicit legacy-column removal gate.

- [ ] **Step 1: Add migration mode configuration**

  Support `legacy`, `dual`, and `redis` modes with startup validation. In `dual`, new sessions write Redis and legacy hash; reads prefer Redis and may use legacy only for controlled migration compatibility. In `redis`, legacy reads are disabled.

- [ ] **Step 2: Implement migration and session strategy**

  Choose either controlled dual-read/dual-write or forced session invalidation based on Phase 0 counts. If dual mode is used, migrate only valid active sessions with bounded batch size and redact counts. If invalidation is used, delete legacy hashes and require login again.

- [ ] **Step 3: Guard schema migration**

  Add preparation migration only for required metadata/indexes. Keep `hashedRefreshToken` until rollback window closes. Add removal migration only after cutover verification; `down` must restore the column definition where database capability permits.

- [ ] **Step 4: Test cutover and rollback**

  Test each mode, legacy-only session, Redis-only session, Redis outage, duplicate rotation, password-change invalidation, migration rerun, rollback before/after cutover, and active-session count reconciliation.

- [ ] **Step 5: Run migration commands and commit**

  ```bash
  npm run migration:show --prefix apps/backend
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/infrastructure/refresh-session.migration.spec.ts
  git add apps/backend/src/modules/auth apps/backend/src/modules/users apps/backend/src/migrations docs/superpowers/evidence/2026-08-03-migration-rollback-matrix.md
  git commit -m "feat(auth): migrate refresh sessions to Redis"
  ```

### Task 2.4: Add evidence-based cache, indexes, and N+1 fixes

**Files:**
- Modify: query/service files listed in `docs/superpowers/evidence/2026-08-03-query-index-review.md`
- Create: `apps/backend/src/migrations/1785000002000-AddEvidenceBasedIndexes.ts` when the query-index review approves at least one non-duplicate index
- Modify: backend specs adjacent to each query/service change
- Create: `docs/superpowers/evidence/2026-08-03-query-index-review.md`

**Interfaces:**
- Consumes: Phase 0 query plans, existing TypeORM entities/migrations, `CacheService`.
- Produces: explicit cache TTL/invalidation policy, query-count regression tests, and only non-duplicate indexes.

- [ ] **Step 1: Review existing migration indexes**

  Compare all candidate indexes against `1733500000000-AddMissingIndexes.ts`, `1734768000000-AddMissingIndexes.ts`, `1779000000000-AddPerfIndexes.ts`, and database metadata. Record duplicate/overlapping candidates and skip them.

- [ ] **Step 2: Fix confirmed N+1 queries**

  Replace repeated relation loads with explicit joins or bounded batch queries. Preserve authorization filters and pagination. Add query-count test that fails if relation query count exceeds expected bound.

- [ ] **Step 3: Add only justified indexes**

  Create guarded migration with exact columns and reversible `down`. Run `EXPLAIN (ANALYZE, BUFFERS)` before/after and record results without claiming improvement percentages beyond measured samples.

- [ ] **Step 4: Add cache policy for repeated reads**

  Cache only roles/permissions, site/department, and configuration paths proven repetitive. Add TTL constants, invalidation on writes, stale behavior, and tests for hit/miss/invalidation. Do not cache security decisions beyond approved TTL.

- [ ] **Step 5: Run tests and commit**

  Run the exact adjacent service test files named in `docs/superpowers/evidence/2026-08-03-query-index-review.md`, then run:

  ```bash
  npm run build --prefix apps/backend
  git add apps/backend/src/migrations apps/backend/src/modules docs/superpowers/evidence/2026-08-03-query-index-review.md
  git commit -m "perf(backend): apply measured query and cache fixes"
  ```

### Task 2.5: Profile frontend renders before optimization

**Files:**
- Create: `docs/superpowers/evidence/2026-08-03-frontend-profile.md`
- Modify: frontend files only where a measured hot path is confirmed
- Modify: nearest existing frontend test for each changed component

**Interfaces:**
- Consumes: React Profiler/browser performance traces, TanStack Query/Zustand usage, existing component tests.
- Produces: measured render baseline and minimal memoization/query-cache changes only for confirmed hotspots.

- [ ] **Step 1: Capture representative traces**

  Record dashboard, ticket list, ticket detail, and auth navigation traces with sample size, interaction, commit duration, and rerender count. Separate network latency from render cost.

- [ ] **Step 2: Apply one local optimization per confirmed hotspot**

  Use existing `React.memo`, `useMemo`, `useCallback`, or TanStack Query options only when trace identifies avoidable work. Preserve stale/error/loading behavior and avoid broad cache layers.

- [ ] **Step 3: Add regression test and compare traces**

  Run nearest component test plus frontend build. Record before/after trace fields; omit unsupported percentage claims.

- [ ] **Step 4: Commit**

  ```bash
  npm run test --prefix apps/frontend -- --runInBand
  npm run build --prefix apps/frontend
  git add apps/frontend docs/superpowers/evidence/2026-08-03-frontend-profile.md
  git commit -m "perf(frontend): apply measured render fixes"
  ```

**Phase 2 exit:** Redis authenticated health/lifecycle/restore drill passes; refresh validation no longer bcrypt-compares per request; cache fallback cannot authorize refresh; measured query/index/N+1 fixes pass; frontend changes have trace evidence.

---

## Phase 3 — Architecture

### Task 3.1: Establish canonical User and typed auth mappers

**Files:**
- Modify: `apps/backend/src/modules/auth/domain/user.entity.ts`
- Create: `apps/backend/src/modules/auth/application/auth-user.types.ts`
- Create: `apps/backend/src/modules/auth/application/auth-user.mapper.ts`
- Create: `apps/backend/src/modules/auth/application/auth-user.mapper.spec.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/strategies/jwt.strategy.ts`

**Interfaces:**
- Consumes: persistence `User` from `modules/users/entities/user.entity.ts`.
- Produces: `ValidatedUser`, `AuthenticatedUser`, and `toAuthenticatedUser(user: User): AuthenticatedUser`; no runtime use of duplicate auth `User` entity.

- [ ] **Step 1: Compare enum/field differences**

  Map users-module `UserRole` and existing role values explicitly. Add compile-time tests for required auth fields and ensure mapper omits password, hashed refresh token, MFA secret, and internal relations.

- [ ] **Step 2: Replace runtime duplicate usage**

  Update auth service and Passport strategies to consume mapped typed contracts. Keep persistence entity in users module; remove duplicate runtime imports without deleting data fields.

- [ ] **Step 3: Run type/build tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/auth-user.mapper.spec.ts
  npm run build --prefix apps/backend
  git add apps/backend/src/modules/auth
  git commit -m "refactor(auth): use canonical user persistence model"
  ```

### Task 3.2: Extract token and session services

**Files:**
- Create: `apps/backend/src/modules/auth/application/token.service.ts`
- Create: `apps/backend/src/modules/auth/application/token.service.spec.ts`
- Create: `apps/backend/src/modules/auth/application/session.service.ts`
- Create: `apps/backend/src/modules/auth/application/session.service.spec.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: JWT config, refresh-session store, typed auth user.
- Produces: `TokenService.issueAccessToken(user)`, `TokenService.issueRefreshToken(user, familyId, parentId, rememberMe)`, and `SessionService.rotate/ logout/invalidateUser`.

- [ ] **Step 1: Move JWT claim construction**

  Keep exact access claims and expiry compatibility. Centralize refresh claim construction, token IDs, family IDs, and expiry conversion; reject invalid configuration at startup.

- [ ] **Step 2: Move session mutations**

  Move refresh storage, rotation, logout, password-change invalidation, and account-disable invalidation to `SessionService`. Keep operations synchronous and typed.

- [ ] **Step 3: Reduce AuthService orchestration**

  Replace direct JWT/session calls with services; preserve response shape and audit timing. Add tests for delegation and no password/refresh leakage.

- [ ] **Step 4: Run tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/token.service.spec.ts src/modules/auth/application/session.service.spec.ts src/modules/auth/application/auth.service.spec.ts
  git add apps/backend/src/modules/auth
  git commit -m "refactor(auth): extract token and session services"
  ```

### Task 3.3: Extract credential, HRIS, and audit/event boundaries

**Files:**
- Create: `apps/backend/src/modules/auth/application/credential-validator.service.ts`
- Create: `apps/backend/src/modules/auth/application/hris-provisioning.service.ts`
- Create: `apps/backend/src/modules/auth/application/auth-events.ts`
- Create: `apps/backend/src/modules/auth/application/credential-validator.service.spec.ts`
- Create: `apps/backend/src/modules/auth/application/hris-provisioning.service.spec.ts`
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/src/modules/audit/*` only where event consumer integration requires it

**Interfaces:**
- Consumes: timing-safe verifier, HRIS adapter/sync, `AuditService`, `EventEmitter2`.
- Produces: credential validation, HRIS provisioning, and versioned events for login success/failure, logout, password change/reset, disable, and refresh reuse.

- [ ] **Step 1: Extract credential validation**

  Move email and NIK decision logic into one service returning typed success/failure. Keep fail-closed HRIS and current public errors.

- [ ] **Step 2: Extract provisioning orchestration**

  Move employee lookup, mapping, user creation/update, and disabled checks behind one typed service. Prevent partial user creation on failed HRIS state.

- [ ] **Step 3: Publish versioned events after state success**

  Define event names/payload versions with masked identifiers and user ID. Emit only after security-critical state mutation succeeds. Subscriber failure logs and increments metric without undoing successful login.

- [ ] **Step 4: Add tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/credential-validator.service.spec.ts src/modules/auth/application/hris-provisioning.service.spec.ts
  git add apps/backend/src/modules/auth apps/backend/src/modules/audit
  git commit -m "refactor(auth): isolate credential and event boundaries"
  ```

**Phase 3 exit:** canonical user model is runtime source, auth boundaries have no `any`, AuthService orchestrates typed services, and event subscribers cannot break security state changes.

---

## Phase 4 — Quality and Configuration

### Task 4.1: Centralize validated auth configuration

**Files:**
- Create: `apps/backend/src/config/auth.config.ts`
- Create: `apps/backend/src/config/auth.config.spec.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `.env.example` or current environment example

**Interfaces:**
- Consumes: `ConfigModule`, existing environment names.
- Produces: typed config for JWT, bcrypt, cookie, password, Redis mode, throttling, trusted proxy, HRIS timeout, and MFA feature flag.

- [ ] **Step 1: Define startup schema**

  Validate production `JWT_SECRET` length, Redis password/mode, cookie domain policy, numeric limits, timeout, bcrypt rounds, and trusted proxy configuration. Throw before `app.listen` on invalid production configuration.

- [ ] **Step 2: Replace scattered literals**

  Replace auth magic numbers/strings with config constants without changing approved defaults. Keep secrets out of logs and test snapshots.

- [ ] **Step 3: Add config tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/config/auth.config.spec.ts
  npm run build --prefix apps/backend
  git add apps/backend/src/config apps/backend/src/main.ts apps/backend/src/app.module.ts apps/backend/src/modules/auth .env.example
  git commit -m "refactor(config): validate authentication settings at startup"
  ```

### Task 4.2: Remove critical `any`, normalize inputs, and handle async failures

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/strategies/jwt.strategy.ts`
- Modify: HRIS DTO/adapter files identified by compiler
- Modify: `apps/backend/src/modules/audit/audit.service.ts` only for explicit best-effort failure handling
- Modify: relevant auth/HRIS tests

**Interfaces:**
- Consumes: typed contracts from Phases 1–3.
- Produces: no `any` at credential/JWT/request-user/HRIS/audit/refresh boundaries; awaited required operations and explicit best-effort audit handling.

- [ ] **Step 1: Replace boundary `any`**

  Use `ValidatedUser`, `AuthenticatedUser`, typed JWT payload, `Request & { user: AuthenticatedUser }`, typed HRIS response, and `RefreshResult`. Keep `unknown` plus narrowing for untrusted external values.

- [ ] **Step 2: Normalize only identifiers**

  Lowercase and trim email according to existing account contract; trim NIK according to HRIS contract; preserve passwords byte-for-byte. Add tests for casing, whitespace identifiers, and password whitespace.

- [ ] **Step 3: Await state-changing work**

  Await password/session/database mutations. For best-effort audit/notification, attach explicit `try/catch` that logs a redacted error and increments audit failure metric; do not silently discard promise rejection.

- [ ] **Step 4: Run lint/build/tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth src/modules/hris-gateway
  npm run build --prefix apps/backend
  npm run lint --prefix apps/backend
  git add apps/backend/src/modules/auth apps/backend/src/modules/hris-gateway apps/backend/src/modules/audit
  git commit -m "fix(auth): type and handle security boundaries"
  ```

### Task 4.3: Replace production console logging and add edge-case coverage

**Files:**
- Modify: backend files with production `console.*` found by repository scan
- Create/modify: `apps/backend/src/shared/logging/redaction.ts`
- Create/modify: related specs for auth, Redis, DTO, audit failure
- Create: `docs/superpowers/evidence/2026-08-03-log-redaction-scan.md`

**Interfaces:**
- Consumes: existing Nest `Logger`/structured logger pattern, redaction helper.
- Produces: structured logs with event name, correlation/request ID where available, masked identifiers, and no secret fields.

- [ ] **Step 1: Scan and classify console calls**

  Search backend production paths for `console.log`, `console.error`, `console.warn`, and `console.debug`. Replace only production paths; keep test diagnostics if tests require them.

- [ ] **Step 2: Add redaction tests**

  Assert nested objects redact password/token/cookie/authorization/secret/NIK and preserve non-sensitive operational fields. Assert serialized errors do not include request credentials.

- [ ] **Step 3: Add edge-case tests**

  Cover malformed JWT, missing claims, null Redis response, Redis timeout, audit rejection, disabled account, reset replay, DTO boundary, and invalid configuration.

- [ ] **Step 4: Run scan/tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand
  git diff --check
  git add apps/backend/src docs/superpowers/evidence/2026-08-03-log-redaction-scan.md
  git commit -m "fix(logging): redact sensitive authentication context"
  ```

**Phase 4 exit:** configuration fails fast, critical boundaries are typed, required async operations are handled, production logs are structured/redacted, and edge-case tests pass.

---

## Phase 5 — Monitoring and Tracing

### Task 5.1: Add privacy-safe security activity and metrics

**Files:**
- Modify: `apps/backend/src/modules/audit/audit.service.ts`
- Modify: `apps/backend/src/modules/auth/application/auth-events.ts`
- Create: `apps/backend/src/modules/auth/monitoring/auth-metrics.service.ts`
- Create: `apps/backend/src/modules/auth/monitoring/auth-metrics.service.spec.ts`
- Modify: health DTO/service files for aggregate metrics only
- Modify: `apps/backend/src/modules/auth/application/*` event emission points

**Interfaces:**
- Consumes: versioned auth events, redaction helper, existing audit infrastructure.
- Produces: counters/timers for auth latency, Redis errors, HRIS errors, token reuse, audit failures, throttling rejections, password changes, and session invalidations.

- [ ] **Step 1: Define metric names and labels**

  Use bounded labels: outcome, auth method, role class, dependency, and environment. Never use raw email, NIK, JWT ID, IP, or user-agent as unbounded labels.

- [ ] **Step 2: Record privacy-approved context**

  Store masked identifier, user ID where permitted, coarse client context, outcome, and timestamp. Do not claim impossible travel unless reliable geo data is configured; new device/IP detection remains event-only until trusted fingerprint policy exists.

- [ ] **Step 3: Test metrics and audit failure isolation**

  Assert event processing increments expected counters, labels remain bounded, audit failure does not fail login, and sensitive fields are absent.

- [ ] **Step 4: Commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/monitoring/auth-metrics.service.spec.ts
  git add apps/backend/src/modules/auth apps/backend/src/modules/audit apps/backend/src/modules/health
  git commit -m "feat(observability): add authentication security metrics"
  ```

### Task 5.2: Add OpenTelemetry with fail-open exporter behavior

**Files:**
- Modify: `apps/backend/package.json` only if required package is approved after inventory
- Create: `apps/backend/src/observability/telemetry.config.ts`
- Create: `apps/backend/src/observability/telemetry.config.spec.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/modules/auth/application/*`
- Create: `docs/observability.md`

**Interfaces:**
- Consumes: HTTP, auth, TypeORM, Redis, and HRIS boundaries; validated sampling/export configuration.
- Produces: redacted spans for HTTP/auth/DB/Redis/HRIS; exporter/collector outage cannot stop request traffic.

- [ ] **Step 1: Confirm dependency and runtime support**

  Inventory lockfile and existing telemetry packages. Add only the minimum official OpenTelemetry packages if absent; document exact versions and reason. If package policy rejects addition, retain metrics and write a documented integration boundary without fake instrumentation.

- [ ] **Step 2: Configure sampling and redaction**

  Make exporter endpoint, service name, environment, and sampling configurable. Exclude password, token, cookie, authorization, NIK, and raw SQL parameter values from span attributes.

- [ ] **Step 3: Make exporter failure non-blocking**

  Initialize telemetry without preventing app startup when collector is unavailable; record exporter errors through structured logger/metric. Avoid synchronous network calls in request path.

- [ ] **Step 4: Add config/redaction tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/observability/telemetry.config.spec.ts
  npm run build --prefix apps/backend
  git add apps/backend/src/observability apps/backend/src/main.ts apps/backend/package.json docs/observability.md
  git commit -m "feat(observability): add redacted OpenTelemetry tracing"
  ```

**Phase 5 exit:** actionable auth metrics exist, privacy constraints are tested, and tracing exporter failure leaves application traffic healthy.

---

## Phase 6 — MFA/TOTP

### Task 6.1: Add encrypted TOTP enrollment and recovery storage

**Files:**
- Create: `apps/backend/src/modules/auth/mfa/mfa.types.ts`
- Create: `apps/backend/src/modules/auth/mfa/mfa.service.ts`
- Create: `apps/backend/src/modules/auth/mfa/mfa.service.spec.ts`
- Modify: `apps/backend/src/modules/users/entities/user.entity.ts`
- Create: `apps/backend/src/migrations/1785000003000-AddMfaFields.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: configuration files from Phase 4

**Interfaces:**
- Consumes: authenticated user, validated encryption key, bcrypt/approved TOTP library decision, TypeORM migration.
- Produces: `startEnrollment`, `verifyEnrollment`, `disableMfa`, `generateBackupCodes`, `consumeBackupCode`; encrypted TOTP secret and hashed one-time recovery codes.

- [ ] **Step 1: Choose implementation dependency from inventory**

  Use an existing battle-tested TOTP dependency if present; otherwise approve one minimal package with lockfile update and security review. Do not implement cryptography or HOTP/TOTP primitives manually.

- [ ] **Step 2: Add schema with migration**

  Add nullable encrypted secret, enabled/verified timestamps, and recovery-code hashes. Migration `down` drops only these fields. Encrypt secret with existing approved key-management mechanism; fail startup if MFA enabled but key absent.

- [ ] **Step 3: Implement enrollment and one-time recovery**

  Require authenticated setup, issue provisioning data only before verification, require first valid code, rate-limit verification, hash backup codes, and atomically consume each backup code once. Never log secret or raw backup code.

- [ ] **Step 4: Test storage and replay**

  Test enrollment state, invalid/expired code, replayed code, backup-code single use, disable, key missing, and redaction.

- [ ] **Step 5: Run migration/tests and commit**

  ```bash
  npm run migration:show --prefix apps/backend
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/mfa/mfa.service.spec.ts
  git add apps/backend/src/modules/auth/mfa apps/backend/src/modules/users/entities/user.entity.ts apps/backend/src/migrations apps/backend/src/config
  git commit -m "feat(auth): add encrypted TOTP enrollment"
  ```

### Task 6.2: Integrate MFA-pending login state and session policy

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/presentation/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/application/token.service.ts`
- Modify: `apps/backend/src/modules/auth/presentation/dto/*`
- Modify: auth controller/service specs and E2E auth tests

**Interfaces:**
- Consumes: `MfaService`, password-valid result, session service, feature flag.
- Produces: password-valid → MFA-pending → verified → session-issued flow, recovery endpoint, limits, audit events, and invalidation on disable/password change.

- [ ] **Step 1: Add typed MFA-pending result**

  Password success for enabled MFA must not issue access/refresh cookies. Return short-lived, non-session MFA challenge state containing opaque challenge ID; store challenge server-side with TTL and attempt count.

- [ ] **Step 2: Add verify/recovery endpoints**

  Verify TOTP or one backup code, consume challenge atomically, then issue normal session. Apply IP/user limits and generic errors; do not reveal whether account has MFA.

- [ ] **Step 3: Add session invalidation policy**

  MFA enable/disable, password change/reset, and account compromise invalidate existing refresh families according to documented policy. Emit audit events without secrets.

- [ ] **Step 4: Run unit/integration/E2E tests and commit**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/auth.service.spec.ts src/modules/auth/mfa/mfa.service.spec.ts
  npm run test:e2e --prefix apps/backend -- --runInBand
  git add apps/backend/src/modules/auth
  git commit -m "feat(auth): require TOTP before session issuance"
  ```

**Phase 6 exit:** TOTP enrollment, verification, recovery, rate limits, feature flag, audit, and session invalidation are tested; SMS is not included.

---

## Phase 7 — API Platform

### Task 7.1: Inventory routes and establish `/v1` compatibility contract

**Files:**
- Create: `docs/api-route-inventory.md`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: backend controllers only where route versioning is applied
- Create: `apps/backend/test/api-versioning.e2e-spec.ts`
- Modify: Swagger bootstrap/config files

**Interfaces:**
- Consumes: current controller routes, frontend Axios base URL, Swagger setup.
- Produces: `/v1` route contract, compatibility/deprecation policy, and versioned Swagger without breaking current clients during migration window.

- [ ] **Step 1: Generate route/client inventory**

  List controller prefixes, HTTP methods, auth requirements, request/response DTOs, frontend callers, and public consumers. Mark breaking/non-breaking changes.

- [ ] **Step 2: Add versioning with explicit default**

  Configure URI versioning or controller version decorators consistently. Keep current unversioned routes only for documented compatibility window; route `/v1` to same handlers first.

- [ ] **Step 3: Add deprecation behavior**

  Add documentation and response headers only if they do not break clients. Define removal gate: all repository clients use `/v1`, E2E passes, and release note published.

- [ ] **Step 4: Test routes and Swagger**

  E2E-test representative public/authenticated routes, auth cookie behavior, 404/version errors, and generated `/v1` docs. Run frontend tests against configured base URL.

- [ ] **Step 5: Commit**

  ```bash
  npm run test:e2e --prefix apps/backend -- --runInBand test/api-versioning.e2e-spec.ts
  npm run build --prefix apps/backend
  git add apps/backend/src apps/backend/test/api-versioning.e2e-spec.ts docs/api-route-inventory.md
  git commit -m "feat(api): establish versioned v1 contract"
  ```

### Task 7.2: Evaluate and, only with bounded use case, add read-only GraphQL

**Files:**
- Create: `docs/graphql-evaluation.md`
- Create: `apps/backend/src/modules/graphql/graphql.module.ts` only if evaluation approves implementation
- Create: `apps/backend/src/modules/graphql/graphql.resolver.ts` only if approved
- Create: `apps/backend/src/modules/graphql/graphql.service.ts` only if approved
- Create: `apps/backend/src/modules/graphql/graphql.spec.ts` only if approved
- Modify: `apps/backend/package.json` only if required package is approved

**Interfaces:**
- Consumes: versioned service/query contracts and existing authorization/pagination.
- Produces: bounded read-only query surface, or a documented no-go decision; no ORM entity exposure and no mutations.

- [ ] **Step 1: Write use-case evaluation**

  Compare current REST clients, query composition need, authorization complexity, operational cost, and schema ownership. Choose no implementation when no concrete consumer requires GraphQL.

- [ ] **Step 2: If approved, define bounded schema**

  Expose only named read models. Enforce existing RBAC/site isolation, cursor/limit pagination, depth/complexity limit, timeout, and rate limit. Never return TypeORM entities directly.

- [ ] **Step 3: Add authorization and abuse tests**

  Test unauthorized field access, cross-site access, excessive depth/complexity, unbounded pagination, rate limit, and resolver query count.

- [ ] **Step 4: Commit evaluation or implementation**

  ```bash
  npm run test --prefix apps/backend -- --runInBand src/modules/graphql/graphql.spec.ts
  git add docs/graphql-evaluation.md apps/backend/src/modules/graphql apps/backend/package.json
  git commit -m "feat(api): add bounded read-only GraphQL surface"
  ```

  If evaluation rejects GraphQL, commit only `docs/graphql-evaluation.md` with:

  ```bash
  git add docs/graphql-evaluation.md
  git commit -m "docs(api): record GraphQL boundary evaluation"
  ```

**Phase 7 exit:** routes and clients are inventoried, `/v1` compatibility tests pass, and GraphQL is either bounded/tested or explicitly rejected based on evidence.

---

## Phase 8 — Documentation and Deployment

### Task 8.1: Resolve port contract and Compose Linux release contract

**Files:**
- Modify: `apps/backend/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.db.yml`
- Modify: `apps/frontend/nginx.conf`
- Modify: `apps/backend/src/main.ts` only if final port config is made environment-driven
- Modify: `README.md`
- Modify: `docs/COMPOSE_LINUX_OPERATIONS.md`
- Create: `apps/backend/test/port-contract.e2e-spec.ts`

**Interfaces:**
- Consumes: application listener, Dockerfiles, Compose services, frontend API proxy, Swagger URL.
- Produces: one tested internal port, recommended `5050`, aligned healthcheck/proxy/docs contract.

- [ ] **Step 1: Update all port references atomically**

  Set backend container `EXPOSE`, Compose target/published port, frontend proxy upstream, healthchecks, Swagger URL, and README to `5050` unless Phase 0 approves another explicit contract.

- [ ] **Step 2: Add end-to-end port test**

  Build/start backend, query `/health/live` on `5050`, query frontend proxy API route, and assert Swagger URL uses final port. Test failure when any stale `3001` reference remains in deployment files.

- [ ] **Step 3: Verify Linux Compose release flow**

  Run `docker compose config`, build, startup, authenticated Redis health, DB readiness, restart, backup, restore in staging copy, and clean shutdown. Record exact commands and expected outputs in operations doc.

- [ ] **Step 4: Commit**

  ```bash
  npm run test:e2e --prefix apps/backend -- --runInBand test/port-contract.e2e-spec.ts
  docker compose config
  git diff --check
  git add apps/backend/Dockerfile docker-compose.yml docker-compose.db.yml apps/frontend README.md docs/COMPOSE_LINUX_OPERATIONS.md apps/backend/test/port-contract.e2e-spec.ts
  git commit -m "fix(deploy): align backend port contract"
  ```

### Task 8.2: Add Kubernetes Kustomize base and overlays

**Files:**
- Create: `deploy/k8s/base/namespace.yaml`
- Create: `deploy/k8s/base/configmap.yaml`
- Create: `deploy/k8s/base/backend-deployment.yaml`
- Create: `deploy/k8s/base/backend-service.yaml`
- Create: `deploy/k8s/base/frontend-deployment.yaml`
- Create: `deploy/k8s/base/frontend-service.yaml`
- Create: `deploy/k8s/base/ingress.yaml`
- Create: `deploy/k8s/base/network-policy.yaml`
- Create: `deploy/k8s/base/service-account.yaml`
- Create: `deploy/k8s/base/kustomization.yaml`
- Create: `deploy/k8s/overlays/staging/kustomization.yaml`
- Create: `deploy/k8s/overlays/production/kustomization.yaml`
- Create: `deploy/k8s/overlays/production/migration-job.yaml`
- Modify: `docs/KUBERNETES_DEPLOYMENT.md`

**Interfaces:**
- Consumes: immutable backend/frontend images, final port/health contract, external PostgreSQL/Redis secrets.
- Produces: non-root Deployments, Services, Ingress TLS route, probes, NetworkPolicy, resource limits, migration Job, and environment overlays.

- [ ] **Step 1: Define base manifests**

  Use `5050` for backend container/service, `8080` for frontend container/service, immutable image placeholders overridden by overlays, non-root security context, dropped capabilities, read-only filesystem where supported, resource requests/limits, and least-privilege ServiceAccount.

- [ ] **Step 2: Define probes**

  Startup probes use process/config readiness; liveness uses `/health/live`; readiness uses `/health/ready` and therefore checks required DB/Redis. Set timeouts and failure thresholds from measured startup behavior.

- [ ] **Step 3: Define policy and ingress**

  Allow frontend/backend egress only to required DB/Redis/observability endpoints and ingress traffic only through controller/backend service. Do not create public PostgreSQL/Redis Services. Configure TLS host placeholders through overlays, not committed secrets.

- [ ] **Step 4: Define migration Job**

  Use same backend image/version, same secret references, `restartPolicy: Never`, bounded backoff, migration command, and unique release/job name. Require backup before irreversible migration and wait for Job completion before rollout.

- [ ] **Step 5: Render and validate manifests**

  ```bash
  kubectl kustomize deploy/k8s/overlays/staging
  kubectl kustomize deploy/k8s/overlays/production
  git diff --check
  git add deploy/k8s docs/KUBERNETES_DEPLOYMENT.md
  git commit -m "feat(deploy): add optional Kubernetes Kustomize manifests"
  ```

### Task 8.3: Run staging Kubernetes smoke, backup, and rollback drill

**Files:**
- Modify: `docs/KUBERNETES_DEPLOYMENT.md`
- Create: `docs/KUBERNETES_RELEASE_CHECKLIST.md`
- Create: `docs/superpowers/evidence/2026-08-03-kubernetes-smoke.md`

**Interfaces:**
- Consumes: staging cluster, registry images, Kustomize overlays, secret manager, migration Job.
- Produces: tested deployment procedure, smoke evidence, rollback decision, and production gate.

- [ ] **Step 1: Build and push immutable images**

  Use Git SHA tags; inspect images for non-root execution and absence of `.env`, keys, passwords, tokens, and build artifacts exposing secrets.

- [ ] **Step 2: Deploy staging and migration**

  Create namespace/secrets through secure mechanism, render manifests, run migration Job, wait for completion, then roll out backend/frontend. Capture image tag and migration version.

- [ ] **Step 3: Run smoke tests**

  Verify HTTPS frontend, health endpoints, email login, NIK/HRIS fail-closed simulation, refresh rotation/replay, logout, password-change invalidation, Redis outage readiness, ticket read/write, TLS route, and log redaction.

- [ ] **Step 4: Rehearse rollback and restore**

  Roll back application only across backward-compatible schema. Simulate failed migration using disposable database backup, restore PostgreSQL/Redis according to operations docs, and record RPO/RTO. Do not roll back irreversible migration without restore plan.

- [ ] **Step 5: Commit evidence**

  ```bash
  git diff --check
  git add docs/KUBERNETES_DEPLOYMENT.md docs/KUBERNETES_RELEASE_CHECKLIST.md docs/superpowers/evidence/2026-08-03-kubernetes-smoke.md
  git commit -m "docs(deploy): record Kubernetes staging release drill"
  ```

**Phase 8 exit:** Compose Linux procedure passes; port contract is consistent; Kubernetes optional manifests render; staging migration/probes/TLS/policy/rollback smoke passes when Phase 8B is enabled.

---

## Final Review and Release Gate

### Task 9.1: Cross-phase regression verification

**Files:**
- Verify all files changed by Tasks 0.1–8.3
- Modify only if a verified regression is found
- Create: `docs/superpowers/evidence/2026-08-03-final-verification.md`

**Interfaces:**
- Consumes: phase commits, baseline evidence, migrations, Compose/Kubernetes artifacts, backend/frontend test suites.
- Produces: final pass/fail matrix and explicit remaining `needs evidence` items.

- [ ] **Step 1: Run static and type checks**

  ```bash
  git diff --check
  npm run build --prefix apps/backend
  npm run build --prefix apps/frontend
  npm run lint --prefix apps/backend
  npm run lint --prefix apps/frontend
  ```

  Record exact command output; an unavailable lint script is a reported failure, not a pass.

- [ ] **Step 2: Run backend tests**

  ```bash
  npm run test --prefix apps/backend -- --runInBand
  npm run test:e2e --prefix apps/backend -- --runInBand
  ```

  Include auth timing, refresh concurrency/replay, proxy/IP, HRIS outage, Redis health/failure, migrations, MFA, API version, and health suites.

- [ ] **Step 3: Run frontend tests/build**

  ```bash
  npm run test --prefix apps/frontend -- --runInBand
  npm run build --prefix apps/frontend
  ```

- [ ] **Step 4: Run operational checks**

  ```bash
  docker compose config
docker compose up -d --build
docker compose ps
docker compose down
kubectl kustomize deploy/k8s/overlays/staging
  ```

  Run Redis authenticated health, backup/restore drill, migration show/run in disposable environment, secret scan, and deployment-file port scan.

- [ ] **Step 5: Write final matrix**

  For each of 18 audit recommendations, record status, evidence path, test command, deployment impact, rollback path, and remaining limitation. Mark recommendations without proof as `needs evidence`; do not claim completion from code presence alone.

- [ ] **Step 6: Commit final evidence**

  ```bash
  git add docs/superpowers/evidence/2026-08-03-final-verification.md
  git commit -m "docs(audit): record final hardening verification"
  ```

### Release gate

Release is approved only when:

- timing-safe login and generic auth errors pass;
- refresh rotation is atomic, replay invalidates family, and Redis outage cannot authorize;
- IP limits use trusted client identity;
- register/change/reset share password policy;
- cookie set/clear options match;
- HRIS outage fails closed and secrets are redacted;
- Redis authentication, persistence, health, backup, and restore pass;
- measured query/index/N+1 changes have evidence;
- canonical User and typed auth boundaries compile;
- required async operations are handled;
- metrics/tracing do not leak sensitive data or block traffic;
- TOTP recovery is one-time and rate-limited;
- `/v1` contract and GraphQL boundary are documented/tested;
- Compose Linux startup/restart/rollback works;
- port contract is consistent at `5050`;
- Kubernetes staging gate passes when enabled;
- no test, build, lint, migration, secret-scan, or `git diff --check` failure remains unexplained.

## Self-review checklist

- [ ] Spec sections Goal, Evidence, Architecture, Phases 0–8, cross-phase verification, and out-of-scope each map to tasks above.
- [ ] No task requires unbounded GraphQL, SMS MFA, unrelated ticket refactor, speculative abstraction, or unmeasured percentage claims.
- [ ] All new interfaces have names, parameters, return intent, and consuming/producing boundaries.
- [ ] Migration and rollback rules cover refresh state, MFA fields, indexes, and deployment schema compatibility.
- [ ] Redis provisioning, Docker Compose Linux, and Kubernetes optional deployment are explicit.
- [ ] No `TBD`, `TODO`, `implement later`, or vague “write tests” step remains.
- [ ] Every task ends with a concrete test/check and commit command.
