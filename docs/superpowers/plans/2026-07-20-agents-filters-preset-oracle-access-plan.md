# Agents Filters, Presets & Oracle Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agents-page counts use one filter scope, make system presets editable but undeletable, provision every user with a role-appropriate preset, and restrict `AGENT_ORACLE` to Oracle/K2 ticket work plus notifications.

**Architecture:** One plan covers all three approved parts because preset assignment is prerequisite for route scoping, and ticket controller role changes are shared by Operational Support and Oracle agents. Backend keeps page access and object-level ticket access separate: preset/page-access controls navigation; a shared Oracle-ticket helper protects every mixed-ticket API action. Agent-page counters are calculated server-side from same filter predicates as table rows.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL JSONB, Jest, React 19, React Router, TanStack Query v5, Vitest.

## Global Constraints

- Preserve existing dirty working-tree files. Stage only files listed by each task.
- No dependency additions.
- All external request input remains class-validator validated; do not trust frontend route or sidebar hiding for access control.
- `ADMIN` keeps existing unrestricted access.
- System presets are editable but backend deletion remains blocked with HTTP 403.
- `USER` default preset must have `zoom_calendar: false`; `USER_ZOOM` is selectable alternative with it enabled.
- `AGENT_OPERATIONAL_SUPPORT` mirrors `AGENT` ticket-management access.
- `AGENT_ORACLE` may create, view, reply to, update, assign, cancel, bulk-update, and merge Oracle/K2 tickets only; it may access Notifications; every other page is denied or redirected.
- Preserve ordinary `USER` ability to create Oracle/K2 requests.
- Do not weaken existing Oracle assignment rule: Oracle tickets may be assigned only to `AGENT_ORACLE` or `ADMIN`.

---

## File Structure

### Backend

- Modify: `apps/backend/src/modules/users/user-crud.service.ts` — share list filters between paginated rows, role counts, and performance stats; apply requested/default preset through `PermissionsService`.
- Modify: `apps/backend/src/modules/users/users.controller.ts` — accept and forward stats filters.
- Modify: `apps/backend/src/modules/users/dto/user-pagination.dto.ts` — reuse validated filters for stats endpoint.
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts` — seed seven system presets, resolve a role’s default preset, and return HTTP 403 for system-preset deletion.
- Modify: `apps/backend/src/modules/permissions/dto/create-preset.dto.ts` — validate all page-access keys from the shared key list, including `oracle_k2_tickets`.
- Modify: `apps/backend/src/modules/permissions/entities/permission-preset.entity.ts` — no schema change; retain four-value `PresetTargetRole` for UI grouping only.
- Modify: `apps/backend/src/modules/permissions/permissions.module.ts` — no change expected; it already exports `PermissionsService`.
- Modify: `apps/backend/src/modules/hris-gateway/hris-gateway.module.ts` — import `PermissionsModule` so HRIS provisioning can apply presets.
- Modify: `apps/backend/src/modules/hris-gateway/hris-sync.service.ts` — inject `PermissionsService`; apply resolved default after each new HRIS user is saved.
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts` — throw `ForbiddenException` for system-preset deletion.
- Create: `apps/backend/src/migrations/1784505600000-SeedRoleScopedPresets.ts` — immediately disable User Zoom, seed/select role presets, and backfill users missing `appliedPresetId`/`appliedPresetName` with SQL.
- Modify: `apps/backend/src/shared/core/types/page-access.types.ts` — add `oracle_k2_tickets` to validated page keys.
- Modify: `apps/backend/src/shared/core/guards/page-access.guard.ts` — use Oracle-only fallback and User Zoom-disabled fallback when preset is absent.
- Create: `apps/backend/src/modules/ticketing/services/ticket-oracle-access.ts` — single category/type Oracle predicate and role assertion reused by query, message, update, merge, and create services.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` — use shared predicate in list queries and enforce it in `findOne`.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts` — enforce object access before returning messages or writing replies.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts` — enforce object access for update, assign, cancel, and bulk operations.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts` — enforce object access for primary and secondary tickets.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-create.service.ts` — enforce Oracle-only creation for `AGENT_ORACLE` using persisted caller role.
- Modify: `apps/backend/src/modules/ticketing/dto/create-ticket.dto.ts` — validate optional `ticketType` appended by Oracle create form.
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` — forward role to reads; expose ticket-management endpoints to Operational Support and Oracle roles; preserve service-level object checks.

### Frontend

- Modify: `apps/frontend/src/types/admin.types.ts` — declare `PaginationMeta.roleCounts`.
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` — include site/role/search in stats query and remove search-blind client re-filtering.
- Modify: `apps/frontend/src/features/admin/components/agent-management/AgentFiltersToolbar.tsx` — render server role counts, not page slice counts.
- Modify: `apps/frontend/src/features/admin/components/agent-management/AgentStatsDashboard.tsx` — consume same server-scoped dashboard values.
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx` — remove system read-only restrictions but retain informational system badge and hidden Delete action.
- Modify: `apps/frontend/src/features/admin/components/AddUserDialog.tsx` — map Agent subroles to AGENT-targeted presets for useful default selection; backend remains authoritative.
- Modify: `apps/frontend/src/components/auth/ProtectedRoute.tsx` — enforce both page access and allowed roles when both props are passed.
- Modify: `apps/frontend/src/routes/AppRoutes.tsx` — Oracle login fallback, dashboard/kanban access guards, Oracle route page key, and general-list redirect wrapper.
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` — send `AGENT_ORACLE` directly to `/tickets/oracle-k2`.
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx` — fallback menu for `AGENT_ORACLE` contains only Oracle/K2 and Notifications.
- Modify: `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx` — force Oracle type for Oracle agents; show only Oracle card; route Operational Support to agent list after creation.

### Tests

- Create: `apps/backend/src/modules/users/user-crud.service.pagination.spec.ts` — role-count/filter query contract and default preset application for admin-created user.
- Create: `apps/backend/src/modules/permissions/permissions.service.spec.ts` — role-to-default mapping, system preset edit path, and forbidden system deletion.
- Create: `apps/backend/src/modules/hris-gateway/hris-sync.service.spec.ts` — just-in-time and mass-sync provisioning apply role default.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts` — Oracle/non-Oracle detail access matrix.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts` — Oracle access for cancel, update, assign, and bulk paths.
- Create: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts` — block cross-queue message reads/replies.
- Create: `apps/backend/src/modules/ticketing/services/ticket-create.service.spec.ts` — only `AGENT_ORACLE` non-Oracle creation is rejected.
- Create: `apps/backend/src/modules/ticketing/services/ticket-oracle-access.spec.ts` — complete role × category predicate matrix.
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.spec.ts` — controller forwards `req.user.role` and reaches newly permitted service APIs.
- Create: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.test.tsx` — queue assignment uses live bulk-update API and valid assignee IDs.
- Modify: `apps/frontend/src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx` — server role counts and filtered stats request regression.
- Modify: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx` — Oracle login navigation regression.

## Shared Interfaces

```ts
// apps/backend/src/modules/users/user-crud.service.ts
interface UserListFilters {
  page?: number;
  limit?: number;
  search?: string;
  siteCode?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface UserListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  roleCounts: Partial<Record<UserRole, number>>;
  siteCounts: Record<string, number>;
}

async findAll(options: UserListFilters): Promise<{ data: User[]; meta: UserListMeta }>;
async getAgentStats(options: Pick<UserListFilters, 'search' | 'siteCode' | 'role'>): Promise<any>;
```

