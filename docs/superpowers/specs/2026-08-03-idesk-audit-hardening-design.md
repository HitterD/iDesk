# iDesk Audit Hardening — Master Design

**Date:** 2026-08-03  
**Source:** `docs/docs_Improvement_V7_diff.md`  
**Status:** Design approved; implementation plan pending.

## Goal

Address all audit recommendations in dependency order. Reduce authentication risk first, then improve Redis/database performance, architecture, code quality, monitoring, MFA, API evolution, documentation, and deployment operations.

Docker Compose on Linux remains primary deployment target. Kubernetes is an optional follow-up after Compose, image, health, migration, and secret contracts stabilize.

## Evidence and constraints

Verified code facts:

- `AuthService` currently owns credential validation, token generation, password changes, HRIS flow, audit calls, and provisioning orchestration: `apps/backend/src/modules/auth/application/auth.service.ts:21-285`.
- Missing-user email login returns before bcrypt comparison: `auth.service.ts:68-110`.
- Refresh tokens are bcrypt-hashed in `users.hashedRefreshToken`: `apps/backend/src/modules/users/user-password.service.ts:40-59`, `apps/backend/src/modules/users/entities/user.entity.ts:80-82`.
- Refresh validation has no token ID, family, or replay detection: `auth.service.ts:250-263`.
- Login has endpoint throttling but no verified IP-specific limiter: `apps/backend/src/modules/auth/presentation/auth.controller.ts:26-29`.
- Auth cookies use `path: '/'`: `auth.controller.ts:12-19`.
- Audit calls include unhandled fire-and-forget promises: `auth.service.ts:46-54, 74-80, 111-119, 230-239`.
- Critical auth contracts contain `any`: `auth.service.ts:17-19, 191-198`.
- Two User models exist: `apps/backend/src/modules/auth/domain/user.entity.ts:6-18` and `apps/backend/src/modules/users/entities/user.entity.ts:21-126`.
- Redis services already exist in Compose: `docker-compose.yml:26-40`, `docker-compose.db.yml:26-40`.
- Backend Dockerfile/Compose expose `3001`, while application code listens on `5050`: `apps/backend/Dockerfile:27`, `docker-compose.yml:68-75`, `apps/backend/src/main.ts:261`.

Recommendations not proven by code inspection must be marked `confirmed`, `not reproduced`, or `needs evidence` during Phase 0. Do not claim estimated percentage impact without measurements.

## Architecture principles

- Security fixes precede broad refactors.
- Preserve existing business behavior and public error contracts unless a versioned change is approved.
- Use existing dependencies before adding any dependency.
- Keep security-critical state synchronous; use events for side effects.
- Use typed auth DTOs and view models; never return password or refresh state.
- Use Redis as the refresh-token source of truth after migration cutover.
- Default HRIS outage behavior is fail closed unless a security-approved fallback contract says otherwise.
- Add abstractions only when multiple real consumers justify them.
- Every phase has migration, rollback, test, and exit criteria.

## Master roadmap

### Phase 0 — Baseline and verification

- Trace email, NIK/HRIS, disabled-account, password, refresh, logout, reset, and change-password flows.
- Measure auth p50/p95 latency, bcrypt cost, query count, Redis availability, failed-login rate, and coverage.
- Inspect real queries before adding indexes; verify route prefix before changing cookie path.
- Create threat model, compatibility contract, migration matrix, and rollback matrix.

**Exit:** every audit item classified; baseline recorded; contract tests exist for critical paths.

### Phase 1 — Critical security

1. **Timing-safe login**
   - Normalize identifier.
   - Always run bcrypt comparison using a precomputed dummy hash when user is absent.
   - Evaluate account existence/status after comparison.
   - Mask identifiers in logs.

2. **Refresh-token rotation and replay detection**
   - Add `tokenId`, `familyId`, `parentId`, `type`, `rememberMe`, `iat`, and `exp` claims.
   - Store digest/opaque state in Redis with TTL and namespaced keys.
   - Atomically consume current token and issue child token.
   - Reuse invalidates token family, records security event, and returns generic unauthorized response.
   - Logout, password change/reset, disable, and compromise invalidate sessions.

3. **IP-based rate limiting**
   - Keep account/user limiting.
   - Add login, refresh, register, and reset IP limits.
   - Configure trusted proxy explicitly; do not trust arbitrary forwarded headers.

4. **Password policy**
   - Central validator for registration, change, and reset.
   - Minimum 12 characters, complexity checks, common-password rejection, user-info rejection, maximum length.
   - Preserve existing passwords until next create/change/reset.

5. **Cookie/session hardening**
   - Centralize set/clear options.
   - Verify API prefix before narrowing path.
   - Preserve HttpOnly, production Secure, SameSite strict, and explicit domain policy.

6. **HRIS resilience**
   - Add timeout/circuit-breaker behavior using existing capabilities where possible.
   - Distinguish invalid credentials, ineligible employee, and HRIS outage.
   - Fail closed by default; never log passwords or full NIK values.

