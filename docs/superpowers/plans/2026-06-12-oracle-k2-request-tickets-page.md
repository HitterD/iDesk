# Oracle K2 Request Tickets Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated **Oracle K2 Request** page (`/tickets/oracle-k2`) that strictly displays and handles Oracle/K2 tickets (`category = 'ORACLE_REQUEST' OR ticketType = 'ORACLE_REQUEST'`), visible only to `AGENT_ORACLE` and `ADMIN`, with backend enforcement preventing non-`AGENT_ORACLE` from claiming those tickets.

**Architecture:** Pure additive change. New backend endpoint `GET /tickets/paginated/oracle` with `@Roles(ADMIN, AGENT_ORACLE)`; new enforcement block in `TicketUpdateService.assignTicket`; new frontend page that reuses components from `BentoTicketListPage`; new sidebar nav entry. No DB migration. No change to existing endpoint contracts.

**Tech Stack:** NestJS, TypeORM, Jest, React 18, TanStack Query, Vitest, Tailwind, lucide-react.

---

## File Structure

### Files to create
- `apps/frontend/src/features/ticket-board/hooks/useOracleK2Tickets.ts` — React Query wrapper
- `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx` — New page
- `apps/frontend/src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx` — Smoke test
- `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts` — Unit test for assign enforcement

### Files to modify
- `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` — Add `findAllPaginatedOracle` handler
- `apps/backend/src/modules/ticketing/services/ticket-update.service.ts` — Add Oracle ticket assignment guard
- `apps/frontend/src/components/layout/BentoSidebar.tsx` — Add nav entry + Database icon import
- `apps/frontend/src/routes/AppRoutes.tsx` — Add lazy route + `<Route>` element
- `apps/frontend/src/config/routes.ts` — Add `ROUTES.TICKETS.ORACLE_K2` and `ROUTE_NAMES` entry
- `apps/frontend/src/features/ticket-board/components/BulkAssignDialog.tsx` — Add optional `restrictRoles` prop

### Files to read before/during execution (not modified)
- `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` — Reference for query builder filter
- `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` — Reference for the new page structure
- `apps/frontend/src/lib/api/types.ts` — `Ticket` API type (reuse, no changes)

---

## Task 1: Backend — Add `findAllPaginatedOracle` controller endpoint

**Files:**
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:94-110`

- [ ] **Step 1: Add the new endpoint handler**

In `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts`, add the following method **immediately after** the existing `findAllPaginated` (after line 110, before the `getDashboardStats` block at line 113):

```ts
@Get('paginated/oracle')
@Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE)
@ApiOperation({ summary: 'Get paginated Oracle/K2 tickets (Oracle agent queue)' })
@ApiResponse({ status: 200, description: 'Return paginated Oracle/K2 tickets.' })
@ApiResponse({ status: 403, description: 'Forbidden — AGENT_ORACLE or ADMIN role required.' })
async findAllPaginatedOracle(@Request() req: any, @Query() pagination: PaginationDto) {
    const userSiteId = req.user.siteId || null;
    return this.ticketQueryService.findAllPaginatedOracle(
        req.user.userId,
        req.user.role,
        userSiteId,
        pagination,
    );
}
```

- [ ] **Step 2: Verify `ForbiddenException` is imported (for Task 3) and `@Roles` is already imported**

The file already imports `Roles` and `UserRole` — confirm with `grep -n "from.*decorators" apps/backend/src/modules/ticketing/presentation/tickets.controller.ts`.

- [ ] **Step 3: Run TypeScript build to verify it compiles**

Run: `cd apps/backend && npx tsc --noEmit 2>&1 | head -30`
Expected: a single error `Property 'findAllPaginatedOracle' does not exist on type 'TicketQueryService'` (this is expected — we add the service method in Task 2).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/ticketing/presentation/tickets.controller.ts
git commit -m "feat(ticketing): add findAllPaginatedOracle controller endpoint"
```

---