```ts
// apps/backend/src/modules/permissions/permissions.service.ts
async resolveDefaultPresetId(role: UserRole): Promise<string | null>;
async applyPresetToUser(userId: string, presetId: string): Promise<{ applied: boolean; presetName: string }>;
```

```ts
// apps/backend/src/modules/ticketing/services/ticket-oracle-access.ts
export function isOracleTicket(ticket: Pick<Ticket, 'category' | 'ticketType'>): boolean;
export function isNonOracleAgent(role: UserRole): boolean;
export function assertTicketRoleAccess(
  ticket: Pick<Ticket, 'category' | 'ticketType'>,
  role: UserRole,
): void;
```

```ts
// changed ticket service interfaces
async findOne(id: string, role: UserRole): Promise<Ticket & { slaTarget: Date | null }>;
async getMessages(ticketId: string, role: UserRole): Promise<TicketMessage[]>;
async getMessagesPaginated(ticketId: string, page: number, limit: number, role: UserRole): Promise<{ data: TicketMessage[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }>;
async replyToTicket(ticketId: string, userId: string, content: string, files?: string[], mentionedUserIds?: string[], isInternal?: boolean): Promise<TicketMessage>;
```

### Task 1: Return Server-Scoped Counts for Agents Page

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:72-141,331-463`
- Modify: `apps/backend/src/modules/users/users.controller.ts:113-120,138-152`
- Modify: `apps/backend/src/modules/users/dto/user-pagination.dto.ts:5-45`
- Create: `apps/backend/src/modules/users/user-crud.service.pagination.spec.ts`

**Interfaces:**
- Consumes: `UserPaginationDto` fields `search?: string`, `siteCode?: string`, `role?: string`.
- Produces: `meta.roleCounts: Partial<Record<UserRole, number>>` and `getAgentStats({ search, siteCode, role })`.

- [ ] **Step 1: Write failing service tests for filtered count contracts**

```ts
it('returns all role counts for search/site scope before applying selected role', async () => {
  await service.findAll({ search: 'budi', siteCode: 'JKT', role: UserRole.AGENT });

  expect(roleCountsQb.andWhere).toHaveBeenCalledWith(
    '(user.fullName ILIKE :search OR user.email ILIKE :search)',
    { search: '%budi%' },
  );
  expect(roleCountsQb.andWhere).toHaveBeenCalledWith('site.code = :siteCode', { siteCode: 'JKT' });
  expect(roleCountsQb.andWhere).not.toHaveBeenCalledWith('user.role = :role', { role: UserRole.AGENT });
  expect(result.meta.roleCounts).toEqual({ AGENT: 3, USER: 7 });
  expect(result.meta.siteCounts).toEqual({ JKT: 6, SMG: 4 });
});

it('uses search, siteCode, and role for agent stats', async () => {
  await service.getAgentStats({ search: 'budi', siteCode: 'JKT', role: UserRole.AGENT_OPERATIONAL_SUPPORT });

  expect(agentQb.andWhere).toHaveBeenCalledWith(
    '(user.fullName ILIKE :search OR user.email ILIKE :search)',
    { search: '%budi%' },
  );
  expect(agentQb.andWhere).toHaveBeenCalledWith('site.code = :siteCode', { siteCode: 'JKT' });
  expect(agentQb.andWhere).toHaveBeenCalledWith('user.role = :role', { role: UserRole.AGENT_OPERATIONAL_SUPPORT });
});
```

- [ ] **Step 2: Run backend test and verify failure**

Run: `npm --prefix apps/backend test -- user-crud.service.pagination.spec.ts --runInBand`

Expected: FAIL because `meta.roleCounts` and `getAgentStats(options)` do not exist.

- [ ] **Step 3: Extract one common list-filter function and compute counts before role filter**

In `UserCrudService`, add this private helper above `findAll` and call it for both the paginated list query and stats query:

```ts
private applyUserListFilters(
  qb: import('typeorm').SelectQueryBuilder<User>,
  options: Pick<UserListFilters, 'search' | 'siteCode' | 'role'>,
  includeRole = true,
): void {
  if (options.search) {
    qb.andWhere('(user.fullName ILIKE :search OR user.email ILIKE :search)', {
      search: `%${options.search}%`,
    });
  }
  if (options.siteCode && options.siteCode !== 'ALL') {
    qb.andWhere('site.code = :siteCode', { siteCode: options.siteCode });
  }
  if (includeRole && options.role) {
    qb.andWhere('user.role = :role', { role: options.role });
  }
  qb.andWhere("user.email NOT LIKE :deletedPrefix", { deletedPrefix: 'deleted_%' });
}
```

Build `roleCounts` and `siteCounts` from separate clones before `skip/take`:

```ts
const countQb = this.userRepo
  .createQueryBuilder('user')
  .leftJoin('user.site', 'site');
this.applyUserListFilters(countQb, { search, siteCode, role }, false);

const rawRoleCounts = await countQb.clone()
  .select('user.role', 'role')
  .addSelect('COUNT(*)', 'count')
  .groupBy('user.role')
  .getRawMany<{ role: UserRole; count: string }>();
const roleCounts = Object.fromEntries(
  rawRoleCounts.map(({ role, count }) => [role, Number.parseInt(count, 10)]),
) as Partial<Record<UserRole, number>>;

const siteCountQb = this.userRepo
  .createQueryBuilder('user')
  .leftJoin('user.site', 'site');
this.applyUserListFilters(siteCountQb, { search, siteCode: undefined, role });
const rawSiteCounts = await siteCountQb
  .select('site.code', 'siteCode')
  .addSelect('COUNT(*)', 'count')
  .andWhere('site.code IS NOT NULL')
  .groupBy('site.code')
  .getRawMany<{ siteCode: string; count: string }>();
const siteCounts = Object.fromEntries(
  rawSiteCounts.map(({ siteCode, count }) => [siteCode, Number.parseInt(count, 10)]),
);
```

Return both maps in `meta`. `roleCounts` deliberately excludes selected role predicate so all role pills remain visible. `siteCounts` includes selected role but excludes selected site predicate so every site tab count stays meaningful with current search/role scope.

Remove `getAgentStats()` line `336` role restriction and active-only restriction. Apply same search, site, role, and deleted-email predicates. This makes table totals, role pills, stat cards, and performance panel describe same population; `siteCounts` has explicit server-derived site scope rather than page-local client grouping.

- [ ] **Step 4: Forward validated filters through controller**

```ts
@Get('agents/stats')
async getAgentStats(@Query() query: UserPaginationDto) {
  return this.usersService.getAgentStats({
    search: query.search,
    siteCode: query.siteCode,
    role: query.role,
  });
}
```

Keep `@Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT)` unchanged. Extend Swagger role enum in `UserPaginationDto` and `users.controller.ts` to all seven `UserRole` values; it documents existing accepted strings without changing authorization.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix apps/backend test -- user-crud.service.pagination.spec.ts user-crud.service.hris.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit isolated backend count change**

```bash
git add apps/backend/src/modules/users/user-crud.service.ts apps/backend/src/modules/users/users.controller.ts apps/backend/src/modules/users/dto/user-pagination.dto.ts apps/backend/src/modules/users/user-crud.service.pagination.spec.ts
git commit -m "fix(users): align agents counts with filters"
```

### Task 2: Consume One Agents Filter Scope in Frontend

**Files:**
- Modify: `apps/frontend/src/types/admin.types.ts:66-78`
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx:142-326`
- Modify: `apps/frontend/src/features/admin/components/agent-management/AgentFiltersToolbar.tsx:9-24,130-164`
- Modify: `apps/frontend/src/features/admin/components/agent-management/AgentStatsDashboard.tsx:16-53`
- Modify: `apps/frontend/src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`

