# Oracle K2 Request Tickets Page Design

## Goal

Provide a dedicated **Oracle K2 Request** page (`/tickets/oracle-k2`) that strictly displays and handles only tickets where `category = 'ORACLE_REQUEST' OR ticketType = 'ORACLE_REQUEST'`. The page is visible only to users with role `AGENT_ORACLE` (primary audience) and `ADMIN` (oversight). Non-`AGENT_ORACLE` users cannot claim, assign, or interact with these tickets in any way that would change their state.

The purpose is to **separate the Oracle/K2 ticket queue from the regular ticket queue** so agents handling Oracle/K2 requests (who serve a different business purpose) have a focused workspace that does not visually or operationally interleave with the regular agent ticket list.

## Background

The iDesk ticketing system already has:

- A `UserRole` enum (`apps/backend/src/modules/users/enums/user-role.enum.ts`) with `AGENT_ORACLE`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT`, `AGENT_ADMIN`, `ADMIN`, `USER`, `MANAGER`.
- A `Ticket` entity with `category` and `ticketType` columns that can carry the value `'ORACLE_REQUEST'`.
- A priority `ORACLE_REQUEST` in `apps/frontend/src/lib/constants/ticket.constants.ts` (label "Oracle/K2").
- A `ticket-query.service` with helper `applyOracleFilter()` that already scopes ticket queries by role (non-Oracle agents never see Oracle tickets, `AGENT_ORACLE` only sees Oracle tickets, `ADMIN` sees everything).
- A reusable list page `BentoTicketListPage` (752 lines) with stats, sort, filter, pagination, bulk actions, virtualized list, and socket-driven live updates.
- A `BentoSidebar` (`apps/frontend/src/components/layout/BentoSidebar.tsx`) that drives per-role navigation via an `accessControl` map keyed by role.

Currently there is no separate UI surface for Oracle/K2 tickets. The same `BentoTicketListPage` is used by every agent, and the Oracle/K2 filter is invisible. Agents must rely on URL query params or implicit role-based filtering, which is fragile and unclear.

## Non-Goals (YAGNI)

- No new ticket creation form for Oracle/K2 — `BentoCreateTicketPage` already supports `category: 'ORACLE_REQUEST'` (clients/agents pick that category at creation).
- No rework of the auto-assignment logic — `ticket-create.service.ts:175` already bypasses auto-assignment for Oracle tickets on purpose and they stay unassigned for Oracle agents to claim.
- No new status workflow for Oracle/K2 — uses the standard `TODO / IN_PROGRESS / WAITING_VENDOR / RESOLVED / CANCELLED`.
- No Kanban board variant for this page — out of scope; user explicitly chose list/table view.
- No multi-tenant scoping change — site filter behaviour matches the existing ticket list page.
- No real-time notification routing changes — existing socket events continue to drive both pages.

## Proposed Changes

### Backend

**1. Extend `PaginationDto` with optional `scope` query param** — `apps/backend/src/modules/ticketing/dto/pagination.dto.ts`

- Add `@IsOptional() @IsIn(['oracle']) scope?: 'oracle'` (string literal union kept narrow on purpose).
- Document: when `scope=oracle`, the response is restricted to tickets where `category = 'ORACLE_REQUEST' OR ticketType = 'ORACLE_REQUEST'`, regardless of caller role (the controller restricts access by role, not by scope).

**2. `ticket-query.service.findAllPaginated`** — `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`

- After applying `applyOracleFilter(qb, role)`, if `pagination.scope === 'oracle'`, add:
  ```ts
  qb.andWhere('(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory)', ORACLE_FILTER_PARAMS);
  ```
- Reuse the existing `ORACLE_FILTER_PARAMS` constant — no new constants.
- For `ADMIN` callers without `scope=oracle`, do nothing extra (admin continues to see everything). With `scope=oracle`, admin sees only Oracle/K2 tickets (intentional — that's the page's contract).

**3. `TicketsController.findAllPaginated`** — `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts`

- Add `@Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE)` decorator on the `findAllPaginated` method **only when the request has `scope=oracle`**. Because the existing `RolesGuard` evaluates statically per route, this is solved by adding a **new dedicated endpoint**:
  - `GET /tickets/paginated?scope=oracle` → routed to `findAllPaginated` with role guard `@Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE)`.
  - The current `GET /tickets/paginated` (no scope) keeps its existing `@Roles` behaviour and is unchanged.
- The simplest mechanical change: introduce a sibling handler `findAllPaginatedOracle` that delegates to `ticketQueryService.findAllPaginated(..., { scope: 'oracle' })` and decorate it with `@Get('paginated/oracle') @Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE)`. The frontend calls `/tickets/paginated/oracle` and never has to send `scope=...`. This keeps the existing DTO untouched and avoids dynamic role guards.

**4. `assignTicket` enforcement** — `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:217-235`

- In `assignTicket()`, after fetching the ticket, check:
  ```ts
  const isOracleTicket = ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST';
  if (isOracleTicket && assignee.role !== UserRole.AGENT_ORACLE && assignee.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only AGENT_ORACLE or ADMIN can be assigned to Oracle/K2 tickets');
  }
  ```
- The existing validation block (line 224-234) that restricts assignees to operational support / oracle / admin / agent / admin is preserved. The new check **tightens** the rule for Oracle/K2 tickets.

**5. No DB migration** — the schema already supports `category` and `ticketType` as freeform strings.

### Frontend

**1. New page** — `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`

- Reuses components from `BentoTicketListPage`: `StatsCard`, `SortableHeader`, `TicketListRow`, `VirtualizedTicketList`, `TicketListPagination`, `BulkAssignDialog`, `TicketListSkeleton`, `TicketBoardErrorBoundary`.
- Differences from `BentoTicketListPage`:
  - No `priority` filter UI (locked, always shows Oracle priority badge styling).
  - No `category` filter UI.
  - Search box is included (reuses the same `useDebounce` + filter logic as `BentoTicketListPage`).
  - Stats cards show: Open, In Progress, Waiting Vendor, Resolved (same as existing list).
  - API call: `api.get('/tickets/paginated/oracle', { params: { page, limit, sortBy, sortOrder, search } })`.
  - Page title/header text: "Oracle K2 Request".
- No new hooks for filtering — the backend already filters by `category='ORACLE_REQUEST' OR ticketType='ORACLE_REQUEST'` so the frontend never sends those params.
- Live updates: register a `useTicketListSocket` callback identical to `BentoTicketListPage` (the same socket event family `dashboard:stats:update` / `ticket:updated` already refreshes both pages).

**2. New hook** — `apps/frontend/src/features/ticket-board/hooks/useOracleK2Tickets.ts`

- Thin wrapper around `useQuery` calling `/tickets/paginated/oracle` with page/limit/sort/search.
- Returns `{ data, isLoading, isError, refetch }` and exposes `localPaginationMeta`.
- Keeps the query key stable: `['tickets', 'oracle-k2', page, limit, sortBy, sortOrder, search]`.

**3. Route** — `apps/frontend/src/routes/AppRoutes.tsx`

- Add lazy import:
  ```ts
  const BentoOracleK2TicketsPage = lazy(() => import('../features/ticket-board/pages/BentoOracleK2TicketsPage').then(m => ({ default: m.BentoOracleK2TicketsPage })));
  ```
- Add inside the Admin/Agent portal group:
  ```tsx
  <Route path="tickets/oracle-k2" element={<LazyRoute component={BentoOracleK2TicketsPage} featureName="Oracle K2 Request" allowedRoles={['AGENT_ORACLE', 'ADMIN']} />} />
  ```
- Add `ROUTES.TICKETS.ORACLE_K2 = '/tickets/oracle-k2'` to `apps/frontend/src/config/routes.ts`.
- Add `"Oracle K2 Request"` to `ROUTE_NAMES` map for breadcrumb support.

**4. Sidebar nav** — `apps/frontend/src/components/layout/BentoSidebar.tsx`

- Add a new entry to the `Request Center` group:
  ```ts
  { key: 'oracle_k2_tickets', icon: Database, label: 'Oracle K2 Request', path: '/tickets/oracle-k2' }
  ```
- Extend `accessControl` map:
  ```ts
  AGENT_ORACLE: [...existing, 'oracle_k2_tickets'],
  ADMIN: [...existing, 'oracle_k2_tickets'],
  ```
- Other roles (`AGENT`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ADMIN`, `MANAGER`, `USER`) do not get this key, so the nav item does not render for them.

