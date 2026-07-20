# Agents Page Filters, Preset System & Oracle Access Scoping — Design Spec
**Date:** 2026-07-20
**Branch:** refactor/zoom-calendar-redesign
**Status:** Draft (pending user review)

---

## Overview

Three-part fix, approved conversationally section by section:

1. **Bagian 1** — Agents admin page shows wrong/inconsistent filter counts.
2. **Bagian 2** — Preset system: unlock system presets for editing (but not deletion), disable Zoom Calendar by default for USER role (existing + new), add `USER_ZOOM` preset, add `AGENT_OPERATIONAL_SUPPORT` preset mirroring `AGENT`, fix "No Preset" display bug, auto-assign preset on user provisioning.
3. **Bagian 3** — `AGENT_ORACLE` role restricted to Oracle/K2 ticketing + Notifications only; all other pages/routes closed.

Roles in scope: `ADMIN`, `AGENT` (legacy, kept for compat), `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ORACLE`, `AGENT_ADMIN`, `USER`, `MANAGER`.

---

## Bagian 1: Agents Page Filter/Count Fixes

### Problem
`BentoAdminAgentsPage.tsx` and children pull counts from three independent, differently-scoped data sources that don't agree:

1. **Role-pill counts** (`AgentFiltersToolbar.tsx:130-135`) — computed from `users`, which is only the *current page* of the server-paginated `/users` response. Component already self-flags this with a `~` prefix and tooltip when `totalPages > 1`, but the number is still wrong at a glance.
2. **Dashboard stat cards** (`BentoAdminAgentsPage.tsx:270-282`) — computed from `filteredAgentStats`, itself derived (`:258-267`) from a *separate* `agent-stats` query (`:144-152`, key `['agent-stats']`) that is filtered by site/role client-side but **not by search query**.
3. **Site tab counts** (`siteCounts`, `:320-326`) — `ALL` uses server `paginationMeta.total` (correct), but per-site counts use the same search-blind `agentStats` array.
4. **"Total Users" card** (`AgentStatsDashboard.tsx:23-35`) prefers `paginationMeta?.total` (correct, search-aware) over `dashboardStats.totalAgents`, but the "Active"/"Resolved" cards (`:37-53`) have no such server fallback and stay search-blind.

Net effect: as soon as a search query is active or results span more than one page, the stat cards, role pills, and site tabs can all show different numbers for what looks like the same metric.

### Fix
Single source of truth per metric, all keyed to the same filters (site + role + search):

- **Role-pill counts**: stop deriving from the paginated `users` slice. Add role counts to the existing paginated `/users` endpoint response (`meta.roleCounts: Record<Role, number>`, computed server-side with the same `WHERE` filters as the page query, minus the role filter itself so all pills are visible simultaneously). `AgentFiltersToolbar.tsx` reads `paginationMeta.roleCounts` instead of counting the local `users` array. Removes the `~` approximation entirely.
- **`agent-stats` endpoint**: add `search` as an accepted/forwarded query param (`GET /users/agents/stats?search=...&site=...&role=...`), so `filteredAgentStats`/`dashboardStats` and the paginated table are always describing the same filtered set. Remove the client-side `filteredAgentStats` re-filtering in favor of server-side filtering, matching how `/users` already works.
- **Site tab counts**: once `agent-stats` accepts the same filters as `/users`, `siteCounts` becomes consistent by construction — no separate client math needed beyond grouping the (now correctly filtered) response by site.

**Files to modify:**
- `apps/backend/src/modules/users/*` — wherever `/users` and `/users/agents/stats` are implemented, add `roleCounts` to the paginated response meta and accept `search` on the stats endpoint.
- `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` — drop client-side `filteredAgentStats` derivation, pass `searchQuery`/`selectedSite`/`selectedRole` straight through to the `agent-stats` query key and API call.
- `apps/frontend/src/features/admin/components/agent-management/AgentFiltersToolbar.tsx` — read counts from `paginationMeta.roleCounts` instead of local `users.filter(...)`.
- `apps/frontend/src/features/admin/components/agent-management/AgentStatsDashboard.tsx` — no structural change needed once inputs agree; keep `total ?? dashboardStats.totalAgents` fallback pattern for "Total Users" and mirror it for the other cards for defense-in-depth.