**Interfaces:**
- Consumes: `PaginationMeta.roleCounts?: Partial<Record<UserRole, number>>`.
- Produces: role pills, site counts, dashboard cards, and performance panel using server-filtered responses.

- [ ] **Step 1: Write failing UI regression test**

```tsx
it('uses server role counts and forwards current filters to agent stats', async () => {
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.startsWith('/users?')) {
      return Promise.resolve({
        data: {
          data: [],
          meta: {
            total: 10, page: 1, limit: 50, totalPages: 1,
            hasNextPage: false, hasPrevPage: false,
            roleCounts: { AGENT: 2, USER: 8 },
          },
        },
      });
    }
    if (url.startsWith('/users/agents/stats?')) return Promise.resolve({ data: { agents: [] } });
    if (url.startsWith('/sites/active')) return Promise.resolve({ data: [] });
    if (url.startsWith('/permissions')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  renderPage();
  expect(await screen.findByText('2')).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/users/agents/stats?'));
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm --prefix apps/frontend test -- BentoAdminAgentsPage.smoke.test.tsx`

Expected: FAIL because stats call has no query string and role pills inspect page rows.

- [ ] **Step 3: Update shared types and frontend queries**

```ts
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  roleCounts?: Partial<Record<UserRole, number>>;
  siteCounts?: Record<string, number>;
}
```

Replace the `['agent-stats']` query key with:

```ts
queryKey: ['agent-stats', selectedSite, deferredSearchQuery, selectedRole],
queryFn: async () => {
  const params = new URLSearchParams();
  if (selectedSite !== 'ALL') params.set('siteCode', selectedSite);
  if (deferredSearchQuery) params.set('search', deferredSearchQuery);
  if (selectedRole !== 'ALL') params.set('role', selectedRole);
  const res = await api.get(`/users/agents/stats?${params.toString()}`);
  return res.data.agents || [];
},
```

Delete `filteredAgentStats` lines `257-267`; use `agentStats` directly for `dashboardStats`, `displayedAgentStats`, and `AgentPerformancePanel`. Replace local site grouping with `paginationMeta?.siteCounts` and add `ALL: paginationMeta?.total ?? 0`:

```ts
const siteCounts = useMemo(() => ({
  ALL: paginationMeta?.total ?? 0,
  ...(paginationMeta?.siteCounts ?? {}),
}), [paginationMeta]);
```

In `AgentFiltersToolbar`, remove `users` prop. Replace count code with:

```ts
const count = role === 'ALL'
  ? (paginationMeta?.total ?? 0)
  : (paginationMeta?.roleCounts?.[role] ?? 0);
```

Remove `isMultiPage`, `displayCount`, approximation marker, and current-page-only tooltip. In `AgentStatsDashboard`, retain `total ?? dashboardStats.totalAgents`; Active and Resolved already derive from same server-filtered `agentStats` data.

- [ ] **Step 4: Run frontend regression test and typecheck build**

Run: `npm --prefix apps/frontend test -- BentoAdminAgentsPage.smoke.test.tsx && npm --prefix apps/frontend run build`

Expected: PASS and Vite production build succeeds.

- [ ] **Step 5: Commit frontend filter change**

```bash
git add apps/frontend/src/types/admin.types.ts apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx apps/frontend/src/features/admin/components/agent-management/AgentFiltersToolbar.tsx apps/frontend/src/features/admin/components/agent-management/AgentStatsDashboard.tsx apps/frontend/src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx
git commit -m "fix(agents): use server scoped filter counts"
```

### Task 3: Seed and Validate Role-Scoped System Presets

**Files:**
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts:1-11,16-91,145-428,752-865`
- Modify: `apps/backend/src/shared/core/types/page-access.types.ts:7-26`
- Modify: `apps/backend/src/shared/core/guards/page-access.guard.ts:149-228`
- Modify: `apps/backend/src/modules/permissions/dto/create-preset.dto.ts:1-134`
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx:65-85`
- Modify: `apps/backend/src/modules/permissions/__tests__/seed-default-presets.spec.ts`
- Create: `apps/backend/src/modules/permissions/permissions.service.spec.ts`

**Interfaces:**
- Consumes: `UserRole` and `PermissionPreset.name`.
- Produces: `resolveDefaultPresetId(role: UserRole): Promise<string | null>` and page key `oracle_k2_tickets`.

- [ ] **Step 1: Write failing preset/service tests**

```ts
it.each([
  [UserRole.USER, 'User'],
  [UserRole.AGENT, 'Agent'],
  [UserRole.AGENT_ADMIN, 'Agent'],
  [UserRole.AGENT_OPERATIONAL_SUPPORT, 'Agent Operational Support'],
  [UserRole.AGENT_ORACLE, 'Agent Oracle'],
  [UserRole.MANAGER, 'Manager'],
  [UserRole.ADMIN, 'Admin'],
])('resolves %s to %s', async (role, name) => {
  presetRepo.findOne.mockResolvedValue({ id: `preset-${name}`, name });
  await expect(service.resolveDefaultPresetId(role)).resolves.toBe(`preset-${name}`);
});

it('rejects deletion of a system preset with ForbiddenException', async () => {
  presetRepo.findOne.mockResolvedValue({ id: 'system', isSystem: true });
  await expect(service.deletePreset('system')).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm --prefix apps/backend test -- permissions.service.spec.ts --runInBand`

Expected: FAIL because resolver is absent and system delete throws plain `Error`.

- [ ] **Step 3: Preserve system-preset customizations, then add page key and safe fallbacks**

`seedDefaultPresets()` currently overwrites every existing system-preset `pageAccess` value at lines `403-409`. This makes system presets appear editable but resets administrator changes on next Nest boot. Replace that loop with additive-only behavior:

```ts
for (const [key, value] of Object.entries(preset.pageAccess || {})) {
  if (updatedPageAccess[key] === undefined) {
    updatedPageAccess[key] = value;
    modified = true;
  }
}
```

Add regression to `seed-default-presets.spec.ts` before implementation:

```ts
it('preserves an existing system preset pageAccess customization', async () => {
  presetRepo = makeRepoMock([{
    id: 'user-preset', name: 'User', isSystem: true,
    pageAccess: { dashboard: true, tickets: true, zoom_calendar: true },
    permissions: {},
  }]);
  await (svc as any).seedDefaultPresets();
  expect(presetRepo.save).not.toHaveBeenCalledWith(
    expect.objectContaining({ pageAccess: expect.objectContaining({ zoom_calendar: false }) }),
  );
});
```

The explicit User Zoom policy change is handled by Task 5 migration exactly once; fresh installs receive `zoom_calendar: false` from `DEFAULT_PRESETS`. This restores real editable system presets without losing requested policy change for existing User preset.

Add `'oracle_k2_tickets'` to `VALID_PAGE_KEYS`. Keep existing page keys unchanged. In `create-preset.dto.ts`, import `isValidPageKey` from `../../../shared/core/types/page-access.types`, delete its duplicated local `VALID_PAGE_KEYS` constant, and make `IsValidPageAccessConstraint.validate` reject unknown keys:

```ts
for (const [key, value] of Object.entries(pageAccess as Record<string, unknown>)) {
  if (!isValidPageKey(key) || typeof value !== 'boolean') return false;
}
```

Add `ORACLE_PAGES` in `PermissionsService`:

```ts
const ORACLE_PAGES: PageDefinition[] = [
  { key: 'oracle_k2_tickets', name: 'Oracle K2 Request', icon: 'Database', route: '/tickets/oracle-k2', roles: ['AGENT'] },
  { key: 'notifications', name: 'Notifications', icon: 'Bell', route: '/notifications', roles: ['AGENT'] },
];
```