**Tests:** unit, integration, E2E, concurrent refresh, replay, Redis outage, proxy/IP, cookie parity, and security regression tests.

### Phase 2 — Redis and performance

- Harden Compose Redis: production password, internal network, authenticated healthcheck, persistence, backup/restore, Linux volume permissions, restart policy, resource limits, and log policy.
- Use one Redis adapter for refresh sessions, cache, and health checks.
- Migrate with temporary dual-read/dual-write or session invalidation at cutover; remove legacy column only after rollback window.
- Cache roles/permissions, site/department data, and configuration with explicit key, TTL, invalidation, and stale policy.
- Add indexes only from query evidence and migrations; check duplicate/overlapping indexes.
- Fix confirmed N+1 queries with explicit joins and query-count/plan tests.
- Profile frontend renders before adding memoization; do not add cache layers without evidence.

**Exit:** Compose lifecycle and restore drill pass; refresh no longer bcrypt-compares per request; no token/password leakage; performance compared with baseline.

### Phase 3 — Architecture

- Make `apps/backend/src/modules/users/entities/user.entity.ts` canonical persistence model.
- Replace auth domain `User` runtime usage with typed `ValidatedUser`/`AuthenticatedUser` contracts and mappers.
- Extract `TokenService`, `SessionService`, credential validation, HRIS provisioning, and audit/event handling from `AuthService`.
- Add repository boundaries only for shared query contracts; avoid generic CRUD base classes without need.
- Add versioned auth domain events for login, failure, logout, password changes/resets, account disable, and refresh reuse.
- Keep state-changing security operations synchronous; subscriber failures must be logged/metricized without breaking successful login.

### Phase 4 — Quality

- Centralize auth configuration, cookie settings, expiry, limits, bcrypt rounds, password policy, Redis keys, and proxy settings.
- Validate configuration at startup; production secrets are mandatory and never committed.
- Remove `any` from critical auth boundaries; type JWT, request user, HRIS, audit, and refresh results.
- Normalize email/NIK before lookup; never trim/normalize passwords silently.
- Await required operations; handle best-effort audit/notification failures explicitly.
- Replace production `console.*` with structured logger; mask secrets and sensitive identifiers.
- Create shared cookie utility only for multiple real consumers.
- Add edge-case coverage for auth, Redis, DTOs, and audit failures.

### Phase 5 — Monitoring and tracing

- Record privacy-approved login context and security events.
- Detect new device/IP, repeated failures, refresh reuse, password/session changes, and impossible travel only when reliable geo data exists.
- Add actionable metrics: auth latency, Redis errors, HRIS errors, token reuse, audit failure, rate-limit rejection, and password changes.
- Add OpenTelemetry HTTP/auth/DB/Redis/HRIS spans with redaction and configurable sampling.
- Collector/exporter outage must not stop application traffic.

### Phase 6 — MFA/TOTP

- TOTP only for first implementation; no SMS without separate threat model.
- Encrypt MFA secret; hash one-time backup codes.
- Enrollment requires authenticated setup and first-code verification.
- Login uses password-valid → MFA-pending → verified → session-issued states.
- Add recovery, rate limits, feature flags, session invalidation policy, and audit events.

### Phase 7 — API platform

- Inventory routes and clients before versioning.
- Introduce `/v1` contract with compatibility/deprecation rules and versioned Swagger.
- Evaluate GraphQL only for a bounded read-only surface; enforce existing authorization, pagination, depth/complexity limits, and rate limits.
- Do not expose ORM entities or add GraphQL mutations until a demonstrated use case exists.

### Phase 8 — Documentation and deployment

- Document Compose Linux provisioning, secrets, Redis operations, migration, backup, restore, healthchecks, and rollback.
- Resolve backend port contract mismatch before Kubernetes: recommended internal port is `5050`, matching `main.ts` and README.
- Add Kubernetes Kustomize base/overlays only after Compose and image contracts stabilize.
- Use migration Job, readiness/liveness/startup probes, Ingress TLS, NetworkPolicy, non-root security contexts, resource limits, and immutable image tags.
- Prefer managed/external PostgreSQL and Redis for production; self-hosted StatefulSets require backup, restore drill, and explicit RPO/RTO.

## Cross-phase verification

Each phase must run the smallest targeted tests first, then backend/frontend build and relevant E2E tests. Final verification includes:

- `git diff --check`;
- backend unit/integration/E2E tests;
- frontend tests/build;
- Compose startup and restart;
- Redis auth/health/restore drill;
- migration and rollback drill;
- security log redaction scan;
- staging Kubernetes smoke test if Phase 8B is enabled.

No phase is complete while tests fail or a known security/data-loss issue remains unresolved.

## Out of scope

No unrelated ticketing refactor, no speculative abstraction, no unbounded GraphQL migration, no SMS MFA, and no percentage-impact claims without measurements.