**5. Bulk action button on Oracle/K2 page** — same as `BentoTicketListPage` `BulkAssignDialog`, but pre-filtered to only show `AGENT_ORACLE` users in the assignee dropdown. Implemented by adding a `restrictRoles={['AGENT_ORACLE']}` prop to the dialog (small targeted change to `BulkAssignDialog`) OR by adding a tiny new variant `OracleK2BulkAssignDialog` if we want zero risk to the existing dialog. Default choice: extend `BulkAssignDialog` with an optional `restrictRoles` prop and pass it.

**6. Tests**

- Smoke test: `apps/frontend/src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx` (mirroring the existing `BentoAdminAgentsPage.smoke.test.tsx` pattern) — render the page, assert header text "Oracle K2 Request", assert the request URL is `/tickets/paginated/oracle`.
- Backend unit test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts` (if absent, create) — verify `findAllPaginated` with `scope='oracle'` returns only Oracle/K2 tickets regardless of role.
- Backend unit test for `assignTicket`: add a case asserting `ForbiddenException` is thrown when a non-`AGENT_ORACLE` user is assigned to an Oracle/K2 ticket.

## Data Flow

1. `AGENT_ORACLE` (or `ADMIN`) logs in and navigates to `/tickets/oracle-k2` (via sidebar nav or direct URL).
2. The `LazyRoute` wrapper checks `allowedRoles` against the auth store and either renders the page or redirects to `/unauthorized`.
3. `BentoOracleK2TicketsPage` mounts → `useOracleK2Tickets` fires `GET /tickets/paginated/oracle?page=1&limit=50&sortBy=createdAt&sortOrder=DESC`.
4. `RolesGuard` on the controller allows the request (role is `AGENT_ORACLE` or `ADMIN`).
5. `TicketQueryService.findAllPaginated` applies the Oracle filter to the query builder — result is paginated Oracle/K2 tickets only.
6. UI renders stats cards and a virtualized list of ticket rows.
7. User searches → debounced 300ms → query refetches with `search` param.
8. User clicks "Claim" on a ticket → `PATCH /tickets/:id/assign` body `{ assigneeId: self.id }`.
9. Backend `assignTicket` checks: ticket is Oracle/K2 → assignee must be `AGENT_ORACLE` or `ADMIN` → save and emit `ticket.assigned` event.
10. Socket event triggers a refetch on both `BentoOracleK2TicketsPage` and `BentoTicketListPage` (live update).
11. Non-`AGENT_ORACLE` user attempting the same `PATCH` receives `403 Forbidden` with message "Only AGENT_ORACLE or ADMIN can be assigned to Oracle/K2 tickets".

## Error Handling

- 403 from `/tickets/paginated/oracle` (wrong role) → `LazyRoute` redirects to `/unauthorized`.
- 403 from `assign` (non-AGENT_ORACLE claiming Oracle ticket) → toast: "Hanya Agent Oracle yang bisa claim tiket Oracle/K2".
- 401 → standard auth refresh / redirect to `/login`.
- Empty result set → empty state with `Inbox` icon and message "No Oracle/K2 tickets in this view".
- Network failure → toast "Gagal memuat tiket Oracle/K2" + retry button.

## Testing

- **Backend unit:** `ticket-query.service.spec.ts` — new test `findAllPaginated with scope=oracle returns only Oracle/K2 tickets`.
- **Backend unit:** `ticket-update.service.spec.ts` — new test `assignTicket throws ForbiddenException when non-AGENT_ORACLE assigned to Oracle/K2 ticket`.
- **Backend integration (smoke):** `tickets.controller.spec.ts` — verify `GET /tickets/paginated/oracle` returns 403 for `AGENT` role and 200 for `AGENT_ORACLE`/`ADMIN` roles.
- **Frontend smoke:** `BentoOracleK2TicketsPage.smoke.test.tsx` — page renders, header reads "Oracle K2 Request", API called with `/tickets/paginated/oracle`.
- **Frontend component:** test that the sidebar nav entry renders for `AGENT_ORACLE` and `ADMIN` but not for other roles.
- **Manual E2E:** `AGENT_ORACLE` login → see Oracle K2 Request nav → click → see only Oracle tickets → claim one → success. `AGENT` login → nav item absent → direct URL `/tickets/oracle-k2` → redirect to `/unauthorized`.

## Migration & Rollout

- No DB migration. No data backfill.
- Feature is purely additive: new page, new endpoint, new sidebar entry. No existing endpoint contract changes.
- Deploy order: backend first (new endpoint, new enforcement), then frontend (new page, new nav). If frontend ships first, `GET /tickets/paginated/oracle` returns 404 and the page shows an empty/error state — acceptable for one release window.
- Rollback: revert the frontend commit to hide the page; the backend enforcement is a strictness tightening and can remain (it only blocks invalid assignments, never valid ones).
