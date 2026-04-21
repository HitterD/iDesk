# Hardware Installation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Hardware Installation tickets into the Hardware Requests page via a new "Installation" tab, inline indicators on cards, and an installation progress section on the detail page. Keep HW Installation tickets visible in the general tickets list with a purple row highlight + link to Hardware Requests.

**Architecture:** Backend-first approach — add 2 new endpoints to the ICT Budget module (`GET /ict-budget/installations` for cross-request listing, `GET /ict-budget/:id/installations` for per-request detail), extend the existing `GET /ict-budget` response with `installationSummary`, and extend `GET /tickets/paginated` to include `ictBudgetRequestId`. Frontend consumes these via new React Query hooks and renders the tab, indicators, section, and row highlights.

**Tech Stack:** NestJS (TypeORM QueryBuilder), React (React Query, Tailwind CSS, lucide-react icons)

**Spec:** `docs/superpowers/specs/2026-04-07-hardware-installation-integration-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `apps/backend/src/modules/ict-budget/dto/installation-query.dto.ts` | DTO for installation list query params |
| `apps/frontend/src/features/request-center/components/InstallationTab.tsx` | Table view for Installation tab |
| `apps/frontend/src/features/request-center/components/InstallationProgressSection.tsx` | Per-request installation progress section for detail page |

### Files to Modify

| File | Change |
|------|--------|
| `apps/backend/src/modules/ict-budget/ict-budget.service.ts` | Add `findAllInstallations()`, `findRequestInstallations()`, extend `findAll()` with installationSummary |
| `apps/backend/src/modules/ict-budget/ict-budget.controller.ts` | Add 2 new GET endpoints |
| `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` | Include `ictBudgetRequestId` in paginated response for HW Installation tickets |
| `apps/frontend/src/features/request-center/api/ict-budget.api.ts` | Add types + hooks for new endpoints |
| `apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx` | Add "Installation" tab |
| `apps/frontend/src/features/request-center/pages/HardwareRequestDetailPage.tsx` | Add InstallationProgressSection |
| `apps/frontend/src/features/request-center/components/HardwareRequestCardItem.tsx` | Add installation indicator badge |
| `apps/frontend/src/features/request-center/components/HardwareRequestListItem.tsx` | Add installation indicator badge |
| `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` | Remove HARDWARE_INSTALLATION from category filter exclusion |
| `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx` | Add purple row highlight + link for HW Installation tickets |

---

## Task 1: Backend — Installation Query DTO

**Files:**
- Create: `apps/backend/src/modules/ict-budget/dto/installation-query.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// apps/backend/src/modules/ict-budget/dto/installation-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class InstallationQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Items per page', default: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ description: 'Filter by ticket status: TODO, IN_PROGRESS, RESOLVED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Search by title or ticket number' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/ict-budget/dto/installation-query.dto.ts
git commit -m "feat: add InstallationQueryDto for installation list endpoint"
```

---

## Task 2: Backend — Service Methods for Installations

**Files:**
- Modify: `apps/backend/src/modules/ict-budget/ict-budget.service.ts`

- [ ] **Step 1: Add `findAllInstallations` method**

Add this method after the existing `getActivities` method (after line 352). This method queries all HARDWARE_INSTALLATION tickets across all ICT Budget requests, with pagination and filtering.

```typescript
// Add after getActivities method in ict-budget.service.ts