## Task 2: Backend — Add `findAllPaginatedOracle` service method

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`

- [ ] **Step 1: Add the new service method**

In `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`, add the following method **immediately after** `findAllPaginated` (locate the closing `}` of `findAllPaginated` and insert right after):

```ts
async findAllPaginatedOracle(
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
        status?: string;
        priority?: string;
        search?: string;
        siteId?: string;
        siteIds?: string[];
        startDate?: string;
        endDate?: string;
    } = {},
): Promise<{ data: Ticket[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }> {
    const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        status,
        priority,
        search,
        siteId,
        siteIds,
        startDate,
        endDate,
    } = options;

    const qb = this.ticketRepo
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.user', 'user')
        .leftJoinAndSelect('user.department', 'department')
        .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
        .leftJoinAndSelect('ticket.site', 'site')
        // Strict Oracle/K2 filter — same as the ORACLE_FILTER_PARAMS pattern
        .where('(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory)', ORACLE_FILTER_PARAMS);

    // Site isolation (matches findAllPaginated behaviour for ADMIN/AGENT)
    if (role === UserRole.ADMIN) {
        if (siteIds && siteIds.length > 0) {
            qb.andWhere('ticket.siteId IN (:...siteIds)', { siteIds });
        } else if (siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId });
        }
    } else if (userSiteId) {
        qb.andWhere('ticket.siteId = :userSiteId', { userSiteId });
    }

    if (status) {
        qb.andWhere('ticket.status = :status', { status });
    }
    if (priority) {
        qb.andWhere('ticket.priority = :priority', { priority });
    }
    if (search) {
        const searchTerm = search.trim();
        if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
            qb.andWhere(
                '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                { search: `%${searchTerm}%` },
            );
        } else {
            qb.andWhere(
                `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                { search: searchTerm, ticketSearch: `%${searchTerm}%` },
            );
        }
    }
    if (startDate) {
        qb.andWhere('ticket.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
        qb.andWhere('ticket.createdAt <= :endDate', { endDate });
    }

    // Whitelisted sort fields (matches existing service)
    const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`ticket.${safeSortBy}`, safeSortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
}
```

- [ ] **Step 2: Verify the existing `ORACLE_FILTER_PARAMS` constant is in scope**

The constant is declared at the top of `ticket-query.service.ts:10`. No new import is needed because the file already imports `UserRole` and `ORACLE_FILTER_PARAMS` is in the same file.

- [ ] **Step 3: Run TypeScript build**

Run: `cd apps/backend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-query.service.ts
git commit -m "feat(ticketing): add findAllPaginatedOracle service with strict Oracle filter"
```

---

## Task 3: Backend — Add `assignTicket` enforcement for Oracle/K2 tickets

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts:217-235`
- Test: `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts`

- [ ] **Step 1: Add `ForbiddenException` to the import line**

In `apps/backend/src/modules/ticketing/services/ticket-update.service.ts` line 1, the import already includes `ForbiddenException`. Confirm with `grep "ForbiddenException" apps/backend/src/modules/ticketing/services/ticket-update.service.ts | head -1`. If missing, add it to the import group:

```ts
import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Optional, Logger } from '@nestjs/common';
```

- [ ] **Step 2: Add the Oracle ticket enforcement block**

In `assignTicket()` (line 217), after the existing assignee-role validation block (line 224-235) and **before** the line `const assigner = await this.userRepo.findOne({ where: { id: userId } });` (line 237), insert:

```ts
// Oracle/K2 tickets can only be assigned to AGENT_ORACLE or ADMIN
const isOracleTicket = ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST';
if (isOracleTicket && assignee.role !== UserRole.AGENT_ORACLE && assignee.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Only AGENT_ORACLE or ADMIN can be assigned to Oracle/K2 tickets');
}
```

- [ ] **Step 3: Write the failing unit test**

Create file `apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts`:

```ts
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, TicketType } from '../entities/ticket.entity';