Change `getUserPageAccess` fallback so it does not normalize `AGENT_ORACLE` into regular `AGENT`:

```ts
const role = user.role as UserRole;
if (role === UserRole.AGENT_ORACLE) {
  return Object.fromEntries(ORACLE_PAGES.map((page) => [page.key, true]));
}
const normalizedRole = role.startsWith('AGENT_') ? 'AGENT' : role as PresetTargetRole;
return getDefaultPageAccess(normalizedRole);
```

Mirror Oracle-only fallback in `PageAccessGuard.getDefaultPageAccess`; set `zoom_calendar: false` in User fallback. Do not add a broad Oracle fallback.

Add `'oracle_k2_tickets'` to `DEFAULT_PERMISSION_RESOURCES` in `PresetDrawer` so an admin can customize this page key.

- [ ] **Step 4: Add exact seeded presets and role resolver**

Change existing `User.pageAccess.zoom_calendar` to `false`.

Insert these entries after existing `User`/`Agent` entries. Shift `Agent`, `Manager`, and `Admin` `sortOrder` values to `3`, `6`, and `7` so all names have deterministic order.

```ts
{
  name: 'User Zoom',
  description: 'Standard user with Zoom Calendar access.',
  sortOrder: 2,
  isSystem: true,
  targetRole: 'USER',
  pageAccess: {
    dashboard: true, tickets: true, zoom_calendar: true, knowledge_base: true,
    notifications: true, hardware_requests: true, eform_access: true, lost_items: true,
  },
  permissions: {
    'ticketing.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'ticketing.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'ticketing.edit': { canView: false, canCreate: false, canEdit: true, canDelete: false },
    'zoom_calendar.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'zoom_calendar.book': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'knowledge_base.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'lost_item.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'access_request.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
},
{
  name: 'Agent Operational Support',
  description: 'Operational support agent. Same page and ticket access as Agent.',
  sortOrder: 4,
  isSystem: true,
  targetRole: 'AGENT',
  pageAccess: {
    dashboard: true, tickets: true, zoom_calendar: true, knowledge_base: true,
    notifications: true, hardware_requests: true, eform_access: true, lost_items: true,
    reports: true, renewal: true,
  },
  permissions: {
    'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.escalate': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'zoom_calendar.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'knowledge_base.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'knowledge_base.edit': { canView: true, canCreate: false, canEdit: true, canDelete: false },
    'reports.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'reports.dashboard': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'access_request.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
    'renewal.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
    'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
},
{
  name: 'Agent Oracle',
  description: 'Oracle/K2 agent. Oracle/K2 ticket queue and notifications only.',
  sortOrder: 5,
  isSystem: true,
  targetRole: 'AGENT',
  pageAccess: { oracle_k2_tickets: true, notifications: true },
  permissions: {
    'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
    'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
},
```

Add resolver near `initializeUserPermissions`:

```ts
async resolveDefaultPresetId(role: UserRole): Promise<string | null> {
  const names: Record<UserRole, string> = {
    [UserRole.USER]: 'User',
    [UserRole.AGENT]: 'Agent',
    [UserRole.AGENT_ADMIN]: 'Agent',
    [UserRole.AGENT_OPERATIONAL_SUPPORT]: 'Agent Operational Support',
    [UserRole.AGENT_ORACLE]: 'Agent Oracle',
    [UserRole.MANAGER]: 'Manager',
    [UserRole.ADMIN]: 'Admin',
  };
  const preset = await this.presetRepo.findOne({
    where: { name: names[role], isSystem: true, isActive: true },
    select: ['id'],
  });
  return preset?.id ?? null;
}
```

Import `ForbiddenException` and replace `throw new Error('Cannot delete system preset')` with:

```ts
throw new ForbiddenException('Cannot delete system preset');
```

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix apps/backend test -- permissions.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit preset seed and resolver contract**

```bash
git add apps/backend/src/modules/permissions/permissions.service.ts apps/backend/src/modules/permissions/dto/create-preset.dto.ts apps/backend/src/modules/permissions/__tests__/seed-default-presets.spec.ts apps/backend/src/shared/core/types/page-access.types.ts apps/backend/src/shared/core/guards/page-access.guard.ts apps/frontend/src/features/admin/components/PresetDrawer.tsx apps/backend/src/modules/permissions/permissions.service.spec.ts
git commit -m "feat(permissions): seed role scoped presets"
```