---

## Bagian 2: Preset System Fixes

### B2.1 — Unlock system presets for editing, keep delete blocked

**Current state:**
- `PermissionPreset` entity (`permission-preset.entity.ts:39-72`) has `isSystem: boolean` — no separate `isLocked`/`isDeletable` field.
- Backend `updatePreset` (`permissions.service.ts:801-850`) already has **no** `isSystem` check — editing a system preset via the API already works today.
- Backend `deletePreset` (`:852-865`) already blocks system-preset deletion: `if (preset.isSystem) throw new Error('Cannot delete system preset')`.
- The lock is purely a **frontend** restriction: `PresetDrawer.tsx` disables all fields (`disabled={isSystem}`, e.g. `:454,466,483,510`) and hides the Save button (`:430-439`) whenever `preset.isSystem`.

**Fix:** remove the frontend lock, keep the backend delete guard as-is.
- `PresetDrawer.tsx` — remove `disabled={isSystem}` from all editable fields (name, description, targetRole, page-access toggles). Remove the Save-button hiding condition (`:430-439`) so system presets save normally.
- Keep the Lock icon (`:357-359`) and "System preset" badge (`:398-403`) as informational only (signals "this is a default preset," not "read-only").
- Keep Delete button hidden for `isSystem` presets (`:421-429`) — matches "editable saja, jangan boleh dihapus."
- Backend: upgrade `deletePreset`'s plain `throw new Error(...)` (`:860`) to `throw new ForbiddenException('Cannot delete system preset')` so it surfaces as a clean 403 instead of an unhandled 500 — small correctness fix, not new scope.
- No entity/migration change needed — `isSystem` alone is sufficient for "editable but not deletable."

### B2.2 — Disable Zoom Calendar by default for USER role

**Current state:** `zoom_calendar` is `true` in the seeded `USER` system preset's `pageAccess` (`permissions.service.ts:159`) and listed in `USER_PAGES` (`:32`, used only as the fallback when no preset is applied).

**Fix, per "semua user sekarang dan user baru":**
- Change seeded `USER` preset's `pageAccess.zoom_calendar` from `true` to `false` (`:159`) — this is what new installs and any newly-seeded `USER` preset row get going forward.
- `seedDefaultPresets()` only fills in *missing* keys on existing system presets (`:399-423`) — it won't retroactively flip an already-present `zoom_calendar: true` to `false` on the existing `USER` preset row, since that logic exists to preserve admin customizations, not to force-sync every value on every boot. Since B2.1 now allows admins to freely re-enable Zoom Calendar per-user anyway (via editing the preset or applying `USER_ZOOM`), a one-time forced overwrite is safe here and simpler than trying to detect "was this customized." **Decision: add a one-time data migration** (TypeORM migration, not seed-function logic) that sets `pageAccess.zoom_calendar = false` on the existing `USER` system preset row. This runs once, is idempotent (re-running finds the value already `false` and no-ops), and keeps `seedDefaultPresets()` itself unchanged (still additive-only for existing rows).
- `USER_PAGES` fallback array (`:32`) stays as-is (defines that `zoom_calendar` is *available* to USER role at all — just not on by default); actual default access is controlled by the preset's `pageAccess`, not this array.
- All users currently on the `USER` system preset (i.e., `appliedPresetId` pointing at it, or falling back to it) lose Zoom Calendar access the moment the corrected preset is saved — this is the intended "semua user sekarang" behavior, achieved for free once B2.4 (below) ensures existing users are actually linked to the preset rather than floating on the no-preset fallback.

### B2.3 — New presets: `USER_ZOOM` and `AGENT_OPERATIONAL_SUPPORT`

**`USER_ZOOM`:**
- New entry in `DEFAULT_PRESETS` (alongside `User`/`Agent`/`Manager`/`Admin`, `:146-356`), `targetRole: 'USER'`, `isSystem: true`, `pageAccess` = same as `USER` preset but with `zoom_calendar: true`.
- Shows up in preset dropdown/drawer as a selectable alternative for users who need Zoom Calendar — admin applies it per-user via existing `appliedPresetId` mechanism, no new UI needed beyond it appearing in the existing preset list.

