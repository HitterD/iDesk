# Oracle Ticket Isolation & Agent Role Assignment Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strictly isolate Oracle/K2 tickets to the Oracle tickets view (`/tickets/oracle-k2`), exclude them from general tickets view (`/tickets/list`), and restrict agent assignment options so Oracle tickets are assigned strictly to Oracle Agents and General tickets to Operational Support Agents.

**Architecture:** Update backend query builder filters in `TicketQueryService` and `UserCrudService`, enforce strict assignment role checks in `TicketUpdateService`, and pass contextual ticket type parameters when fetching agents in frontend.

**Tech Stack:** NestJS, TypeORM, React, TypeScript, TanStack Query, TailwindCSS.

---

### Task 1: Backend - Exclude Oracle Tickets from General Paginated Query

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:120-145`
- Test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`

- [ ] **Step 1: Write failing test in `ticket-query.service.spec.ts`**

Check that `findAllPaginated` excludes Oracle tickets for ADMIN, MANAGER, and USER roles when requesting standard ticket lists without explicit `ORACLE_REQUEST` filter.

```typescript
it('should exclude Oracle tickets from findAllPaginated for ADMIN and USER by default', async () => {
    // Test that tickets with ticketType=ORACLE_REQUEST or category=ORACLE_REQUEST are excluded when calling findAllPaginated
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/backend test -- ticket-query.service.spec.ts`
Expected: FAIL (Oracle tickets currently included for ADMIN and USER in `findAllPaginated`).

- [ ] **Step 3: Update `findAllPaginated` in `ticket-query.service.ts`**

In `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`:
Update the query builder role-based filtering block so that when `ticketType` is not explicitly `'ORACLE_REQUEST'` and `category` is not explicitly `'ORACLE_REQUEST'`, Oracle tickets are excluded for all roles:

```typescript
        // Exclude Oracle tickets by default for general ticket queries across all roles
        if (ticketType === 'ORACLE_REQUEST' || category === 'ORACLE_REQUEST') {
            qb.andWhere('(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory)', ORACLE_FILTER_PARAMS);
        } else {
            qb.andWhere('(ticket.ticketType != :oracleType AND ticket.category != :oracleCategory)', ORACLE_FILTER_PARAMS);
        }

        // Role-based filtering
        if (role === UserRole.USER) {
            qb.andWhere('ticket.userId = :userId', { userId });

            if (!ticketType) {
                qb.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', {
                    excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION']
                });
            }
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/backend test -- ticket-query.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts
git commit -m "fix(backend): exclude Oracle tickets from general tickets query for all roles"
```

---

### Task 2: Backend - Contextual Agent Query Filtering in `UserCrudService` & `UsersController`

**Files:**
- Modify: `apps/backend/src/modules/users/users.controller.ts:103-111`
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:321-343`
- Modify: `apps/backend/src/modules/users/users.service.ts:88-90`
- Test: `apps/backend/src/modules/users/user-crud.service.spec.ts`

- [ ] **Step 1: Write failing test in `user-crud.service.spec.ts`**

Test that `getAgents` with `ticketType='ORACLE_REQUEST'` returns only `AGENT_ORACLE` (and `ADMIN`), while `getAgents` without Oracle params returns operational support agents (`AGENT_OPERATIONAL_SUPPORT`, `AGENT`, `AGENT_ADMIN`, `ADMIN`) and excludes `AGENT_ORACLE`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/backend test -- user-crud.service.spec.ts`
Expected: FAIL (`getAgents` does not accept `ticketType` / `category`).

- [ ] **Step 3: Update `users.controller.ts`, `users.service.ts`, and `user-crud.service.ts`**

In `users.controller.ts`:
```typescript
    @Get('agents')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE)
    @ApiOperation({ summary: 'Get agents, optionally filtered by siteId, category, or ticketType' })
    @ApiQuery({ name: 'siteId', required: false, description: 'Filter agents by site ID' })
    @ApiQuery({ name: 'category', required: false, description: 'Filter agents by ticket category' })
    @ApiQuery({ name: 'ticketType', required: false, description: 'Filter agents by ticket type' })
    @ApiResponse({ status: 200, description: 'Return agents.' })
    async getAgents(
        @Query('siteId') siteId?: string,
        @Query('category') category?: string,
        @Query('ticketType') ticketType?: string,
        @Req() req?: any,
    ) {
        return this.usersService.getAgents(siteId, req?.user?.role, category, ticketType);
    }
```

In `users.service.ts`:
```typescript
    async getAgents(siteId?: string, callerRole?: UserRole, category?: string, ticketType?: string): Promise<User[]> {
        return this.userCrudService.getAgents(siteId, callerRole, category, ticketType);
    }
```