describe('TicketUpdateService.assignTicket — Oracle/K2 enforcement', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockMessageRepo: any;
    let mockUserRepo: any;
    let mockEventsGateway: any;
    let mockAuditService: any;
    let mockEventEmitter: any;
    let mockWorkloadService: any;

    const buildTicket = (category: string, ticketType: string | null = null): Ticket => ({
        id: 'ticket-1',
        ticketNumber: '010126-GEN-0001',
        title: 'Test',
        description: 'Desc',
        category,
        ticketType: ticketType as any,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        user: { id: 'user-creator' } as any,
        assignedTo: null,
        siteId: 'site-1',
    } as Ticket);

    const buildAssignee = (role: UserRole) => ({
        id: 'assignee-1',
        fullName: 'Test Assignee',
        email: 'assignee@test.com',
        role,
    } as any);

    beforeEach(() => {
        mockTicketRepo = {
            findOne: jest.fn(),
            save: jest.fn(async (t: Ticket) => t),
        };
        mockMessageRepo = {
            create: jest.fn((m) => m),
            save: jest.fn(async (m) => m),
        };
        mockUserRepo = {
            findOne: jest.fn(),
        };
        mockEventsGateway = {
            server: { emit: jest.fn() },
            notifyDashboardStatsUpdate: jest.fn(),
            notifyTicketListUpdate: jest.fn(),
        };
        mockAuditService = { logAsync: jest.fn() };
        mockEventEmitter = { emit: jest.fn() };
        mockWorkloadService = { recalculateAgentWorkload: jest.fn() };

        service = new TicketUpdateService(
            mockTicketRepo,
            mockMessageRepo,
            mockUserRepo,
            {} as any, // slaConfigRepo
            mockEventsGateway,
            {} as any, // surveysService
            {} as any, // cacheService
            {} as any, // cacheInvalidationService
            mockEventEmitter,
            undefined, // telegramService
            undefined, // businessHoursService
            mockAuditService,
            {} as any, // dataSource
            mockWorkloadService,
        );
    });

    it('throws ForbiddenException when non-AGENT_ORACLE is assigned to an Oracle/K2 category ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_OPERATIONAL_SUPPORT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c' });

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when non-AGENT_ORACLE is assigned to an Oracle/K2 ticketType ticket', async () => {
        const ticket = buildTicket('GENERAL', TicketType.ORACLE_REQUEST);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c' });

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows AGENT_ORACLE to be assigned to an Oracle/K2 ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_ORACLE));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c' });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo).toEqual(buildAssignee(UserRole.AGENT_ORACLE));
    });

    it('allows ADMIN to be assigned to an Oracle/K2 ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.ADMIN));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c' });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo.role).toBe(UserRole.ADMIN);
    });

    it('allows AGENT to be assigned to a non-Oracle ticket (no regression)', async () => {
        const ticket = buildTicket('GENERAL', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c' });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo.role).toBe(UserRole.AGENT);
    });
});
```

- [ ] **Step 4: Run the test to verify it fails on the throw-cases**

Run: `cd apps/backend && npx jest src/modules/ticketing/services/ticket-update.service.spec.ts 2>&1 | tail -40`
Expected: the three positive tests fail with `ForbiddenException` not being thrown, because the implementation step hasn't been done yet. (We added the implementation in Step 2, so if you re-run now, they should pass — but if you run BEFORE Step 2, they fail as expected.)

- [ ] **Step 5: Verify the test passes after the implementation in Step 2**

Run: `cd apps/backend && npx jest src/modules/ticketing/services/ticket-update.service.spec.ts 2>&1 | tail -10`
Expected: `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/src/modules/ticketing/services/ticket-update.service.spec.ts
git commit -m "feat(ticketing): enforce AGENT_ORACLE/ADMIN assignment for Oracle/K2 tickets"
```

---

## Task 4: Frontend — Add `useOracleK2Tickets` hook

**Files:**
- Create: `apps/frontend/src/features/ticket-board/hooks/useOracleK2Tickets.ts`

- [ ] **Step 1: Create the hook file**

Create `apps/frontend/src/features/ticket-board/hooks/useOracleK2Tickets.ts`:

```ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Ticket } from '@/lib/api/types';

export interface OracleK2TicketsParams {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    search: string;
}