**`AGENT_OPERATIONAL_SUPPORT` preset:**
- New entry in `DEFAULT_PRESETS`, `targetRole: 'AGENT'` (reusing the existing type since `PresetTargetRole` has no distinct value for this — see note below), `isSystem: true`, `pageAccess` = identical copy of the `Agent` preset's `pageAccess` (`:187-235`).
- **Note on `PresetTargetRole`:** the type (`permission-preset.entity.ts:37`) is `'USER' | 'AGENT' | 'MANAGER' | 'ADMIN'` — it has no `AGENT_OPERATIONAL_SUPPORT`/`AGENT_ORACLE` variants. `targetRole` is used for UI grouping/labeling only (which preset shows under which role tab), not for access enforcement — enforcement is entirely through `pageAccess` + `appliedPresetId`. Reusing `'AGENT'` as the `targetRole` for both the new Operational Support preset and the existing Agent preset is consistent with current usage and avoids widening the entity/type for a label-only concern. Flagging this as a deliberate scope limitation, not an oversight.
- **Backend endpoint gap discovered during Bagian 3 investigation, relevant here too:** `tickets.controller.ts` locks `updateStatus/updatePriority/updateCategory/updateDevice/assignTicket/bulkUpdate/mergeTickets` to `@Roles(UserRole.ADMIN, UserRole.AGENT)` only (`:211-315`) — `AGENT_OPERATIONAL_SUPPORT` is currently unable to call any of these regardless of preset/pageAccess, because `RolesGuard` is a hard allowlist unrelated to the preset system. **This must be fixed as part of Bagian 2** (not just Bagian 3) for "preset baru khusus operational support... sama seperti agent yang sekarang" to actually hold true in practice: add `UserRole.AGENT_OPERATIONAL_SUPPORT` to the `@Roles(...)` list on all seven endpoints. (`UserRole.AGENT_ORACLE` is added to the same lists in Bagian 3, scoped by the object-level Oracle checks described there.)

### B2.4 — Fix "No Preset" display / auto-assign preset on provisioning

**Current state:** two provisioning paths never set `appliedPresetId`:
- Admin "Add User" flow (`user-crud.service.ts:161-213`) — `appliedPresetId: dto.presetId` (`:181`), but `dto.presetId` is optional and the frontend form doesn't reliably populate it.
- HRIS provisioning (`hris-sync.service.ts:85-106` `provisionEmployee`, `:123-149` `provisionEmployeeFromSiteMap`) — constructs the user with no `appliedPresetId` field at all.

Result: `PresetDropdown.tsx:87` shows `'No Preset'` for every HRIS-synced user and any admin-created user whose form omitted a preset.