In `user-crud.service.ts`:
```typescript
    async getAgents(
        siteId?: string,
        callerRole?: UserRole,
        category?: string,
        ticketType?: string,
    ): Promise<User[]> {
        const isOracleContext =
            callerRole === UserRole.AGENT_ORACLE ||
            ticketType === 'ORACLE_REQUEST' ||
            category === 'ORACLE_REQUEST';

        const roles = isOracleContext
            ? [UserRole.AGENT_ORACLE, UserRole.ADMIN]
            : [UserRole.AGENT, UserRole.ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN];

        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.site', 'site')
            .where('user.isActive = :isActive', { isActive: true })
            .andWhere('user.role IN (:...roles)', { roles })
            .select([
                'user.id', 'user.fullName', 'user.email', 'user.role',
                'user.avatarUrl', 'user.siteId', 'user.appraisalPoints',
                'site.id', 'site.code', 'site.name',
            ])
            .orderBy('user.fullName', 'ASC');

        if (siteId) {
            qb.andWhere('user.siteId = :siteId', { siteId });
        }

        return qb.getMany();
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/backend test -- user-crud.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/users/
git commit -m "feat(backend): add contextual ticketType and category filtering for assignable agents"
```

---

### Task 3: Backend - Enforce Strict Cross-Role Ticket Assignment Rules in `TicketUpdateService`

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:232-264`
- Test: `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts`

- [ ] **Step 1: Write failing test in `ticket-update.service.spec.ts`**

Add tests to ensure:
1. Oracle ticket CANNOT be assigned to `AGENT_OPERATIONAL_SUPPORT`.
2. Operational ticket CANNOT be assigned to `AGENT_ORACLE`.
3. Non-Oracle agent CANNOT assign an Oracle ticket.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/backend test -- ticket-update.service.spec.ts`
Expected: FAIL (General ticket currently lacks check preventing `AGENT_ORACLE` assignee).

- [ ] **Step 3: Update `assignTicket` in `ticket-update.service.ts`**

```typescript
        // Enforce strict role assignment logic based on ticket type
        const isOracleTicket = ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST';
        if (isOracleTicket) {
            if (assignee.role !== UserRole.AGENT_ORACLE && assignee.role !== UserRole.ADMIN) {
                throw new ForbiddenException('Oracle/K2 tickets can only be assigned to AGENT_ORACLE or ADMIN');
            }
            if (assigner.role !== UserRole.AGENT_ORACLE && assigner.role !== UserRole.ADMIN) {
                throw new ForbiddenException('Only AGENT_ORACLE or ADMIN can assign Oracle/K2 tickets');
            }
        } else {
            if (assignee.role === UserRole.AGENT_ORACLE) {
                throw new ForbiddenException('General support tickets cannot be assigned to AGENT_ORACLE');
            }
            if (assigner.role === UserRole.AGENT_ORACLE) {
                throw new ForbiddenException('AGENT_ORACLE cannot assign general support tickets');
            }
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix apps/backend test -- ticket-update.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts
git commit -m "fix(backend): enforce strict cross-role ticket assignment rules"
```

---

### Task 4: Frontend - Pass Ticket Context Parameters to Agent Fetch Requests

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx:81-91`
- Modify: `apps/frontend/src/features/ticket-board/components/sidebar/AssigneeSelect.tsx`
- Modify: `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx:109-114`

- [ ] **Step 1: Update `BentoOracleK2TicketsPage.tsx` agent query**

Ensure `BentoOracleK2TicketsPage.tsx` passes `ticketType=ORACLE_REQUEST` when requesting `/users/agents`:

```typescript
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', 'oracle', isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            params.set('ticketType', 'ORACLE_REQUEST');
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
    });
```

- [ ] **Step 2: Update `AssigneeSelect.tsx` to pass ticket context**

Pass `ticketType` / `category` from the ticket object to `/users/agents` query in `AssigneeSelect.tsx` so the dropdown dynamically shows valid agents for that ticket type.

- [ ] **Step 3: Update `BentoMyTicketsPage.tsx` client filter**

Ensure `BentoMyTicketsPage.tsx` filters out Oracle tickets on the frontend as an additional layer of protection:

```typescript
    const tickets = (response?.data ?? []).filter(t => 
        t.ticketType !== 'ICT_BUDGET' && 
        t.ticketType !== 'HARDWARE_INSTALLATION' &&
        t.ticketType !== 'ORACLE_REQUEST' &&
        t.category !== 'ORACLE_REQUEST'
    );
```

- [ ] **Step 4: Commit frontend changes**

```bash
git add apps/frontend/src/
git commit -m "fix(frontend): send ticket context to agent fetch endpoint and filter client-side lists"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Run full backend test suite**

Run: `npm --prefix apps/backend test`
Expected: All tests PASS.

- [ ] **Step 2: Verify Frontend Build**

Run: `npm --prefix apps/frontend run build` or check TypeScript compilation.
Expected: PASS without build errors.