async findAllInstallations(
  user: { userId: string; role: string; siteId?: string },
  options: { page?: number; limit?: number; status?: string; siteId?: string; search?: string },
): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const page = options.page || 1;
  const limit = options.limit || 20;

  const qb = this.ticketRepo
    .createQueryBuilder('ticket')
    .leftJoinAndSelect('ticket.user', 'requester')
    .leftJoinAndSelect('ticket.assignedTo', 'assignee')
    .leftJoinAndSelect('ticket.site', 'site')
    .leftJoin(
      'installation_schedules',
      'schedule',
      'schedule.ticketId = ticket.id',
    )
    .addSelect([
      'schedule.ictBudgetRequestId',
      'schedule.itemName',
      'schedule.itemIndex',
      'schedule.scheduledTimeSlot',
    ])
    .where('ticket.ticketType = :type', { type: 'HARDWARE_INSTALLATION' })
    .andWhere('ticket.isHardwareInstallation = :isHw', { isHw: true });

  // Role-based site filtering
  if (user.role === 'USER') {
    qb.andWhere('ticket.userId = :userId', { userId: user.userId });
  } else if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.siteId) {
    qb.andWhere('ticket.siteId = :siteId', { siteId: user.siteId });
  }

  // Optional filters
  if (options.siteId) {
    qb.andWhere('ticket.siteId = :filterSiteId', { filterSiteId: options.siteId });
  }
  if (options.status) {
    qb.andWhere('ticket.status = :status', { status: options.status });
  }
  if (options.search) {
    qb.andWhere(
      '(ticket.title ILIKE :search OR ticket.ticketNumber ILIKE :search)',
      { search: `%${options.search}%` },
    );
  }

  qb.orderBy('ticket.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  const [rawTickets, total] = await qb.getManyAndCount();

  // Fetch schedule data separately for clean mapping
  const ticketIds = rawTickets.map((t) => t.id);
  const schedules = ticketIds.length
    ? await this.installationScheduleRepo
        .createQueryBuilder('s')
        .where('s.ticketId IN (:...ticketIds)', { ticketIds })
        .getMany()
    : [];

  const scheduleMap = new Map(schedules.map((s) => [s.ticketId, s]));

  const data = rawTickets.map((ticket) => {
    const schedule = scheduleMap.get(ticket.id);
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: ticket.status,
      hardwareType: ticket.hardwareType,
      scheduledDate: ticket.scheduledDate,
      scheduledTime: ticket.scheduledTime,
      site: ticket.site ? { id: ticket.site.id, name: ticket.site.name } : null,
      requester: ticket.user
        ? { id: ticket.user.id, fullName: ticket.user.fullName }
        : null,
      assignedTo: ticket.assignedTo
        ? { id: ticket.assignedTo.id, fullName: ticket.assignedTo.fullName }
        : null,
      ictBudgetRequestId: schedule?.ictBudgetRequestId || null,
      itemName: schedule?.itemName || null,
      itemIndex: schedule?.itemIndex ?? null,
      scheduledTimeSlot: schedule?.scheduledTimeSlot || null,
      createdAt: ticket.createdAt,
    };
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

- [ ] **Step 2: Add `findRequestInstallations` method**

Add this method right after `findAllInstallations`. This returns all installation tickets linked to a specific ICT Budget request.

```typescript
async findRequestInstallations(
  ictBudgetId: string,
): Promise<{
  data: any[];
  total: number;
  installed: number;
  inProgress: number;
  scheduled: number;
}> {
  const schedules = await this.installationScheduleRepo.find({
    where: { ictBudgetRequestId: ictBudgetId },
    order: { itemIndex: 'ASC' },
  });

  if (!schedules.length) {
    return { data: [], total: 0, installed: 0, inProgress: 0, scheduled: 0 };
  }

  const ticketIds = schedules
    .filter((s) => s.ticketId)
    .map((s) => s.ticketId);

  const tickets = ticketIds.length
    ? await this.ticketRepo.find({
        where: ticketIds.map((id) => ({ id })),
        relations: ['assignedTo'],
      })
    : [];

  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  let installed = 0;
  let inProgress = 0;
  let scheduled = 0;

  const data = schedules.map((schedule) => {
    const ticket = schedule.ticketId ? ticketMap.get(schedule.ticketId) : null;
    const status = ticket?.status || 'TODO';

    if (status === 'RESOLVED') installed++;
    else if (status === 'IN_PROGRESS') inProgress++;
    else scheduled++;

    return {
      id: ticket?.id || schedule.id,
      ticketNumber: ticket?.ticketNumber || null,
      title: ticket?.title || `Installation: ${schedule.itemName}`,
      status,
      hardwareType: ticket?.hardwareType || null,
      scheduledDate: ticket?.scheduledDate || schedule.scheduledDate,
      scheduledTime: ticket?.scheduledTime || null,
      scheduledTimeSlot: schedule.scheduledTimeSlot,
      assignedTo: ticket?.assignedTo
        ? { id: ticket.assignedTo.id, fullName: ticket.assignedTo.fullName }
        : null,
      itemIndex: schedule.itemIndex,
      itemName: schedule.itemName,
      scheduleStatus: schedule.status,
      createdAt: ticket?.createdAt || schedule.createdAt,
    };
  });

  return {
    data,
    total: data.length,
    installed,
    inProgress,
    scheduled,
  };
}
```

- [ ] **Step 3: Extend `findAll` to include `installationSummary`**

Modify the existing `findAll` method (lines 93-124). After getting the paginated results, compute the installation summary for each request.

Replace the return statement at the end of `findAll` (around line 122-124):

Old code:
```typescript
    return { data, total, page, limit };
```

New code:
```typescript
    // Compute installation summary for each request
    const requestIds = data.map((r) => r.id);
    const summaries =
      requestIds.length > 0
        ? await this.installationScheduleRepo
            .createQueryBuilder('s')
            .select('s.ictBudgetRequestId', 'ictBudgetRequestId')
            .addSelect('COUNT(*)', 'total')
            .leftJoin('tickets', 't', 't.id = s.ticketId')
            .addSelect(
              "COUNT(CASE WHEN t.status = 'RESOLVED' THEN 1 END)",
              'installed',
            )
            .addSelect(
              "COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END)",
              'inProgress',
            )
            .addSelect(
              "COUNT(CASE WHEN t.status NOT IN ('RESOLVED', 'IN_PROGRESS') THEN 1 END)",
              'scheduled',
            )
            .addSelect(
              "MIN(CASE WHEN t.status NOT IN ('RESOLVED') THEN t.scheduledDate END)",
              'nextScheduledDate',
            )
            .where('s.ictBudgetRequestId IN (:...requestIds)', { requestIds })
            .groupBy('s.ictBudgetRequestId')
            .getRawMany()
        : [];

    const summaryMap = new Map(
      summaries.map((s) => [
        s.ictBudgetRequestId,
        {
          total: parseInt(s.total, 10),
          installed: parseInt(s.installed, 10),
          inProgress: parseInt(s.inProgress, 10),
          scheduled: parseInt(s.scheduled, 10),
          nextScheduledDate: s.nextScheduledDate || null,
        },
      ]),
    );

    const enrichedData = data.map((request) => ({
      ...request,
      installationSummary: summaryMap.get(request.id) || null,
    }));

    return { data: enrichedData, total, page, limit };
```

- [ ] **Step 4: Verify the service compiles**

Run:
```bash
cd apps/backend && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No errors related to ict-budget.service.ts

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ict-budget/ict-budget.service.ts
git commit -m "feat: add installation query methods and installationSummary to ICT Budget service"
```

---

## Task 3: Backend — Controller Endpoints

**Files:**
- Modify: `apps/backend/src/modules/ict-budget/ict-budget.controller.ts`

- [ ] **Step 1: Import the new DTO**

Add to the imports at the top of the file (after line 5):

```typescript
import { InstallationQueryDto } from './dto/installation-query.dto';
```

- [ ] **Step 2: Add `GET /ict-budget/installations` endpoint**

Add this endpoint **before** the `GET /ict-budget/:id` endpoint (before line 62). This is important because NestJS matches routes in order, and `/installations` must be matched before `/:id`.

```typescript
  @Get('installations')
  @ApiOperation({ summary: 'Get all hardware installation tickets across all requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'TODO, IN_PROGRESS, RESOLVED' })
  @ApiQuery({ name: 'siteId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_ORACLE,
    UserRole.USER,
  )
  async findAllInstallations(
    @Request() req,
    @Query() query: InstallationQueryDto,
  ) {
    return this.ictBudgetService.findAllInstallations(req.user, {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 20,
      status: query.status,
      siteId: query.siteId,
      search: query.search,
    });
  }
```

- [ ] **Step 3: Add `GET /ict-budget/:id/installations` endpoint**

Add this endpoint after the existing `GET /ict-budget/:id` endpoint (after line 66):

```typescript
  @Get(':id/installations')
  @ApiOperation({ summary: 'Get installation tickets for a specific ICT budget request' })
  async findRequestInstallations(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ictBudgetService.findRequestInstallations(id);
  }
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd apps/backend && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ict-budget/ict-budget.controller.ts
git commit -m "feat: add installation list endpoints to ICT Budget controller"
```

---

## Task 4: Backend — Extend Ticket Paginated Response

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`

- [ ] **Step 1: Add ictBudgetRequestId to paginated response**

In the `findAllPaginated` method, after the query executes and returns `[tickets, total]` (around line 170), add a lookup for `ictBudgetRequestId` for HW Installation tickets before returning.

Add this code between getting the results and the return statement. Find the line where `const [tickets, total]` or equivalent is assigned (around line 170), and add after it:

```typescript
    // Enrich HW Installation tickets with ictBudgetRequestId
    const hwTicketIds = tickets
      .filter((t) => t.isHardwareInstallation)
      .map((t) => t.id);

    let hwScheduleMap = new Map<string, string>();
    if (hwTicketIds.length > 0) {
      const schedules = await this.ticketRepo.manager
        .createQueryBuilder()
        .select('s."ticketId"', 'ticketId')
        .addSelect('s."ictBudgetRequestId"', 'ictBudgetRequestId')
        .from('installation_schedules', 's')
        .where('s."ticketId" IN (:...hwTicketIds)', { hwTicketIds })
        .getRawMany();
      hwScheduleMap = new Map(
        schedules.map((s) => [s.ticketId, s.ictBudgetRequestId]),
      );
    }

    const enrichedTickets = tickets.map((ticket) => ({
      ...ticket,
      ictBudgetRequestId: hwScheduleMap.get(ticket.id) || null,
    }));
```

Then update the return statement to use `enrichedTickets` instead of `tickets`:

Old:
```typescript
    return {
      data: tickets,
      meta: {
```

New:
```typescript
    return {
      data: enrichedTickets,
      meta: {
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/backend && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-query.service.ts
git commit -m "feat: include ictBudgetRequestId in paginated ticket response for HW Installation tickets"
```

---

## Task 5: Frontend — API Types and Hooks

**Files:**
- Modify: `apps/frontend/src/features/request-center/api/ict-budget.api.ts`

- [ ] **Step 1: Add installation-related types**

Add these types after the existing `PaginatedIctBudgetResponse` interface (around line 73):

```typescript
export interface InstallationTicket {
  id: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  hardwareType: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledTimeSlot: string | null;
  site: { id: string; name: string } | null;
  requester: { id: string; fullName: string } | null;
  assignedTo: { id: string; fullName: string } | null;
  ictBudgetRequestId: string | null;
  itemName: string | null;
  itemIndex: number | null;
  createdAt: string;
}

export interface PaginatedInstallationsResponse {
  data: InstallationTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RequestInstallationsResponse {
  data: InstallationTicket[];
  total: number;
  installed: number;
  inProgress: number;
  scheduled: number;
}

export interface InstallationSummary {
  total: number;
  installed: number;
  inProgress: number;
  scheduled: number;
  nextScheduledDate: string | null;
}
```

- [ ] **Step 2: Add `installationSummary` to `IctBudgetRequest` type**

In the existing `IctBudgetRequest` interface (around line 42), add the new optional field at the end:

```typescript
  installationSummary?: InstallationSummary | null;
```

- [ ] **Step 3: Add `useIctBudgetInstallations` hook**

Add after the existing hooks (before the file ends):

```typescript
export function useIctBudgetInstallations(params: {
  page?: number;
  limit?: number;
  status?: string;
  siteId?: string;
  search?: string;
}) {
  return useQuery<PaginatedInstallationsResponse>({
    queryKey: ['ict-budget-installations', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.status) searchParams.set('status', params.status);
      if (params.siteId) searchParams.set('siteId', params.siteId);
      if (params.search) searchParams.set('search', params.search);
      const res = await api.get(`/ict-budget/installations?${searchParams}`);
      return res.data;
    },
  });
}
```

- [ ] **Step 4: Add `useIctBudgetRequestInstallations` hook**

Add right after the previous hook:

```typescript
export function useIctBudgetRequestInstallations(id: string) {
  return useQuery<RequestInstallationsResponse>({
    queryKey: ['ict-budget-request-installations', id],
    queryFn: async () => {
      const res = await api.get(`/ict-budget/${id}/installations`);
      return res.data;
    },
    enabled: !!id,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/request-center/api/ict-budget.api.ts
git commit -m "feat: add installation API types and hooks"
```

---

## Task 6: Frontend — InstallationTab Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/InstallationTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/frontend/src/features/request-center/components/InstallationTab.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useIctBudgetInstallations,
  type InstallationTicket,
} from '../api/ict-budget.api';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Scheduled', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'RESOLVED' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Completed
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          In Progress
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Scheduled
        </span>
      );
  }
}

export function InstallationTab() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: response, isLoading } = useIctBudgetInstallations({
    page,
    limit: 20,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const installations = response?.data || [];
  const totalPages = response?.totalPages || 1;
  const total = response?.total || 0;

  const handleRowClick = (installation: InstallationTicket) => {
    if (installation.ictBudgetRequestId) {
      navigate(
        `/hardware-requests/${installation.ictBudgetRequestId}?highlight=installation`,
      );
    }
  };

  return (
    <div>
      {/* Sub-filters + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setStatusFilter(filter.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Ticket
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Hardware
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Site
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Requester
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Assigned To
              </th>
              <th className="px-3 py-2.5 font-semibold text-xs text-gray-500 uppercase">
                Scheduled
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : installations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No installations found
                </td>
              </tr>
            ) : (
              installations.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="border-t border-gray-100 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="text-indigo-600 text-xs">
                      {item.ticketNumber}
                    </span>
                    <div className="font-medium text-gray-900 truncate max-w-[200px]">
                      {item.title}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {item.itemName || item.hardwareType || '-'}
                  </td>
                  <td className="px-3 py-2.5">
                    {item.site ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">
                        {item.site.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2.5">{getStatusBadge(item.status)}</td>
                  <td className="px-3 py-2.5">
                    {item.requester ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-medium">
                          {item.requester.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-700 text-xs">
                          {item.requester.fullName}
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {item.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-medium">
                          {item.assignedTo.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-700 text-xs">
                          {item.assignedTo.fullName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {item.scheduledDate ? (
                      <div>
                        <div className="text-gray-700 text-xs">
                          {new Date(item.scheduledDate).toLocaleDateString(
                            'id-ID',
                            { day: 'numeric', month: 'short', year: 'numeric' },
                          )}
                        </div>
                        {item.scheduledTimeSlot && (
                          <div className="text-gray-400 text-[11px]">
                            {item.scheduledTimeSlot}
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of{' '}
            {total} installations
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 border rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1 border rounded ${
                    page === p
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 border rounded disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/InstallationTab.tsx
git commit -m "feat: create InstallationTab component with table view"
```

---

## Task 7: Frontend — InstallationProgressSection Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/InstallationProgressSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/frontend/src/features/request-center/components/InstallationProgressSection.tsx
import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import {
  useIctBudgetRequestInstallations,
  type InstallationTicket,
} from '../api/ict-budget.api';

function getStatusColor(status: string) {
  switch (status) {
    case 'RESOLVED':
      return { border: 'border-l-green-600', badge: 'bg-green-100 text-green-800', label: 'Completed', icon: '✅' };
    case 'IN_PROGRESS':
      return { border: 'border-l-blue-600', badge: 'bg-blue-100 text-blue-800', label: 'In Progress', icon: '🔧' };
    default:
      return { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800', label: 'Scheduled', icon: '📅' };
  }
}

interface Props {
  ictBudgetId: string;
}

export function InstallationProgressSection({ ictBudgetId }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const { data: response, isLoading } = useIctBudgetRequestInstallations(ictBudgetId);

  useEffect(() => {
    if (searchParams.get('highlight') === 'installation' && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, response]);

  if (isLoading) {
    return (
      <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-5 animate-pulse">
        <div className="h-6 bg-purple-100 rounded w-48 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-white rounded" />
          <div className="h-16 bg-white rounded" />
        </div>
      </div>
    );
  }

  if (!response || response.total === 0) {
    return null;
  }

  const { data: installations, total, installed } = response;

  return (
    <div
      ref={sectionRef}
      className="bg-[#f8f6ff] border border-[#e0d9f7] rounded-lg p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-700" />
          <span className="text-[15px] font-bold text-purple-800">
            Installation Progress
          </span>
        </div>
        <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
          {installed}/{total} completed
        </span>
      </div>

      {/* Installation Items */}
      <div className="space-y-2.5">
        {installations.map((item) => {
          const statusStyle = getStatusColor(item.status);
          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg p-3.5 border-l-[3px] ${statusStyle.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[13px] text-gray-900">
                    Item {(item.itemIndex ?? 0) + 1}: {item.itemName || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Ticket {item.ticketNumber || 'N/A'}
                    {item.assignedTo
                      ? ` · Assigned: ${item.assignedTo.fullName}`
                      : ' · Unassigned'}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusStyle.badge}`}
                >
                  {statusStyle.icon} {statusStyle.label}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1.5">
                {item.scheduledDate
                  ? `Scheduled: ${new Date(item.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}${item.scheduledTimeSlot ? `, ${item.scheduledTimeSlot}` : ''}`
                  : 'No schedule set'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/InstallationProgressSection.tsx
git commit -m "feat: create InstallationProgressSection component for detail page"
```

---

## Task 8: Frontend — Add Installation Tab to HardwareRequestPage

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx`

- [ ] **Step 1: Add imports**

Add to the imports at the top of the file:

```typescript
import { Wrench } from 'lucide-react';
import { InstallationTab } from '../components/InstallationTab';
```

- [ ] **Step 2: Add Installation tab to TABS array**

Find the TABS array (around line 25-31) and add the Installation tab at the end:

Old:
```typescript
  { label: 'Completed', value: 'REALIZED', icon: CheckCircle2, color: 'success' },
]
```

New:
```typescript
  { label: 'Completed', value: 'REALIZED', icon: CheckCircle2, color: 'success' },
  { label: 'Installation', value: 'INSTALLATION', icon: Wrench, color: 'purple' },
]
```

- [ ] **Step 3: Render InstallationTab when Installation tab is active**

Find the content area where card/list views are rendered (around lines 174-242). Wrap the existing content in a conditional that checks if the active tab is Installation:

Find the section that starts with the loading/content rendering (after search bar, around line 174). Wrap the existing content:

```tsx
{statusFilter === 'INSTALLATION' ? (
  <InstallationTab />
) : (
  /* existing card/list view content stays here unchanged */
)}
```

- [ ] **Step 4: Style the Installation tab differently**

In the tab rendering JSX (around lines 113-144), add purple styling for the Installation tab. Find where tab styles are applied and add a condition:

In the tab button className, add purple color handling. Look for where `color` is used in the tab styling and ensure purple maps to `bg-purple-600 text-white` when active and `text-purple-700` when inactive.

- [ ] **Step 5: Verify the page renders**

Run the frontend dev server and navigate to `/hardware-requests`. Verify:
- The Installation tab appears at the end
- Clicking it shows the InstallationTab component
- Other tabs continue to work normally

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx
git commit -m "feat: add Installation tab to Hardware Requests page"
```

---

## Task 9: Frontend — Add InstallationProgressSection to Detail Page

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/HardwareRequestDetailPage.tsx`

- [ ] **Step 1: Add import**

Add to the imports:

```typescript
import { InstallationProgressSection } from '../components/InstallationProgressSection';
```

- [ ] **Step 2: Add the section to the page layout**

Find the left column content area in the main grid layout (around line 212). After the existing Items/Shipment section (around line 300, before the Activity Timeline section), add:

```tsx
{/* Installation Progress Section */}
<InstallationProgressSection ictBudgetId={id!} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/HardwareRequestDetailPage.tsx
git commit -m "feat: add InstallationProgressSection to hardware request detail page"
```

---

## Task 10: Frontend — Installation Indicator on Card and List Items

**Files:**
- Modify: `apps/frontend/src/features/request-center/components/HardwareRequestCardItem.tsx`
- Modify: `apps/frontend/src/features/request-center/components/HardwareRequestListItem.tsx`

- [ ] **Step 1: Add installation indicator to HardwareRequestCardItem**

Find the progress section in the card (around lines 44-62). After the existing progress bar, add the installation indicator:

```tsx
{/* Installation Indicator */}
{req.installationSummary && req.installationSummary.total > 0 ? (
  <div className="mt-2 flex items-center gap-2">
    {req.installationSummary.installed === req.installationSummary.total ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
        ✅ {req.installationSummary.installed}/{req.installationSummary.total} installed
      </span>
    ) : (
      <>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700">
          🔧 {req.installationSummary.installed}/{req.installationSummary.total} installed
        </span>
        {req.installationSummary.nextScheduledDate && (
          <span className="text-[11px] text-gray-500">
            Next: {new Date(req.installationSummary.nextScheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </>
    )}
  </div>
) : (req.realizationStatus === 'ARRIVED' || req.realizationStatus === 'REALIZED') ? (
  <div className="mt-2">
    <span className="text-[11px] text-gray-400 italic">Belum ada instalasi</span>
  </div>
) : null}
```

- [ ] **Step 2: Add installation indicator to HardwareRequestListItem**

Find the progress bar column in the list item (around the col-span-2 for progress, line ~66-70). After the progress percentage, add a similar indicator:

```tsx
{/* Installation Indicator */}
{req.installationSummary && req.installationSummary.total > 0 && (
  <div className="mt-1">
    {req.installationSummary.installed === req.installationSummary.total ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
        ✅ {req.installationSummary.installed}/{req.installationSummary.total} installed
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
        🔧 {req.installationSummary.installed}/{req.installationSummary.total} installed
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/components/HardwareRequestCardItem.tsx apps/frontend/src/features/request-center/components/HardwareRequestListItem.tsx
git commit -m "feat: add installation indicator badge to hardware request card and list items"
```

---

## Task 11: Frontend — Ticket List Row Highlight

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx`

- [ ] **Step 1: Remove HARDWARE_INSTALLATION from category exclusion filter**

In `BentoTicketListPage.tsx`, find the `filteredTickets` useMemo (around lines 404-417) where categories are excluded:

Old:
```typescript
t.category !== 'HARDWARE_INSTALLATION' &&
```

Remove that line so Hardware Installation tickets are no longer filtered out from the list.

- [ ] **Step 2: Add `ictBudgetRequestId` to the local Ticket interface**

In `BentoTicketListPage.tsx`, find the local `Ticket` interface (around lines 67-104). Add:

```typescript
  ictBudgetRequestId?: string | null;
```

Also in `TicketListRow.tsx`, find the `TicketRowData` interface (around lines 29-65). Add:

```typescript
  ictBudgetRequestId?: string | null;
```

- [ ] **Step 3: Add row highlight styling and link to TicketListRow**

In `TicketListRow.tsx`, add `useNavigate` import:

```typescript
import { useNavigate } from 'react-router-dom';
```

Inside the component, add navigate:

```typescript
const navigate = useNavigate();
```

Find the row container div (around line 116-131) where conditional styling is applied. Add hardware installation styling:

Add to the className condition logic for the row container:

```typescript
const isHwInstallation = ticket.isHardwareInstallation;
```

Add to the row's className:
```typescript
isHwInstallation && 'bg-purple-50/70 border-l-[3px] border-l-purple-600',
```

- [ ] **Step 4: Add "Lihat di Hardware Requests" link**

In `TicketListRow.tsx`, find where the ticket title is rendered (around lines 147-170). After the title text, add the link:

```tsx
{ticket.isHardwareInstallation && ticket.ictBudgetRequestId && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/hardware-requests/${ticket.ictBudgetRequestId}?highlight=installation`);
    }}
    className="block text-[11px] text-purple-600 hover:text-purple-800 mt-0.5"
  >
    🔧 Lihat di Hardware Requests →
  </button>
)}
```

- [ ] **Step 5: Verify the tickets list page**

Run the frontend and navigate to `/tickets/list`. Verify:
- Hardware Installation tickets now appear in the list
- They have purple background + left border
- The "Lihat di Hardware Requests →" link appears below the title
- Clicking the link navigates to the correct hardware request
- Clicking the row itself still opens ticket detail

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx apps/frontend/src/features/ticket-board/components/TicketListRow.tsx
git commit -m "feat: add purple row highlight and HW Request link for Hardware Installation tickets"
```

---

## Task 12: Integration Verification

- [ ] **Step 1: Verify backend endpoints**

```bash
# Start backend if not running
cd apps/backend && npm run start:dev
```

Test the new endpoints via curl or browser:
- `GET /ict-budget/installations` — should return paginated installation tickets
- `GET /ict-budget/installations?status=TODO` — should filter by status
- `GET /ict-budget/{some-id}/installations` — should return installations for specific request
- `GET /ict-budget` — each item should now have `installationSummary` field
- `GET /tickets/paginated` — HW Installation tickets should have `ictBudgetRequestId`

- [ ] **Step 2: Verify frontend flows**

Navigate through the app and verify:
1. `/hardware-requests` → Installation tab shows table of all installation tickets
2. Click row in Installation tab → navigates to hardware request detail with installation section highlighted
3. Hardware request cards show "🔧 X/Y installed" badge when applicable
4. `/hardware-requests/:id` → Installation Progress section appears with per-item status
5. `/tickets/list` → HW Installation tickets appear with purple highlight + "Lihat di Hardware Requests" link
6. Click purple link → navigates to hardware request detail

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for hardware installation feature"
```