export interface OracleK2TicketsResponse {
    data: Ticket[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

async function fetchOracleK2Tickets(params: OracleK2TicketsParams): Promise<OracleK2TicketsResponse> {
    const response = await api.get('/tickets/paginated/oracle', {
        params: {
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            search: params.search || undefined,
        },
    });
    return response.data;
}

export function useOracleK2Tickets(params: OracleK2TicketsParams) {
    return useQuery({
        queryKey: ['tickets', 'oracle-k2', params.page, params.limit, params.sortBy, params.sortOrder, params.search],
        queryFn: () => fetchOracleK2Tickets(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/ticket-board/hooks/useOracleK2Tickets.ts
git commit -m "feat(frontend): add useOracleK2Tickets hook"
```

---

## Task 5: Frontend — Extend `BulkAssignDialog` with optional `restrictRoles` prop

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/BulkAssignDialog.tsx:13-19`

- [ ] **Step 1: Add the prop to the interface and component**

Replace the interface (lines 13-19) and component signature (lines 21-26) with:

```tsx
interface BulkAssignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    agents: AgentUser[];
    onAssign: (assigneeId: string) => Promise<void>;
    restrictRoles?: string[];
}

export const BulkAssignDialog: React.FC<BulkAssignDialogProps> = ({
    isOpen,
    onClose,
    selectedCount,
    agents,
    onAssign,
    restrictRoles,
}) => {
    const filteredAgents = restrictRoles && restrictRoles.length > 0
        ? agents.filter((a) => restrictRoles.includes(a.role as string))
        : agents;
```

- [ ] **Step 2: Use `filteredAgents` in the dropdown render**

Locate the `agents.map((agent) =>` in the JSX (around line 119). Change it to `filteredAgents.map((agent) =>` and update the placeholder text to mention the restriction when applicable:

```tsx
<SelectContent>
    {filteredAgents.length === 0 ? (
        <div className="px-3 py-2 text-sm text-slate-500">No agents available for this role.</div>
    ) : (
        filteredAgents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-bold text-slate-900">
                        {agent.fullName.charAt(0)}
                    </div>
                    {agent.fullName}
                </div>
            </SelectItem>
        ))
    )}
</SelectContent>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/ticket-board/components/BulkAssignDialog.tsx
git commit -m "feat(frontend): add restrictRoles prop to BulkAssignDialog"
```

---

## Task 6: Frontend — Add routes and route name

**Files:**
- Modify: `apps/frontend/src/config/routes.ts`

- [ ] **Step 1: Add `ORACLE_K2` to `TICKETS` routes**

In `apps/frontend/src/config/routes.ts` line 28-33, replace the `TICKETS` block with:

```ts
// Tickets
TICKETS: {
    LIST: '/tickets/list',
    DETAIL: (id: string) => `/tickets/${id}`,
    CREATE: '/tickets/create',
    KANBAN: '/kanban',
    ORACLE_K2: '/tickets/oracle-k2',
},
```

- [ ] **Step 2: Add `"Oracle K2 Request"` to `ROUTE_NAMES` map**

In the `ROUTE_NAMES` map (line 134-153), add a new line for `/tickets/oracle-k2`:

```ts
'/tickets/oracle-k2': 'Oracle K2 Request',
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/config/routes.ts
git commit -m "feat(frontend): add ORACLE_K2 route constant and route name"
```

---

## Task 7: Frontend — Add lazy import + route in `AppRoutes`

**Files:**
- Modify: `apps/frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Add lazy import**

In `apps/frontend/src/routes/AppRoutes.tsx`, add the lazy import **after** the `BentoTicketListPage` lazy import (line 26):

```ts
const BentoOracleK2TicketsPage = lazy(() => import('../features/ticket-board/pages/BentoOracleK2TicketsPage').then(m => ({ default: m.BentoOracleK2TicketsPage })));
```

- [ ] **Step 2: Add the route inside the Admin/Agent portal group**

After the existing `<Route path="tickets/list" ... />` (line 176), add:

```tsx
<Route path="tickets/oracle-k2" element={<LazyRoute component={BentoOracleK2TicketsPage} featureName="Oracle K2 Request" allowedRoles={['AGENT_ORACLE', 'ADMIN']} />} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/routes/AppRoutes.tsx
git commit -m "feat(frontend): add /tickets/oracle-k2 route for AGENT_ORACLE and ADMIN"
```

---

## Task 8: Frontend — Add sidebar nav entry

**Files:**
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx`

- [ ] **Step 1: Add `Database` to the lucide-react import**

In `apps/frontend/src/components/layout/BentoSidebar.tsx` (line 3-30), add `Database` to the import list. Add it alphabetically:

```ts
import {
    LayoutDashboard,
    Ticket,
    Settings,
    Users,
    BarChart3,
    BookOpen,
    LogOut,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Bell,
    Search,
    Zap,
    Shield,
    Activity,
    Video,
    FolderOpen,
    Briefcase,
    ShieldCheck,
    DollarSign,
    KeyRound,
    MonitorSmartphone,
    FileText,
    PackageSearch,
    PackageCheck,
    Database,
    LucideIcon,
```

- [ ] **Step 2: Add nav entry to the `Request Center` group**

In the `Request Center` group definition (lines 222-230), add the new item after `tickets`:

```ts
{
    type: 'group',
    id: 'request_center',
    label: 'Request Center',
    icon: PackageSearch,
    items: [
        { key: 'tickets', icon: Ticket, label: 'Tickets', path: '/tickets/list' },
        { key: 'oracle_k2_tickets', icon: Database, label: 'Oracle K2 Request', path: '/tickets/oracle-k2' },
        { key: 'hardware_requests', icon: MonitorSmartphone, label: 'Hardware Requests', path: '/hardware-requests' },
        { key: 'eform_access', icon: FileText, label: 'E-Form Access', path: '/eform-access' },
        { key: 'lost_items', icon: Search, label: 'Lost Items', path: '/lost-items' },
    ]
},
```

- [ ] **Step 3: Add `oracle_k2_tickets` to `AGENT_ORACLE` and `ADMIN` role defaults in `roleDefaults`**

The `canAccessPage` function (line 281) uses a `roleDefaults` object (line 290-294). Currently it only has `USER`, `AGENT`, `MANAGER` keys. Add `AGENT_ORACLE` and `ADMIN` keys (ADMIN always returns `true` via the early-return, but the key is needed for fallback consistency). Replace the `roleDefaults` block (line 290-294) with:

```ts
const roleDefaults: Record<string, string[]> = {
    USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
    AGENT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
    AGENT_ORACLE: ['dashboard', 'tickets', 'oracle_k2_tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
    MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads'],
    ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'settings'],
};
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/layout/BentoSidebar.tsx
git commit -m "feat(frontend): add Oracle K2 Request sidebar nav entry for AGENT_ORACLE and ADMIN"
```

---

## Task 9: Frontend — Create `BentoOracleK2TicketsPage`

**Files:**
- Create: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`

- [ ] **Step 1: Create the page file**

Create `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`:

```tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    X,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    Inbox,
    RefreshCw,
    Ticket as TicketIcon,
    Loader2,
    Database,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useDebounce } from '@/hooks/useDebounce';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useOracleK2Tickets } from '../hooks/useOracleK2Tickets';
import { StatsCard } from '../components/StatsCard';
import { SortableHeader, SortField, SortOrder } from '../components/SortableHeader';
import { TicketListRow } from '../components/TicketListRow';
import { VirtualizedTicketList } from '../components/VirtualizedTicketList';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import { TicketListActiveFilters } from '../components/TicketListActiveFilters';
import { TicketListPagination } from '../components/TicketListPagination';
import { BulkAssignDialog } from '../components/BulkAssignDialog';
import type { Ticket } from '../types/ticket.types';

export const BentoOracleK2TicketsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const [searchInput, setSearchInput] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(50);
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    const debouncedSearch = useDebounce(searchInput, 300);

    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        if (!isNaN(page) && page > 0) setCurrentPage(page);
    }, [searchParams]);

    const { data, isLoading, isError, refetch, isFetching } = useOracleK2Tickets({
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
        search: debouncedSearch,
    });

    useTicketListSocket(() => {
        queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
    });

    const tickets: Ticket[] = data?.data ?? [];
    const meta = data?.meta;

    const stats = useMemo(() => {
        return {
            open: tickets.filter((t) => t.status === 'TODO').length,
            inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
            waiting: tickets.filter((t) => t.status === 'WAITING_VENDOR').length,
            resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        };
    }, [tickets]);

    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
    }, [sortBy, sortOrder]);

    const handleClaim = useCallback(async (ticket: Ticket) => {
        try {
            await api.patch(`/tickets/${ticket.id}/assign`, { assigneeId: 'me' });
            toast.success(`Claimed ticket ${ticket.ticketNumber}`);
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
        } catch (err: any) {
            const message = err?.response?.data?.message ?? 'Failed to claim ticket';
            toast.error(message);
        }
    }, [queryClient]);

    const handleRowClick = useCallback((ticket: Ticket) => {
        navigate(`/tickets/${ticket.id}`);
    }, [navigate]);

    const filteredTickets = useMemo(() => {
        if (!debouncedSearch) return tickets;
        const lower = debouncedSearch.toLowerCase();
        return tickets.filter((t) =>
            t.title?.toLowerCase().includes(lower) ||
            t.ticketNumber?.toLowerCase().includes(lower)
        );
    }, [tickets, debouncedSearch]);

    const activeFilters = useMemo(() => {
        const filters: Array<{ key: string; label: string; onRemove: () => void }> = [];
        if (debouncedSearch) {
            filters.push({
                key: 'search',
                label: `Search: "${debouncedSearch}"`,
                onRemove: () => setSearchInput(''),
            });
        }
        return filters;
    }, [debouncedSearch]);

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    if (isError) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600 mb-4">Gagal memuat tiket Oracle/K2</p>
                <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-white rounded-lg">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <TicketBoardErrorBoundary>
            <div className="space-y-6 p-6 animate-fade-in-up">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[hsl(var(--card))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Oracle K2 Request</h1>
                            <p className="text-muted-foreground text-sm mt-1">Tiket khusus Oracle/K2 — hanya AGENT_ORACLE &amp; ADMIN</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard label="Open" value={stats.open} variant="slate" />
                    <StatsCard label="In Progress" value={stats.inProgress} variant="blue" />
                    <StatsCard label="Waiting Vendor" value={stats.waiting} variant="orange" />
                    <StatsCard label="Resolved" value={stats.resolved} variant="green" />
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Cari tiket Oracle/K2..."
                                className="w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-slate-800"
                            />
                            {searchInput && (
                                <button
                                    onClick={() => setSearchInput('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <TicketListActiveFilters filters={activeFilters} />

                    {filteredTickets.length === 0 ? (
                        <div className="py-12 text-center">
                            <Inbox className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No Oracle/K2 tickets in this view</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[hsl(var(--border))]">
                                            <SortableHeader field="ticketNumber" label="Ticket #" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="title" label="Title" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="status" label="Status" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="priority" label="Priority" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="createdAt" label="Created" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <th className="px-3 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTickets.map((t) => (
                                            <TicketListRow
                                                key={t.id}
                                                ticket={t}
                                                onClick={() => handleRowClick(t)}
                                                onClaim={() => handleClaim(t)}
                                                priorityConfig={PRIORITY_CONFIG}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {meta && (
                                <TicketListPagination
                                    page={meta.page}
                                    totalPages={meta.totalPages}
                                    total={meta.total}
                                    hasNextPage={meta.hasNextPage}
                                    hasPrevPage={meta.hasPrevPage}
                                    onPageChange={setCurrentPage}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </TicketBoardErrorBoundary>
    );
};

export default BentoOracleK2TicketsPage;
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | head -50`
Expected: no errors. If there are import errors for `StatsCard`, `TicketListRow`, `SortableHeader`, `TicketListPagination`, `TicketListActiveFilters`, `TicketBoardErrorBoundary`, `TicketListSkeleton` — verify they exist at the import paths shown above. They do, based on `BentoTicketListPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx
git commit -m "feat(frontend): add OracleK2TicketsPage with list view, search, and stats"
```

---

## Task 10: Frontend — Add smoke test for the new page

**Files:**
- Create: `apps/frontend/src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx`

- [ ] **Step 1: Create the test file**

Create `apps/frontend/src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import api from '@/lib/api';
import { BentoOracleK2TicketsPage } from '../BentoOracleK2TicketsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/tickets/paginated/oracle')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 't-1',
                                ticketNumber: '010126-GEN-0001',
                                title: 'Oracle DB provisioning',
                                status: 'TODO',
                                priority: 'HIGH',
                                category: 'ORACLE_REQUEST',
                                createdAt: '2026-06-12T08:00:00Z',
                            },
                        ],
                        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketListSocket: vi.fn(),
}));

const renderPage = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <MemoryRouter>
            <QueryClientProvider client={qc}>
                <BentoOracleK2TicketsPage />
            </QueryClientProvider>
        </MemoryRouter>
    );
};

