# Security Review — Hardware Request Module

**Date:** 2026-04-19
**Reviewer:** Plan 09 automated hardening
**Scope:** `apps/backend/src/modules/hardware-request/**`

---

## Findings & Resolutions

### [FIXED] WS-01 — WebSocket CORS wildcard
- **File:** `realtime/hardware-request.gateway.ts:17`
- **Finding:** `cors: { origin: '*' }` — any domain could connect.
- **Resolution:** Replaced with `buildCorsOrigin()` function reading `WS_CORS_ORIGIN` env. In `NODE_ENV=production`, boot aborts if env not set.
- **Status:** CLOSED

### [FIXED] WS-02 — WebSocket no authentication
- **File:** `realtime/hardware-request.gateway.ts:25-28`
- **Finding:** `handleConnection` had comment "Can read token here for auth if needed" — no token validation.
- **Resolution:** `WsAuthGuard.verifyAndAttach()` called in `handleConnection`. Invalid/missing JWT → immediate disconnect.
- **Status:** CLOSED

### [FIXED] WS-03 — WebSocket no per-room authorization
- **File:** `realtime/hardware-request.gateway.ts:35-44`
- **Finding:** Any authenticated user could subscribe to any `request:<id>` room, leaking status/comments/assets of others.
- **Resolution:** `wsRoomAuthz()` in `handleSubscribe` — only requester, ICT Lead, ICT Procurement, ICT Technician may join a room.
- **Status:** CLOSED

### [FIXED] MIG-01 — Migration lossy without pre-flight check
- **File:** `migrations/1776000300000-MigrateIctBudgetData.ts`
- **Finding:** No row count check, no backup, no rollback path, default status `CANCELLED` for unknown rows (data loss risk).
- **Resolution:**
  - New preflight migration `1776000299000-PreflightIctBudgetCheck.ts` creates backup table + aborts if `site_id IS NULL` with no fallback.
  - Main migration now asserts backup exists, logs row counts, supports `HARDWARE_MIGRATION_DRY_RUN=true`.
  - Default status changed `CANCELLED` → `DRAFT` (admin review instead of silent discard).
- **Status:** CLOSED

### [FIXED] RATE-01 — Mutation endpoints unbounded
- **Files:** `presentation/hardware-request.controller.ts`, `presentation/installation.controller.ts`
- **Finding:** No rate limiting on submit/approve/reject/barcode scan endpoints.
- **Resolution:** `@Throttle` added: create=10/min, submit/approve/reject/cancel=30/min, barcode=60/min.
- **Status:** CLOSED

### [FIXED] DEPR-01 — Legacy `/ict-budget/*` returns 404
- **File:** Plan 5.7 — never implemented
- **Finding:** Clients calling `/ict-budget/*` received 404 instead of redirect.
- **Resolution:** `IctBudgetRedirectController` — `@All('*')` issues 308 Permanent Redirect with `Deprecation: true` and `Sunset: 2026-07-01` headers.
- **Status:** CLOSED

### [VERIFIED] RBAC-01 — Activity endpoint access control
- **File:** `presentation/hardware-activity.controller.ts`
- **Finding:** "RBAC belum diverifikasi" per audit.
- **Verification:** Controller has `@UseGuards(JwtAuthGuard, HardwareRoleGuard)`. Service `listForRequest` throws `PermissionDeniedError` for non-owners/non-ICT users. Tests added in `__tests__/hardware-activity.rbac.spec.ts`.
- **Status:** CLOSED (already implemented, now tested)

### [OK] XSS-01 — Handlebars raw output
- **Finding:** Check for `{{{...}}}` in email templates.
- **Scan:** `grep -rn "{{{" apps/backend/src` — 0 hits. All user-input fields use escaped `{{var}}`.
- **Status:** PASS

### [OK] SEC-01 — Hardcoded secrets
- **Scan:** `grep -rnE "sk_live|sk_test|password.*=.*['\"][^'\"]{8,}"` — 0 hits in source files.
- **Status:** PASS

---

## Env Vars Required (updated `.env.example`)

| Variable | Required in prod | Purpose |
|---|---|---|
| `JWT_SECRET` | YES | HTTP + WS token verification |
| `WS_CORS_ORIGIN` | YES | WS gateway allowed origins |
| `HARDWARE_MIGRATION_DRY_RUN` | NO | Dry-run migration (default false) |

---

## Test Coverage Added

- `realtime/__tests__/hardware-request.gateway.auth.spec.ts` — WsAuthGuard + handleSubscribe authz
- `presentation/__tests__/ict-budget-redirect.spec.ts` — 308 redirect
- `presentation/__tests__/hardware-activity.rbac.spec.ts` — RBAC matrix

---

## Remaining / Out of Scope

- E2E smoke test — Plan 10
- 80%+ coverage gate — Plan 10
- Broader RBAC system refactor — future