### Task 4: Make System Presets Editable, Not Deletable

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx:96-132,264-267,396-515`
- Modify: `apps/frontend/src/features/admin/components/AddUserDialog.tsx:148-158`

**Interfaces:**
- Consumes: `PermissionPreset.isSystem`.
- Produces: system-preset Save controls; Delete stays absent; subroles choose AGENT-targeted default preset.

- [ ] **Step 1: Add a failing component-level assertion**

Add a test to the closest preset-management test file, or create `apps/frontend/src/features/admin/components/__tests__/PresetDrawer.test.tsx`:

```tsx
it('allows save but hides delete for a system preset', async () => {
  renderDrawerWithPreset({ id: 'system', name: 'User', isSystem: true, targetRole: 'USER', permissions: {}, pageAccess: {} });

  expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm --prefix apps/frontend test -- PresetDrawer.test.tsx`

Expected: FAIL because system presets hide Save and disable every editor field.

- [ ] **Step 3: Remove read-only conditions only**

Apply these exact replacements:

```tsx
{isSystem && (
  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
    <Lock className="w-3 h-3" />
    System preset
  </span>
)}
{isDirty && (
  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">• Unsaved changes</span>
)}
```

Always render Save:

```tsx
<button
  onClick={() => saveMutation.mutate()}
  disabled={saveMutation.isPending || !isDirty || !draft.name}
  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Save className="w-3.5 h-3.5" />
  {saveMutation.isPending ? 'Saving...' : 'Save'}
</button>
```

Remove only `disabled={isSystem}` from name, target role, description, and `PermissionRow`. Keep condition `!isNew && selectedPreset && !isSystem` around Delete. Keep lock icons as informational labels.

Map Add User role to preset target grouping so UI selects the new presets by name:

```ts
const presetTargetRole = watchedRole?.startsWith('AGENT_') ? 'AGENT' : watchedRole;
const match = presets.find((preset: any) =>
  watchedRole === 'AGENT_ORACLE' ? preset.name === 'Agent Oracle'
    : watchedRole === 'AGENT_OPERATIONAL_SUPPORT' ? preset.name === 'Agent Operational Support'
    : preset.targetRole === presetTargetRole,
);
```

Backend resolver in Task 5 remains source of truth if frontend omits or sends an invalid preset.

- [ ] **Step 4: Run focused frontend test**

Run: `npm --prefix apps/frontend test -- PresetDrawer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit drawer behavior**

```bash
git add apps/frontend/src/features/admin/components/PresetDrawer.tsx apps/frontend/src/features/admin/components/AddUserDialog.tsx apps/frontend/src/features/admin/components/__tests__/PresetDrawer.test.tsx
git commit -m "fix(permissions): allow system preset edits"
```

### Task 5: Apply Presets During Admin and HRIS Provisioning, Then Backfill

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:161-213`
- Modify: `apps/backend/src/modules/hris-gateway/hris-gateway.module.ts:1-16`
- Modify: `apps/backend/src/modules/hris-gateway/hris-sync.service.ts:1-149`
- Create: `apps/backend/src/migrations/1784505600000-SeedRoleScopedPresets.ts`
- Create: `apps/backend/src/modules/hris-gateway/hris-sync.service.spec.ts`
- Modify: `apps/backend/src/modules/users/user-crud.service.pagination.spec.ts`

**Interfaces:**
- Consumes: `PermissionsService.resolveDefaultPresetId(role)` and `PermissionsService.applyPresetToUser(userId, presetId)`.
- Produces: every new user has non-null `appliedPresetId`, matching `appliedPresetName`, and legacy `UserFeaturePermission` rows created by the existing `applyPresetToUser` path.

- [ ] **Step 1: Write failing provisioning tests**

```ts
it('applies resolved default preset when admin does not send presetId', async () => {
  userRepo.findOne.mockResolvedValue(undefined);
  userRepo.create.mockImplementation((value) => value);
  userRepo.save.mockResolvedValue({ id: 'user-1', email: 'new@example.com', fullName: 'New User', role: UserRole.AGENT_ORACLE });
  permissionsService.resolveDefaultPresetId.mockResolvedValue('oracle-preset');

  await service.createUser({ fullName: 'New User', email: 'new@example.com', role: UserRole.AGENT_ORACLE, autoGeneratePassword: true });

  expect(permissionsService.applyPresetToUser).toHaveBeenCalledWith('user-1', 'oracle-preset');
});

it('applies resolved default after HRIS just-in-time provisioning', async () => {
  permissionsService.resolveDefaultPresetId.mockResolvedValue('user-preset');
  await service.provisionEmployee({ nik_hris: '100', nama_karyawan: 'Budi', nama_departemen: 'General' } as HrisEmployee);
  expect(permissionsService.applyPresetToUser).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/backend test -- user-crud.service.pagination.spec.ts hris-sync.service.spec.ts --runInBand`

Expected: FAIL because both flows save users without calling `applyPresetToUser`.

- [ ] **Step 3: Route all new users through existing preset application**

In `createUser`, resolve before `userRepo.create`, preserve explicitly selected `dto.presetId`, save user, then use the existing complete application path:

```ts
const presetId = dto.presetId ?? await this.permissionsService.resolveDefaultPresetId(dto.role);
// create and save user exactly as today, without setting appliedPresetId directly
const savedUser = await this.userRepo.save(user);
if (presetId) {
  await this.permissionsService.applyPresetToUser(savedUser.id, presetId);
  savedUser.appliedPresetId = presetId;
}
```

Do not replace `applyPresetToUser` with direct fields: that method also sets `appliedPresetName`, replaces legacy feature permission rows, clears page-access cache, and notifies the user.

In `HrisGatewayModule`, import `PermissionsModule`:

```ts
imports: [TypeOrmModule.forFeature([User, Site, Department]), PermissionsModule],
```

Inject `PermissionsService` into `HrisSyncService`. In both `provisionEmployee` and `provisionEmployeeFromSiteMap`, compute `const role = resolveRole(employee.nama_departemen)`, save the user, resolve default preset using `role`, then call `applyPresetToUser` if an ID exists. Reuse this local post-save sequence in both methods; keep role/site/department mapping unchanged.

- [ ] **Step 4: Create idempotent data migration**

Create class `SeedRoleScopedPresets1784505600000`. Its `up` must:

1. Run `jsonb_set` against system `User` preset, setting `zoom_calendar` false without discarding any other page keys.
2. Insert missing `User Zoom` by copying existing `User` preset and setting only name, description, sort order, `isDefault = false`, and `pageAccess.zoom_calendar = true`.
3. Insert missing `Agent Operational Support` by copying the existing `Agent` preset and changing only name, description, and sort order.
4. Insert `Agent Oracle` with page access exactly `{"oracle_k2_tickets": true, "notifications": true}` and exact minimal permissions from Task 3.
5. Backfill `users` with null `appliedPresetId` through a `CASE "role"` name mapping. Set both `"appliedPresetId"` and `"appliedPresetName"`; do not alter users with an assigned preset.

Use PostgreSQL idempotency pattern for each insert:

```sql
INSERT INTO "permission_presets" (
  "name", "description", "targetRole", "pageAccess", "permissions",
  "isDefault", "sortOrder", "isActive", "isSystem"
)
SELECT
  'Agent Oracle',
  'Oracle/K2 agent. Oracle/K2 ticket queue and notifications only.',
  'AGENT',
  '{"oracle_k2_tickets": true, "notifications": true}'::jsonb,
  '{"ticketing.view":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.create":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.edit":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.manage":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.assign":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"notifications.view":{"canView":true,"canCreate":false,"canEdit":false,"canDelete":false}}'::jsonb,
  false, 5, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM "permission_presets" WHERE "name" = 'Agent Oracle' AND "isSystem" = true
);
```

`down` reverses only this migration’s new preset rows, then leaves existing user assignments untouched to avoid destructive rollback of live permissions.

`seedDefaultPresets()` becomes additive-only for `pageAccess` in Task 3, preserving permitted system-preset customization. Migration applies requested User Zoom policy once, seeds new role presets, and backfills users independently of Nest bootstrap order.

- [ ] **Step 5: Run provisioning tests and migration check**

Run:

```bash
npm --prefix apps/backend test -- user-crud.service.pagination.spec.ts hris-sync.service.spec.ts --runInBand
npm --prefix apps/backend run typeorm -- migration:show
```

Expected: provisioning tests PASS; migration list contains `SeedRoleScopedPresets1784505600000` as pending before deployment.

- [ ] **Step 6: Commit provisioning and migration**

```bash
git add apps/backend/src/modules/users/user-crud.service.ts apps/backend/src/modules/hris-gateway/hris-gateway.module.ts apps/backend/src/modules/hris-gateway/hris-sync.service.ts apps/backend/src/migrations/1784505600000-SeedRoleScopedPresets.ts apps/backend/src/modules/hris-gateway/hris-sync.service.spec.ts apps/backend/src/modules/users/user-crud.service.pagination.spec.ts
git commit -m "fix(users): apply role defaults during provisioning"
```

### Task 6: Enforce Oracle Navigation and Route Access

**Files:**
- Modify: `apps/frontend/src/components/auth/ProtectedRoute.tsx:18-142`
- Modify: `apps/frontend/src/routes/AppRoutes.tsx:100-180,223,312-313`
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx:10,80-93`
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx:280-303`
- Modify: `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx:63-84,257-329,339-463`
- Modify: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`

**Interfaces:**
- Consumes: `user.role`, `pageAccess.oracle_k2_tickets`, `ProtectedRoute.allowedRoles`, `ProtectedRoute.requiredPageAccess`.
- Produces: Oracle role lands on and can navigate only Oracle queue, Oracle create form, and Notifications.

- [ ] **Step 1: Write failing Oracle login navigation test**

At top of login integration test, mock navigation while preserving `MemoryRouter`:

```tsx
const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

it('redirects AGENT_ORACLE directly to Oracle/K2 queue', async () => {
  mockApi.post.mockResolvedValue({ data: { user: { role: 'AGENT_ORACLE' } } });
  render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('NIK / Email'), 'oracle@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/tickets/oracle-k2'));
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm --prefix apps/frontend test -- BentoLoginPage.integration.test.tsx`

Expected: FAIL because Oracle role currently navigates to `/dashboard`.

- [ ] **Step 3: Fix redirects and route guard composition**

In login handler, put Oracle before `DASHBOARD_ROLES`:

```tsx
if (user.role === 'AGENT_ORACLE') {
  navigate('/tickets/oracle-k2');
} else if (DASHBOARD_ROLES.has(user.role)) {
  navigate('/dashboard');
}
```

In `RoleBasedRedirect`, add before Manager/User branches:

```tsx
if (userRole === 'AGENT_ORACLE') {
  return <Navigate to="/tickets/oracle-k2" replace />;
}
```

Change `getRoleHome` in `ProtectedRoute` similarly so failed page access routes Oracle back to the Oracle queue.

Remove the early success return in page-access section of `ProtectedRoute`:

```tsx
if (!hasPageAccess) {
  return <Navigate to={getRoleHome(user.role)} replace />;
}
// Do not return here. When allowedRoles is also provided, enforce it below.
```

This makes `requiredPageAccess="oracle_k2_tickets"` and `allowedRoles={['AGENT_ORACLE', 'ADMIN']}` an AND, not current accidental page-access-only behavior.

In `AppRoutes`, add `requiredPageAccess="dashboard"` to dashboard and `requiredPageAccess="tickets"` to kanban. Add it alongside existing allowed roles on Oracle queue:

```tsx
<Route path="tickets/oracle-k2" element={<LazyRoute component={BentoOracleK2TicketsPage} featureName="Oracle K2 Request" requiredPageAccess="oracle_k2_tickets" allowedRoles={['AGENT_ORACLE', 'ADMIN']} />} />
```

Do not add a dashboard permission to Agent Oracle preset. Existing ticket list/query endpoints already call `applyOracleFilter(qb, role)` for `AGENT_ORACLE`; this protects any queue statistics they use without granting frontend `/dashboard` access.

Add a tiny `OracleListRedirect` wrapper in `AppRoutes` using `useAuth`; wrap only `tickets/list` so Oracle users redirect before general ticket list mounts:

```tsx
const OracleListRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user?.role === 'AGENT_ORACLE'
    ? <Navigate to="/tickets/oracle-k2" replace />
    : <>{children}</>;
};
```

- [ ] **Step 4: Narrow sidebar and create screen**

Replace fallback exactly:

```ts
AGENT_ORACLE: ['oracle_k2_tickets', 'notifications'],
```

In `BentoCreateTicketPage`, force an Oracle initial type and preserve ordinary selection for every other role:

```tsx
const initialType = user?.role === 'AGENT_ORACLE'
  ? 'oracle-request'
  : (searchParams.get('type') as TicketType) || 'none';
```

For Oracle role, render only the existing Oracle/K2 card in selection screen; do not render service, hardware, lost item, or access cards. Preserve the existing Oracle card JSX and its `setTicketType('oracle-request')` handler. Change successful general-ticket navigation condition to include Operational Support:

```tsx
} else if (['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT'].includes(user?.role || '')) {
  navigate('/tickets/list');
}
```

- [ ] **Step 5: Run frontend test and build**

Run: `npm --prefix apps/frontend test -- BentoLoginPage.integration.test.tsx && npm --prefix apps/frontend run build`

Expected: PASS and production build succeeds.

- [ ] **Step 6: Commit frontend access scope**

```bash
git add apps/frontend/src/components/auth/ProtectedRoute.tsx apps/frontend/src/routes/AppRoutes.tsx apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/components/layout/BentoSidebar.tsx apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx
git commit -m "fix(oracle): scope portal navigation and routes"
```

### Task 7: Create Shared Oracle Ticket Authorization Primitive

**Files:**
- Create: `apps/backend/src/modules/ticketing/services/ticket-oracle-access.ts`
- Create: `apps/backend/src/modules/ticketing/services/ticket-oracle-access.spec.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:1-22,46-77,119-160,380-406`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`

**Interfaces:**
- Produces: `isOracleTicket`, `isNonOracleAgent`, `assertTicketRoleAccess`.
- Consumes: `Ticket.category`, `Ticket.ticketType`, and `UserRole`.

- [ ] **Step 1: Write complete role/category matrix test**

```ts
const oracle = { category: 'ORACLE_REQUEST', ticketType: TicketType.SERVICE } as Ticket;
const standard = { category: 'GENERAL', ticketType: TicketType.SERVICE } as Ticket;

test.each([
  [UserRole.ADMIN, oracle, false],
  [UserRole.ADMIN, standard, false],
  [UserRole.AGENT_ORACLE, oracle, false],
  [UserRole.AGENT_ORACLE, standard, true],
  [UserRole.AGENT, oracle, true],
  [UserRole.AGENT_OPERATIONAL_SUPPORT, oracle, true],
  [UserRole.AGENT_ADMIN, oracle, true],
  [UserRole.USER, oracle, false],
])('%s access decision', (role, ticket, denied) => {
  if (denied) expect(() => assertTicketRoleAccess(ticket, role)).toThrow(ForbiddenException);
  else expect(() => assertTicketRoleAccess(ticket, role)).not.toThrow();
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm --prefix apps/backend test -- ticket-oracle-access.spec.ts --runInBand`

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement helper without service dependency**

```ts
import { ForbiddenException } from '@nestjs/common';
import { Ticket, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

const NON_ORACLE_AGENT_ROLES = [
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ADMIN,
] as const;

export const isNonOracleAgent = (role: UserRole): boolean =>
  (NON_ORACLE_AGENT_ROLES as readonly UserRole[]).includes(role);

export const isOracleTicket = (ticket: Pick<Ticket, 'category' | 'ticketType'>): boolean =>
  ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === TicketType.ORACLE_REQUEST;

export const assertTicketRoleAccess = (
  ticket: Pick<Ticket, 'category' | 'ticketType'>,
  role: UserRole,
): void => {
  if (role === UserRole.ADMIN) return;
  if (role === UserRole.AGENT_ORACLE && !isOracleTicket(ticket)) {
    throw new ForbiddenException('AGENT_ORACLE can access Oracle/K2 tickets only');
  }
  if (isNonOracleAgent(role) && isOracleTicket(ticket)) {
    throw new ForbiddenException('Non-Oracle agents cannot access Oracle/K2 tickets');
  }
};
```

Replace local `AGENT_ROLES_NON_ORACLE`, local `isNonOracleAgent`, and Oracle filter constants in `ticket-query.service.ts` with imports. Keep `applyOracleFilter` exported and implement it by calling shared predicate role helpers.

Change detail signature and enforce after ticket lookup:

```ts
async findOne(id: string, role: UserRole): Promise<any> {
  // existing lookup and not-found branch
  assertTicketRoleAccess(ticket, role);
  // existing SLA calculation and return
}
```

Add tests proving `findOne('oracle', UserRole.AGENT)` and `findOne('standard', UserRole.AGENT_ORACLE)` reject with `ForbiddenException`.

- [ ] **Step 4: Run helper and query tests**

Run: `npm --prefix apps/backend test -- ticket-oracle-access.spec.ts ticket-query.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit shared authorization primitive**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-oracle-access.ts apps/backend/src/modules/ticketing/services/ticket-oracle-access.spec.ts apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts
git commit -m "feat(ticketing): centralize oracle ticket authorization"
```

### Task 8: Apply Object Authorization to Messages and Ticket Mutations

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts:1-210`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:50-535`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts:1-141`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts`

**Interfaces:**
- Consumes: `assertTicketRoleAccess(ticket, role)` from Task 7.
- Produces: every read/write ticket service rejects cross-queue agent actions before exposing or changing ticket data.

- [ ] **Step 1: Write failing service tests**

```ts
it('blocks AGENT_ORACLE from reading standard-ticket messages', async () => {
  ticketRepo.findOne.mockResolvedValue({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE });
  await expect(service.getMessages('standard', UserRole.AGENT_ORACLE)).rejects.toBeInstanceOf(ForbiddenException);
});

it('blocks operational support from cancelling Oracle ticket', async () => {
  mockTicketRepo.findOne.mockResolvedValue(buildTicket('ORACLE_REQUEST'));
  mockUserRepo.findOne.mockResolvedValue({ id: 'ops-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT });
  await expect(service.cancelTicket('ticket-1', 'ops-1', UserRole.AGENT_OPERATIONAL_SUPPORT)).rejects.toBeInstanceOf(ForbiddenException);
});

it('blocks Oracle agent from a bulk update containing a standard ticket', async () => {
  mockUserRepo.findOne.mockResolvedValue({ id: 'oracle-1', role: UserRole.AGENT_ORACLE });
  mockTicketRepo.find.mockResolvedValue([buildTicket('ORACLE_REQUEST'), buildTicket('GENERAL')]);
  await expect(service.bulkUpdate(['oracle', 'standard'], {}, 'oracle-1')).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/backend test -- ticket-messaging.service.spec.ts ticket-update.service.spec.ts --runInBand`

Expected: FAIL because messages and mutation methods do not apply shared authorization.

- [ ] **Step 3: Enforce authorization before data exposure or write**

In messaging service:

```ts
async getMessages(ticketId: string, role: UserRole): Promise<TicketMessage[]> {
  const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundException('Ticket not found');
  assertTicketRoleAccess(ticket, role);
  return this.findMessages(ticketId);
}
```

At start of `getMessagesPaginated`, look up ticket, throw `NotFoundException` if absent, then call assertion before message query. In `replyToTicket`, after transactional ticket/user lookups and before creating message, call `assertTicketRoleAccess(ticket, user.role)`.

Expand `isAgentOrAdmin` to include actual ticket-managing roles:

```ts
const isAgentOrAdmin = [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ORACLE,
].includes(user.role);
```

In `updateTicket`, call `assertTicketRoleAccess(ticket, user.role)` immediately after both transaction lookups. In `assignTicket`, assert caller access after loading `assigner`, and assert assignee eligibility with `assertTicketRoleAccess(ticket, assignee.role)`; this prevents assigning a standard ticket to `AGENT_ORACLE` and Oracle ticket to a normal agent. In `cancelTicket`, use caller role assertion after user lookup. In `bulkUpdate`, assert every loaded ticket against `user.role` before query runner starts; reject full request rather than partially applying an unauthorized batch.

In `mergeTickets`, after loading `user`, call assertion for `primaryTicket` and every `secondaryTicket` before status validation or writes.

- [ ] **Step 4: Run message/mutation tests**

Run: `npm --prefix apps/backend test -- ticket-messaging.service.spec.ts ticket-update.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit service-level enforcement**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/src/modules/ticketing/services/ticket-merge.service.ts apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts
git commit -m "fix(ticketing): enforce oracle access on mutations"
```

### Task 9: Guard Ticket Creation and Expose Scoped Controller Actions

**Files:**
- Modify: `apps/backend/src/modules/ticketing/dto/create-ticket.dto.ts:1-102`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-create.service.ts:1-225`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:57-315`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.spec.ts
- Create: `apps/backend/src/modules/ticketing/services/ticket-create.service.spec.ts`

**Interfaces:**
- Consumes: `CreateTicketDto.ticketType?: TicketType`, `assertTicketRoleAccess`.
- Produces: controller forwards caller role to reads; both operational support and Oracle agent can reach management actions, then service applies ticket-category scope.

- [ ] **Step 1: Write failing create/controller tests**

```ts
it('rejects AGENT_ORACLE creation outside Oracle/K2 category', async () => {
  userRepo.findOne.mockResolvedValue({ id: 'oracle-1', role: UserRole.AGENT_ORACLE, siteId: 'site-1' });
  await expect(service.createTicket('oracle-1', {
    title: 'Standard issue', description: 'Standard ticket description', priority: TicketPriority.MEDIUM,
    category: 'GENERAL', ticketType: TicketType.SERVICE,
  })).rejects.toBeInstanceOf(ForbiddenException);
});

it('forwards role when loading one ticket and messages', async () => {
  const req = { user: { userId: 'oracle-1', role: UserRole.AGENT_ORACLE } };
  await controller.findOne('ticket-1', req);
  await controller.getMessages('ticket-1', req);
  expect(mockTicketQueryService.findOne).toHaveBeenCalledWith('ticket-1', UserRole.AGENT_ORACLE);
  expect(mockTicketMessagingService.getMessages).toHaveBeenCalledWith('ticket-1', UserRole.AGENT_ORACLE);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/backend test -- ticket-create.service.spec.ts tickets.controller.spec.ts --runInBand`

Expected: FAIL because DTO has no `ticketType`, creation accepts all categories, and controller drops role for detail/message reads.

- [ ] **Step 3: Validate and persist ticket type, then guard creation**

Add to DTO:

```ts
@ApiPropertyOptional({ enum: TicketType, example: TicketType.ORACLE_REQUEST })
@IsEnum(TicketType)
@IsOptional()
ticketType?: TicketType;
```

Import `TicketType`, set `ticketType: createTicketDto.ticketType ?? TicketType.SERVICE` in `ticketRepo.create`, and after caller is loaded call:

```ts
assertTicketRoleAccess({
  category: createTicketDto.category || 'GENERAL',
  ticketType: createTicketDto.ticketType ?? TicketType.SERVICE,
}, user.role);
```

This blocks only `AGENT_ORACLE` creation of non-Oracle tickets and non-Oracle agent creation of Oracle tickets. It leaves USER and MANAGER Oracle-request creation unchanged.

- [ ] **Step 4: Forward role and update controller role lists**

Change controller signatures:

```ts
async findOne(@Param('id') id: string, @Request() req: any) {
  return this.ticketQueryService.findOne(id, req.user.role);
}

async getMessages(@Param('id') id: string, @Request() req: any) {
  return this.ticketMessagingService.getMessages(id, req.user.role);
}
```

Keep paginated messages role forwarding. For seven mutations (`status`, `priority`, `category`, `device`, `assign`, `bulk/update`, `merge`), replace each `@Roles(UserRole.ADMIN, UserRole.AGENT)` with:

```ts
@Roles(
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ORACLE,
)
```

Do not add `AGENT_ADMIN`: scope only grants Operational Support parity and Oracle scoped management. The Task 8 service checks prevent role-list expansion from becoming cross-queue access.

- [ ] **Step 5: Run create/controller tests**

Run: `npm --prefix apps/backend test -- ticket-create.service.spec.ts tickets.controller.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit controller and creation changes**

```bash
git add apps/backend/src/modules/ticketing/dto/create-ticket.dto.ts apps/backend/src/modules/ticketing/services/ticket-create.service.ts apps/backend/src/modules/ticketing/presentation/tickets.controller.ts apps/backend/src/modules/ticketing/services/ticket-create.service.spec.ts apps/backend/src/modules/ticketing/presentation/tickets.controller.spec.ts
git commit -m "feat(ticketing): scope oracle creation and actions"
```

### Task 10: Repair Oracle Queue Mutations Before Role Expansion

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx:81-95,227-249,464-508`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:258-299`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:408-535`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.spec.ts`

**Interfaces:**
- Consumes: existing `PATCH /tickets/:id/assign`, `PATCH /tickets/bulk/update`, `TicketUpdateService.assignTicket`, and `TicketUpdateService.bulkUpdate`.
- Produces: Oracle queue’s assign/claim/bulk action payloads use real controller endpoints and Task 8 category assertions.

- [ ] **Step 1: Write failing queue action tests**

Add controller tests that prove these calls reach their intended service methods:

```ts
it('delegates bulk update payload to TicketUpdateService.bulkUpdate', async () => {
  const req = { user: { userId: 'oracle-1', role: UserRole.AGENT_ORACLE } };
  const dto = { ticketIds: ['ticket-1'], assigneeId: 'agent-2' };

  await controller.bulkUpdate(dto, req);

  expect(mockTicketUpdateService.bulkUpdate).toHaveBeenCalledWith(
    ['ticket-1'],
    { status: undefined, priority: undefined, assigneeId: 'agent-2', category: undefined },
    'oracle-1',
  );
});
```

Create `BentoOracleK2TicketsPage.test.tsx`. Mock `useOracleK2Tickets` with one Oracle ticket, mock `/users/agents` with `{ id: 'oracle-agent', role: 'AGENT_ORACLE' }`, select ticket, choose that agent in bulk bar, then assert:

```ts
expect(api.patch).toHaveBeenCalledWith('/tickets/bulk/update', {
  ticketIds: ['oracle-ticket'],
  assigneeId: 'oracle-agent',
});
expect(api.patch).not.toHaveBeenCalledWith('/tickets/bulk/assign', expect.anything());
```

Assert no page interaction sends literal `assigneeId: 'me'`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/backend test -- tickets.controller.spec.ts --runInBand`

Expected: controller test passes only after mutation endpoint wiring is fixed; frontend test fails because page calls nonexistent `/tickets/bulk/assign` and sends literal `'me'`.

- [ ] **Step 3: Wire Oracle queue to existing API contract**

In `BentoOracleK2TicketsPage`, change bulk assignment request:

```ts
await api.patch('/tickets/bulk/update', { ticketIds, assigneeId });
```

Remove `handleClaim`: current controller requires a UUID `assigneeId`; literal `'me'` cannot resolve an assignee and must not be sent. `VirtualizedTicketList` assignment picker and bulk bar already submit actual agent IDs.

Before passing agents to `useTicketListMutations` or `VirtualizedTicketList`, restrict list for Oracle queue:

```ts
const oracleAgents = agents.filter((agent) =>
  agent.role === 'AGENT_ORACLE' || agent.role === 'ADMIN',
);
```

Pass `oracleAgents` to mutation hook and list. This aligns UI with existing `assignTicket` enforcement and prevents misleading invalid assignee options.

In `TicketUpdateService.bulkUpdate`, change assignee validation from only `AGENT`/`ADMIN` to the same roles allowed by `assignTicket`, then call Task 7 `assertTicketRoleAccess(ticket, assignee.role)` before assigning each ticket. Task 8 already adds caller assertions for every ticket; this second check ensures Oracle tickets cannot be bulk-assigned to normal agents and standard tickets cannot be bulk-assigned to Oracle agents.

- [ ] **Step 4: Run queue/controller tests**

Run: `npm --prefix apps/backend test -- tickets.controller.spec.ts ticket-update.service.spec.ts --runInBand && npm --prefix apps/frontend test -- BentoOracleK2TicketsPage.test.tsx`

Expected: PASS; no Oracle queue action references `/tickets/bulk/assign` or uses `assigneeId: 'me'`.

- [ ] **Step 5: Commit Oracle queue action repair**

```bash
git add apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx apps/backend/src/modules/ticketing/presentation/tickets.controller.ts apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/src/modules/ticketing/presentation/tickets.controller.spec.ts apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.test.tsx
git commit -m "fix(oracle): wire queue assignment actions"
```

### Task 11: Full Verification and Manual Access Matrix

**Files:**
- Modify only if verification exposes a tested defect in files above.

**Interfaces:**
- Consumes: all prior commits and migration `SeedRoleScopedPresets1784505600000`.
- Produces: buildable frontend/backend with tested role isolation.

- [ ] **Step 1: Run backend affected suites**

Run:

```bash
npm --prefix apps/backend test -- user-crud.service.pagination.spec.ts user-crud.service.hris.spec.ts permissions.service.spec.ts hris-sync.service.spec.ts ticket-oracle-access.spec.ts ticket-query.service.spec.ts ticket-messaging.service.spec.ts ticket-update.service.spec.ts ticket-create.service.spec.ts tickets.controller.spec.ts --runInBand
npm --prefix apps/backend run build
```

Expected: all selected Jest suites PASS and Nest build succeeds.

- [ ] **Step 2: Run frontend affected suites and build**

Run:

```bash
npm --prefix apps/frontend test -- BentoAdminAgentsPage.smoke.test.tsx PresetDrawer.test.tsx BentoLoginPage.integration.test.tsx BentoOracleK2TicketsPage.test.tsx
npm --prefix apps/frontend run build
```

Expected: all selected Vitest suites PASS and Vite build succeeds.

- [ ] **Step 3: Run migration on non-production database**

Run: `npm --prefix apps/backend run migration:run`

Expected: TypeORM applies `SeedRoleScopedPresets1784505600000`; system `User` preset has `zoom_calendar: false`; `User Zoom`, `Agent Operational Support`, and `Agent Oracle` rows exist; users with previously null preset fields are backfilled.

- [ ] **Step 4: Perform browser manual matrix**

1. As `AGENT_ORACLE`, log in. Confirm direct landing `/tickets/oracle-k2`.
2. Confirm sidebar has only **Oracle K2 Request** and **Notifications**.
3. Visit `/dashboard`, `/kanban`, `/tickets/list`, `/hardware-requests`, `/zoom-calendar`, `/kb`, `/reports`, `/renewal`. Confirm redirect to `/tickets/oracle-k2` or access denial; no page data loads.
4. Open Oracle ticket detail, messages, reply, status/priority/category/device, assign, cancel, bulk update, merge. Confirm allowed only for Oracle tickets.
5. Request same APIs for a standard ticket using an Oracle session. Confirm HTTP 403.
6. As `AGENT_OPERATIONAL_SUPPORT`, confirm Agent pages/actions work and Oracle ticket APIs return HTTP 403.
7. As `USER`, confirm Zoom Calendar absent by default; apply **User Zoom** from Agents screen and confirm it appears.
8. In Agents page, search a user and change site/role. Confirm table total, role pills, site tabs, dashboard cards, and performance panel all use same filter scope.

- [ ] **Step 5: Commit verification-only fixes only if tests exposed them**

Do not make a verification-only commit. Fix belongs to task owning failed test; add it to that task’s listed files and rerun its focused checks. Do not change files if Steps 1–4 pass.

## Self-Review

- **Spec coverage:** Task 1–2 cover Agents role pills, server site counts, search-aware stats, and hardcoded `[ADMIN, AGENT]` stats exclusion. Tasks 3–5 cover editable/non-deletable presets, User Zoom default-off for existing/new users, `USER_ZOOM`, Operational Support, Oracle presets, provisioning, and backfill. Tasks 6–10 cover Oracle landing, sidebar, page key, route protections, form filtering, valid Oracle queue mutations, object-level ticket reads/writes, controller roles, and scoped creation.
- **Security coverage:** frontend hiding is paired with backend role/category checks; message list, paginated messages, replies, direct details, updates, assign, cancel, bulk update, merge, and creation all check ticket category/type. `ProtectedRoute` now combines role and page access rather than treating them as alternatives.
- **Migration reconciliation:** Task 3 makes system-preset seeding additive-only so administrator edits persist. Task 5 migration supplies one-time User Zoom policy enforcement, new preset rows, and backfill independent of bootstrap order.
- **Placeholder scan:** no unimplemented marker, vague error-handling instruction, or undefined later-step interface remains. User Zoom and Operational Support maps are fully written in Task 3.
- **Type consistency:** `UserListMeta.roleCounts`, `resolveDefaultPresetId`, `isOracleTicket`, `assertTicketRoleAccess`, and changed ticket method signatures are defined before consumers. `ticketType` uses existing `TicketType` enum.