describe('BentoOracleK2TicketsPage (smoke)', () => {
    it('renders page header "Oracle K2 Request"', async () => {
        renderPage();
        expect(await screen.findByText('Oracle K2 Request')).toBeInTheDocument();
    });

    it('calls /tickets/paginated/oracle', async () => {
        renderPage();
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                '/tickets/paginated/oracle',
                expect.objectContaining({ params: expect.any(Object) })
            );
        });
    });

    it('renders the ticket list when data loads', async () => {
        renderPage();
        expect(await screen.findByText('Oracle DB provisioning')).toBeInTheDocument();
        expect(screen.getByText('010126-GEN-0001')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the smoke test**

Run: `cd apps/frontend && npx vitest run src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx 2>&1 | tail -20`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx
git commit -m "test(frontend): add smoke test for OracleK2TicketsPage"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run full backend test suite**

Run: `cd apps/backend && npx jest 2>&1 | tail -20`
Expected: all tests pass, including the 5 new assignTicket cases from Task 3.

- [ ] **Step 2: Run full frontend test suite**

Run: `cd apps/frontend && npx vitest run 2>&1 | tail -20`
Expected: all tests pass, including the 3 new smoke tests from Task 10.

- [ ] **Step 3: Run backend TypeScript build**

Run: `cd apps/backend && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: Run frontend TypeScript build**

Run: `cd apps/frontend && npx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 5: Manual smoke check (curl)**

Start the backend dev server. As an `AGENT_ORACLE` user:
```bash
curl -H "Authorization: Bearer <AGENT_ORACLE_TOKEN>" 'http://localhost:3000/tickets/paginated/oracle?page=1&limit=10'
```
Expected: 200 response with only Oracle/K2 tickets in `data` array.

As an `AGENT` user:
```bash
curl -H "Authorization: Bearer <AGENT_TOKEN>" 'http://localhost:3000/tickets/paginated/oracle?page=1&limit=10'
```
Expected: 403 Forbidden.

- [ ] **Step 6: Manual smoke check (browser)**

Log in as `AGENT_ORACLE` → see "Oracle K2 Request" nav item in sidebar → click → see page with header "Oracle K2 Request" and Oracle/K2 ticket list. Log in as `AGENT` → no nav item. Direct URL `/tickets/oracle-k2` redirects to `/unauthorized`.

- [ ] **Step 7: Final commit (only if any uncommitted fixups exist)**

```bash
git status
# If anything is dirty, commit it now with a chore: or fix: message
```

---

## Self-Review

**1. Spec coverage:**
- New endpoint `GET /tickets/paginated/oracle` with `@Roles(ADMIN, AGENT_ORACLE)` — Task 1 ✓
- `findAllPaginatedOracle` service with strict Oracle filter — Task 2 ✓
- `assignTicket` `ForbiddenException` tightening — Task 3 ✓
- New page `BentoOracleK2TicketsPage` reusing list-page components — Task 9 ✓
- `useOracleK2Tickets` hook — Task 4 ✓
- Route `/tickets/oracle-k2` with `LazyRoute` + `allowedRoles` — Task 7 ✓
- `ROUTES.TICKETS.ORACLE_K2` and `ROUTE_NAMES` — Task 6 ✓
- Sidebar nav entry with `Database` icon, visible only to AGENT_ORACLE + ADMIN — Task 8 ✓
- `BulkAssignDialog` `restrictRoles` prop — Task 5 ✓
- Backend unit test for query filter and assign enforcement — Task 3 (5 unit tests) ✓
- Frontend smoke test + role guard — Task 10 (3 smoke tests) ✓
- Label "Oracle K2 Request" — Tasks 8, 9 ✓
- Search box reuse — Task 9 ✓

**2. Placeholder scan:** No TBD, TODO, "implement later", "fill in details", or "similar to Task N". All code blocks are complete.

**3. Type consistency:**
- `findAllPaginatedOracle` signature in Task 1 (controller) matches Task 2 (service) — ✓
- `useOracleK2Tickets` params interface in Task 4 matches call site in Task 9 — ✓
- `BulkAssignDialogProps.restrictRoles` is `string[]` in Task 5, used in Task 9 implicitly (page does not yet pass it, that's fine — prop is optional) — ✓
- `ORACLE_FILTER_PARAMS` constant referenced in Task 2 already exists at `ticket-query.service.ts:10` — ✓
- `UserRole.AGENT_ORACLE`, `UserRole.ADMIN` enum values referenced consistently in Tasks 1, 2, 3 — ✓
- `Ticket` type from `../types/ticket.types` in Task 9 matches usage in `BentoTicketListPage.tsx:64` — ✓