**Fix:**
- Add a shared helper `resolveDefaultPresetId(role: UserRole): Promise<string | null>` in `PermissionsService` — looks up the matching system preset by name for the given role: `USER` → `User` preset, `AGENT`/`AGENT_ADMIN` → `Agent` preset (existing behavior, matches how these two roles are already grouped together in `ticket-query.service.ts`'s `AGENT_ROLES_NON_ORACLE`), `AGENT_OPERATIONAL_SUPPORT` → the new `Agent Operational Support` preset (B2.3), `AGENT_ORACLE` → the new `Agent Oracle` preset (Bagian 3), `MANAGER` → `Manager` preset, `ADMIN` → `Admin` preset.
- `user-crud.service.ts createUser`: if `dto.presetId` is not provided, call `resolveDefaultPresetId(dto.role)` and use that as `appliedPresetId`.
- `hris-sync.service.ts` `provisionEmployee`/`provisionEmployeeFromSiteMap`: after resolving `role` via `resolveRole(...)`, call the same helper and set `appliedPresetId` on the created user.
- **Backfill for existing users:** one-time script/migration — for every existing user with `appliedPresetId IS NULL`, set it via `resolveDefaultPresetId(user.role)`. This directly fixes "masih no preset semua" for the current user base and is also the mechanism that makes B2.2's Zoom-disable apply retroactively to existing USER accounts.

---

## Bagian 3: `AGENT_ORACLE` Access Scoping

### Problem
`AGENT_ORACLE` should only be able to see Oracle/K2 ticketing + Notifications; every other page/route should be closed. Currently:
- Login (`BentoLoginPage.tsx:10` `DASHBOARD_ROLES`) and `RoleBasedRedirect` (`AppRoutes.tsx`) send `AGENT_ORACLE` to `/dashboard`, a page it shouldn't see.
- Sidebar fallback (`BentoSidebar.tsx:295`) lists 11 pages for `AGENT_ORACLE` — only used when the preset/pageAccess lookup fails, but currently far too permissive as a fallback.
- No `oracle_k2_tickets` page key exists in `permissions.service.ts` — the Oracle route is protected only by `allowedRoles`, not the `requiredPageAccess` system the rest of the app uses.
- Route audit of `AppRoutes.tsx` (full inventory): all routes except `tickets/list` (`:177`), `tickets/:id` (`:179`), and `tickets/create` (`:180`) already use `requiredPageAccess` or `allowedRoles={['ADMIN']}` — meaning once a correctly-scoped Oracle preset exists and is applied, they're automatically closed to `AGENT_ORACLE` with no further change. Only those three routes need explicit new handling, because they serve mixed content (any ticket regardless of category) rather than a single static page.
- Backend object-level gaps (mixed ticket content means frontend route guards alone can't fully close these three routes):
  - `ticket-query.service.ts findOne()` (`:380+`) — no role param, no Oracle filter.
  - `ticket-update.service.ts cancelTicket()` (`:327+`) — no Oracle-category check (unlike `assignTicket()`, `:229-325`, which already has one).
  - `ticket-messaging.service.ts getMessagesPaginated()` (`:48-91`) and `replyToTicket()` (sig at `:94`) — no Oracle-category check.
  - `tickets.controller.ts createTicket()` (`:57-75`) — no restriction on `category`/`ticketType` relative to caller's role.
  - `tickets.controller.ts` update/assign/bulk/merge endpoints (`:211-315`) — `@Roles(ADMIN, AGENT)` only, excludes `AGENT_ORACLE` entirely today (same underlying issue as B2.3's Operational Support finding).
- `BentoCreateTicketPage.tsx` selection screen (`:340-465`) renders all 5 ticket-type cards with no role-based filtering — `AGENT_ORACLE` reaching `/tickets/create` without a `?type=` query param sees Service/Hardware/Lost-Item/Access-Request cards it shouldn't.

### Fix

**1. Login/redirect:** `BentoLoginPage.tsx` — special-case `AGENT_ORACLE` to navigate to `/tickets/oracle-k2` instead of `/dashboard`. Apply the same special case in `RoleBasedRedirect` (`AppRoutes.tsx`).

**2. Sidebar fallback:** `BentoSidebar.tsx:295` — shrink `roleDefaults.AGENT_ORACLE` to `['oracle_k2_tickets', 'notifications']`.

**3. New page key:** add `oracle_k2_tickets` to `permissions.service.ts` (new `PageDefinition`, `roles: ['AGENT_ORACLE', 'ADMIN']`). Add it to the `AGENT_ORACLE`-targeted preset's `pageAccess` (new preset, see below) alongside `notifications: true`. Wire `requiredPageAccess="oracle_k2_tickets"` onto the `tickets/oracle-k2` route in `AppRoutes.tsx:178`, in addition to (not replacing) the existing `allowedRoles` check.

**4. New `AGENT_ORACLE` system preset:** add to `DEFAULT_PRESETS`, `pageAccess: { oracle_k2_tickets: true, notifications: true }` (all other keys absent/false). This is what actually closes every other page for `AGENT_ORACLE` once applied via the same auto-assign mechanism as B2.4.

**5. Three mixed-content routes** (`tickets/list`, `tickets/:id`, `tickets/create`):
- `tickets/list`: add a frontend redirect — if `user.role === 'AGENT_ORACLE'`, redirect to `/tickets/oracle-k2` instead of rendering the general list.
- `tickets/:id`: no static page-key gate possible (any ticket ID, any category). Rely on backend object-level authorization (#6 below) to 403/404; frontend shows a "not found" style empty state on 403, consistent with how the app already treats not-found tickets.
- `tickets/create`: fix at the component level, see #7 below.

**6. Backend object-level Oracle authorization** — generalize the existing `isOracleTicket` pattern from `assignTicket()` (`ticket-update.service.ts:229-325`: `ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST'`):
- `ticket-query.service.ts findOne(id, role)` — add `role` param, throw `ForbiddenException`/`NotFoundException` if `role === AGENT_ORACLE` and ticket is not Oracle, or if `isNonOracleAgent(role)` and ticket *is* Oracle (mirrors existing `applyOracleFilter` used in list endpoints).
- `ticket-update.service.ts cancelTicket()` — add the same `isOracleTicket` check used in `assignTicket()`.
- `ticket-messaging.service.ts getMessagesPaginated()` / `replyToTicket()` — add `role` param + same check.
- `tickets.controller.ts` — add `UserRole.AGENT_OPERATIONAL_SUPPORT` (per B2.3) and `UserRole.AGENT_ORACLE` to the `@Roles(...)` list on `updateStatus/updatePriority/updateCategory/updateDevice/assignTicket/bulkUpdate/mergeTickets` (`:211-315`); each underlying service method gets the `isOracleTicket` check so `AGENT_ORACLE` can only act on Oracle tickets and `AGENT`/`AGENT_OPERATIONAL_SUPPORT` only on non-Oracle ones (matching `assignTicket`'s existing precedent exactly).

**7. Create-ticket page:**
- `BentoCreateTicketPage.tsx` — when `user.role === 'AGENT_ORACLE'`, the `type === 'none'` selection screen (`:340-465`) renders only the Oracle/K2 card (or the page skips straight to the Oracle form, matching the existing `?type=oracle-request` deep-link behavior already used by `BentoOracleK2TicketsPage.tsx`'s Create button).
- `tickets.controller.ts createTicket()` — one-directional guard: if `req.user.role === 'AGENT_ORACLE'` and `dto.category !== 'ORACLE_REQUEST' && dto.ticketType !== 'ORACLE_REQUEST'`, throw `ForbiddenException`. Other roles are **not** restricted from creating Oracle-category tickets — that's the normal path for a regular user requesting Oracle/K2 access, which then queues to `AGENT_ORACLE`. This matches "bisa buat juga" (confirms `AGENT_ORACLE` can create Oracle tickets) without over-restricting other roles, which was never requested.

### Out of scope / excluded
- `CreateTicketDialog.tsx` / `AppSidebar.tsx` / `MainLayout.tsx` — grep confirms `AppRoutes.tsx` only renders `BentoLayout`/`BentoSidebar`, not `MainLayout`/`AppSidebar`. Treated as unused legacy code and excluded from this work. If some other entry point is later found to render `MainLayout`, this exclusion should be revisited.

---

## Cross-cutting note

B2.3's and B3's controller `@Roles(...)` fix (`tickets.controller.ts:211-315`) is a single shared change — implement once, covering both `AGENT_OPERATIONAL_SUPPORT` (open access, mirroring `AGENT`) and `AGENT_ORACLE` (Oracle-scoped access via the `isOracleTicket` checks). Don't implement it twice across the two plan items.

## Testing
- Backend: unit tests on `isOracleTicket`-style checks in `findOne`, `cancelTicket`, `getMessagesPaginated`, `createTicket` for all four relevant roles (`AGENT`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ORACLE`, `ADMIN`) × both ticket categories (Oracle, non-Oracle).
- Backend: `deletePreset` still blocks `isSystem`, `updatePreset` allows editing `isSystem` presets.
- Backend: new-user creation (both admin-created and HRIS-provisioned) results in non-null `appliedPresetId` matching the resolved default for the role.
- Frontend: manual check — `AGENT_ORACLE` login lands on `/tickets/oracle-k2`; sidebar shows only Oracle K2 + Notifications; `/tickets/create` shows only the Oracle card; visiting `/dashboard`, `/hardware-requests`, etc. directly redirects/blocks.
- Frontend: Agents page — role-pill counts, stat cards, and site tabs agree with each other under an active search query and across multiple pages.
