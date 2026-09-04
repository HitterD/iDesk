# Scheduled Reports (Automated Email Delivery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working system for site-scoped, user-configurable scheduled reports that automatically generate Excel reports (Monthly Summary / Agent Performance / Ticket Volume) on a custom schedule (daily/weekly/monthly + custom send time HH:mm) and email them individually to selected agents at the same site (with explicit separation of regular agents vs AGENT_ORACLE for performance reports). Replace the existing hardcoded scheduled reports behavior.

**Architecture:** 
- New `ScheduledReportConfig` entity (with `siteId`, `schedule`, `sendTime`, `reportType`, `recipientUserIds`, `targetAgentCategory`).
- New `ScheduledReportExecution` entity for audit logging.
- Dynamic cron jobs via `SchedulerRegistry` + `CronJob` (built from schedule + sendTime per config).
- CRUD API under `/reports/scheduled` with strict site isolation using existing `SiteActor` / `resolveSiteScope` / `assertSiteAccess` patterns.
- Report generators updated to support `siteId` filtering and (for performance) agent category separation.
- Execution runs generators → filters recipients by site + role + category → generates in-memory Excel → sends one email per valid agent via `MailDispatchService` → logs to execution table.
- Frontend tab in Reports page for management.

**Tech Stack:** NestJS (TypeORM, @nestjs/schedule, @nestjs-modules/mailer via existing MailDispatchService), React + TanStack Query + existing UI components (Select, Input, Checkbox patterns from codebase), ExcelJS (already used).

**Spec:** docs/superpowers/specs/2026-08-21-scheduled-reports-design.md

## Global Constraints
- Follow existing site isolation patterns exactly (SiteActor, CROSS_SITE_ROLES = [ADMIN, MANAGER], fail-closed when no siteId).
- Only ADMIN and MANAGER may create/edit/delete/toggle/trigger scheduled reports (enforced in backend).
- Recipients must be agents (any AGENT* role) belonging to the exact same site as the config. No external emails.
- For AGENT_PERFORMANCE reports: explicit separation — never mix regular agents and AGENT_ORACLE in one config.
- Send time is per-config (HH:mm). Build cron expression dynamically.
- One scheduled config = exactly one schedule + send time.
- Every execution must be logged (success / partial / failed) even on errors.
- Reuse existing generators and MailDispatchService; do not duplicate email logic.
- No hardcoded secrets. All validation at service layer for recipients.
- Follow project rules: small focused changes, test each step, commit frequently. File <800 lines where reasonable.
- Existing hardcoded `ScheduledReportsService` will be deprecated after this is working.

---

### Task 0: Research & Verification (Zero Context for Implementer)

**Files:**
- Read: `apps/backend/src/modules/reports/generators/agent-performance.report.ts`
- Read: `apps/backend/src/modules/reports/generators/ticket-volume.report.ts`
- Read: `apps/backend/src/modules/reports/reports.service.ts` (monthly stats part)
- Read: `apps/backend/src/modules/reports/generators/scheduled-reports.service.ts` (the old hardcoded one)
- Read: `apps/backend/src/shared/core/utils/site-scope.util.ts`
- Read: `apps/backend/src/modules/users/entities/user.entity.ts` (role and siteId columns)
- Read: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts` (siteId column)
- Read: `apps/backend/src/modules/sites/entities/site.entity.ts`
- Read: `apps/backend/src/shared/mail/mail-dispatch.service.ts`
- Read: `apps/frontend/src/features/reports/pages/BentoReportsPage.tsx` (current tabs and data fetching)
- Read: Recent migration example, e.g. `apps/backend/src/migrations/1787200258000-AddSiteIdToFoundItemClaims.ts`

**Goal of this task:** Confirm current state before touching anything. Do not write code yet.

- [ ] **Step 1:** Run these commands and save output for reference

```bash
cd apps/backend
npm run build 2>&1 | tail -20
```

- [ ] **Step 2:** Check if ScheduleModule is registered and what cron jobs exist at runtime (will help later)

```bash
# Just note the import in app.module.ts
grep -n "ScheduleModule" apps/backend/src/app.module.ts
```

- [ ] **Step 3:** Verify current generators do NOT filter by site (this is the prerequisite gap)

Look for any `siteId` usage inside the two generator files. Expect: none for filtering.

- [ ] **Step 4:** Confirm user roles that exist

```bash
grep -A 20 "export enum UserRole" apps/backend/src/modules/users/enums/user-role.enum.ts
```

Expected roles include at minimum: ADMIN, MANAGER, AGENT, AGENT_ORACLE, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT.

- [ ] **Step 5:** Commit nothing yet (this is pure research)

---

### Task 1: Update Agent Performance Report Generator to Support Site + Category Filtering (Critical Prerequisite)

**Files:**
- Modify: `apps/backend/src/modules/reports/generators/agent-performance.report.ts`
- Test: `apps/backend/src/modules/reports/generators/agent-performance.report.spec.ts` (create if missing, or add tests)

**Interfaces:**
- Consumes: Existing DateRange interface.
- Produces: New optional second parameter. New public method signature:
  ```ts
  async generate(
    dateRange: DateRange,
    options?: { siteId?: string; agentCategory?: 'REGULAR' | 'ORACLE' | 'ALL' }
  ): Promise<ReportResult<AgentMetrics[]>>
  ```

- [ ] **Step 1:** Write a failing test that expects site filtering to work (create the test file if it does not exist)

Create `apps/backend/src/modules/reports/generators/agent-performance.report.spec.ts` with at least this skeleton + one test that will fail:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentPerformanceReport } from './agent-performance.report';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../../ticketing/entities/ticket.entity';

describe('AgentPerformanceReport (with site + category filter)', () => {
  let service: AgentPerformanceReport;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentPerformanceReport,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Ticket), useValue: {} },
      ],
    }).compile();

    service = module.get(AgentPerformanceReport);
  });

  it('should filter by siteId when provided', async () => {
    // This will fail until we implement filtering
    const result = await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw' }
    );
    // For now we just check it doesn't throw and shape is correct.
    expect(result.reportType).toBe('AGENT_PERFORMANCE');
  });
});
```

- [ ] **Step 2:** Run the test to confirm it fails (or at least the expectation around filtering is not yet implemented)

```bash
cd apps/backend
npm test -- agent-performance.report.spec.ts --watchAll=false 2>&1 | tail -30
```

- [ ] **Step 3:** Modify the `generate` method to accept the options and apply filters

Key changes inside the query builder:
- If `options?.siteId` is provided, add `.andWhere('ticket.siteId = :siteId', { siteId: options.siteId })`
- Join user and filter by role when `agentCategory` is provided:
  - 'REGULAR' → user.role IN (AGENT, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT)
  - 'ORACLE' → user.role = 'AGENT_ORACLE'
- Keep the rest of the logic intact.

Also update the priority breakdown query with the same site filter.

- [ ] **Step 4:** Run the test again and make sure the new test passes (basic shape)

```bash
npm test -- agent-performance.report.spec.ts --watchAll=false
```

- [ ] **Step 5:** Add one more concrete test that would catch cross-site leakage (use real-ish data mocking if possible, or at least assert the where clause contains site filter)

- [ ] **Step 6:** Commit

```bash
git add apps/backend/src/modules/reports/generators/agent-performance.report.ts apps/backend/src/modules/reports/generators/agent-performance.report.spec.ts
git commit -m "feat(reports): add siteId and agentCategory filtering to AgentPerformanceReport"
```

---

### Task 2: Update Ticket Volume Report to Support Site Filtering (Prerequisite)

**Files:**
- Modify: `apps/backend/src/modules/reports/generators/ticket-volume.report.ts`
- Test: Add or create tests for site filtering

**Interfaces:**
- Update `generate(dateRange, options?: { siteId?: string })`

- [ ] **Step 1:** Read the full ticket-volume.report.ts to see current queries

- [ ] **Step 2:** Add siteId filter to the main queries (daily, byPriority, byCategory, summary)

All queries must add:
```ts
if (options?.siteId) {
  qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
}
```

- [ ] **Step 3:** Write minimal test that passes siteId and expects no error + correct shape

- [ ] **Step 4:** Run tests

- [ ] **Step 5:** Commit

```bash
git commit -m "feat(reports): add siteId filtering support to TicketVolumeReport"
```

---

### Task 3: Update ReportsService Monthly Stats to Accept Optional Site Filter (for completeness)

**Files:**
- Modify: `apps/backend/src/modules/reports/reports.service.ts` (getMonthlyStats and any callers inside the module)

- [ ] **Step 1:** Change signature to accept optional siteId

```ts
async getMonthlyStats(month: number, year: number, siteId?: string)
```

- [ ] **Step 2:** Apply filter in the query builder if siteId is passed

- [ ] **Step 3:** Update the scheduled reports path later to pass it (this task just makes the method support it)

- [ ] **Step 4:** Add a quick unit test or integration smoke if possible

- [ ] **Step 5:** Commit

---

### Task 4: Create ScheduledReportConfig Entity

**Files:**
- Create: `apps/backend/src/modules/reports/entities/scheduled-report-config.entity.ts`

- [ ] **Step 1:** Create the file with the exact structure from the spec (include indexes, soft delete, targetAgentCategory enum)

Use proper imports and the existing patterns from other entities in the module (look at how other entities are written).

- [ ] **Step 2:** Make sure it references Site and User correctly (ManyToOne)

- [ ] **Step 3:** Verify it compiles

```bash
cd apps/backend
npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "scheduled-report-config" | head -5
```

- [ ] **Step 4:** Commit

```bash
git add apps/backend/src/modules/reports/entities/scheduled-report-config.entity.ts
git commit -m "feat(reports): add ScheduledReportConfig entity"
```

---

### Task 5: Create ScheduledReportExecution Entity

**Files:**
- Create: `apps/backend/src/modules/reports/entities/scheduled-report-execution.entity.ts`

- [ ] **Step 1:** Create entity with relationship back to ScheduledReportConfig (ManyToOne + Cascade delete on config side)

- [ ] **Step 2:** Add proper indexes on configId + executedAt

- [ ] **Step 3:** Compile check

- [ ] **Step 4:** Commit

---

### Task 6: Create DTOs for Scheduled Reports

**Files:**
- Create: `apps/backend/src/modules/reports/dto/create-scheduled-report-config.dto.ts`
- Create: `apps/backend/src/modules/reports/dto/update-scheduled-report-config.dto.ts`

- [ ] **Step 1:** Create Create DTO with class-validator decorators:
  - name: string (required)
  - reportType: enum
  - schedule: enum
  - sendTime: string, regex for HH:mm
  - siteId: UUID
  - recipientUserIds: string[] (min 1, each UUID)

- [ ] **Step 2:** Create Update DTO (all optional)

- [ ] **Step 3:** Add a small validation test file if time allows, or at least manual verification later

- [ ] **Step 4:** Commit

---

### Task 7: Create Database Migration for New Tables

**Files:**
- Create: `apps/backend/src/migrations/20260821-CreateScheduledReportTables.ts` (or use current timestamp style)

Use TypeORM migration class.

- [ ] **Step 1:** Generate the migration file with two tables:
  - scheduled_report_configs
  - scheduled_report_executions

Include all columns from the entities, foreign keys, indexes.

- [ ] **Step 2:** Run the migration locally in dev DB to verify it applies cleanly

```bash
cd apps/backend
npm run migration:run
```

- [ ] **Step 3:** Commit the migration file

---

### Task 8: Register New Entities and Module Wiring

**Files:**
- Modify: `apps/backend/src/modules/reports/reports.module.ts`

- [ ] **Step 1:** Import the two new entities into TypeOrmModule.forFeature

- [ ] **Step 2:** Import SchedulerRegistry (we will use it in the dynamic service)

Note: You may need to ensure ScheduleModule.forRoot() is already present in AppModule (it is).

- [ ] **Step 3:** Add the future controller and services (we will fill them in later tasks)

For now just make sure entities are registered so the migration and repo injection work.

- [ ] **Step 4:** Compile check

- [ ] **Step 5:** Commit

---

### Task 9: Create the Dynamic Scheduled Reports Service (Core Logic)

**Files:**
- Create: `apps/backend/src/modules/reports/generators/dynamic-scheduled-reports.service.ts`

**Key responsibilities:**
- Implements OnModuleInit / OnModuleDestroy
- Uses SchedulerRegistry to add/remove CronJob dynamically
- Builds cron from schedule + sendTime
- On run: load config, compute date range, call the right generator with siteId + category, validate recipients, generate Excel buffer, send per-recipient email, log execution.

- [ ] **Step 1:** Write the class skeleton with constructor injecting:
  - ScheduledReportConfig repository
  - ScheduledReportExecution repository
  - SchedulerRegistry
  - TicketVolumeReport
  - AgentPerformanceReport
  - ReportsService (for monthly)
  - MailDispatchService
  - User repository

- [ ] **Step 2:** Implement `getCronExpression(schedule, sendTime)`

- [ ] **Step 3:** Implement `computeDateRange(schedule)`

- [ ] **Step 4:** Implement `registerConfig` and `unregisterJob`

- [ ] **Step 5:** Implement the main `runReport(configId)` method with full try/catch + execution logging

Inside runReport:
- Load config
- If not active → unregister
- Generate buffer (call appropriate generator + pass siteId and targetAgentCategory when relevant)
- Load users by recipientUserIds
- Filter strictly: same site + active + correct role for the category
- For each valid recipient: send email with attachment (use MailDispatchService.send)
- Create and save ScheduledReportExecution
- Update lastRunAt only on non-fatal outcomes

- [ ] **Step 6:** Implement onModuleInit to load all active configs and register them

- [ ] **Step 7:** Add helper to build filename and subject

- [ ] **Step 8:** Make sure it compiles and has no obvious runtime errors on startup (we will test later)

- [ ] **Step 9:** Commit

```bash
git commit -m "feat(reports): implement DynamicScheduledReportsService with per-config cron and strict recipient validation"
```

---

### Task 10: Create the CRUD Service for Scheduled Report Configs

**Files:**
- Create: `apps/backend/src/modules/reports/services/scheduled-reports-crud.service.ts`

**Responsibilities:**
- list(actor, siteId?)
- create(actor, dto, createdById)
- findOne(actor, id)
- update(actor, id, dto)
- toggle(actor, id, isActive)
- remove(actor, id)
- triggerNow(actor, id) — only for ADMIN/MANAGER

Inside each method:
- Resolve effective site using existing site-scope utilities
- Enforce that non-cross-site actors cannot touch other sites' configs
- When creating/updating recipients, do basic validation that users exist (deeper validation happens at execution time)
- When changing schedule/sendTime/site/recipients on update → the controller will call unregister + re-register on the dynamic service

- [ ] **Step 1:** Implement list with proper site filtering

- [ ] **Step 2:** Implement create with site enforcement

- [ ] **Step 3:** Implement the rest of the methods

- [ ] **Step 4:** Add integration with dynamic scheduler (inject it and call register/unregister after create/update/toggle/remove)

- [ ] **Step 5:** Commit

---

### Task 11: Create the Scheduled Reports Controller

**Files:**
- Create: `apps/backend/src/modules/reports/presentation/scheduled-reports.controller.ts`

- [ ] **Step 1:** Wire the class with `@Controller('reports/scheduled')`, guards, and @PageAccess('reports')

- [ ] **Step 2:** Implement all endpoints from the spec:
  - GET /
  - POST /
  - GET /:id
  - PATCH /:id
  - PATCH /:id/toggle
  - DELETE /:id
  - POST /:id/trigger  (add explicit role check for ADMIN or MANAGER)

- [ ] **Step 3:** Use the CRUD service for all operations

- [ ] **Step 4:** For trigger, call a method that forces execution (you can add a `triggerNow` method on the dynamic service that runs the report logic synchronously for testing)

- [ ] **Step 5:** Add proper Swagger decorators

- [ ] **Step 6:** Compile and basic route check

- [ ] **Step 7:** Commit

---

### Task 12: Wire Everything in ReportsModule and App Startup

**Files:**
- Modify: `apps/backend/src/modules/reports/reports.module.ts`
- Modify (if needed): `apps/backend/src/app.module.ts` (confirm ScheduleModule.forRoot() is there — it should be)

- [ ] **Step 1:** Provide the new CRUD service and DynamicScheduledReportsService

- [ ] **Step 2:** Register the new controller

- [ ] **Step 3:** Make sure the dynamic service is instantiated so onModuleInit runs

- [ ] **Step 4:** Rebuild

```bash
cd apps/backend
npm run build
```

- [ ] **Step 5:** Commit

---

### Task 13: Add Execution History Endpoint (Optional but useful for UI)

**Files:**
- Modify controller + CRUD service to support listing executions for a config

- [ ] **Step 1:** Add GET /:id/executions

- [ ] **Step 2:** Implement in service with limit

- [ ] **Step 3:** Commit

---

### Task 14: Frontend — Add "Scheduled Reports" Tab to BentoReportsPage

**Files:**
- Modify: `apps/frontend/src/features/reports/pages/BentoReportsPage.tsx`

- [ ] **Step 1:** Add a new tab value 'scheduled'

- [ ] **Step 2:** Add the tab button in the tabs array

- [ ] **Step 3:** Create a basic section that shows loading + empty state + a "New Schedule" button (we will flesh out the list and form in next tasks)

- [ ] **Step 4:** Commit small UI scaffolding

---

### Task 15: Frontend — Fetch and Display List of Scheduled Configs

**Files:**
- Modify: BentoReportsPage.tsx (or extract a component later)

- [ ] **Step 1:** Add useQuery for `/reports/scheduled`

- [ ] **Step 2:** Display a simple table or cards with name, reportType, schedule, sendTime, site, isActive, lastRunAt

- [ ] **Step 3:** Add basic active/inactive badge

- [ ] **Step 4:** Commit

---

### Task 16: Frontend — Create/Edit Form (Modal or Drawer)

This is a bigger task. Break it if needed.

**Files:**
- You may create `apps/frontend/src/features/reports/components/ScheduledReportForm.tsx`

Key fields:
- name (text)
- reportType (select)
- schedule (select)
- sendTime (input type="time")
- siteId (select or locked)
- targetAgentCategory (conditional select, only for AGENT_PERFORMANCE)
- recipientUserIds (multi checkbox or multi select, grouped by regular vs oracle)

Data needs:
- Fetch agents for the selected site (reuse or call existing users endpoint with site filter + role filter)

- [ ] **Step 1:** Build the form UI with controlled state

- [ ] **Step 2:** Add conditional rendering for targetAgentCategory

- [ ] **Step 3:** Add recipient selection with grouping (two sections: Regular Agents, Oracle Agents)

- [ ] **Step 4:** Wire submit to POST or PATCH

- [ ] **Step 5:** After successful save, refetch list and close form

- [ ] **Step 6:** Commit

---

### Task 17: Frontend — Toggle, Edit, Delete, and Manual Trigger Actions

**Files:**
- Same page or form component

- [ ] **Step 1:** Add buttons in the list row for each action

- [ ] **Step 2:** Implement toggle (PATCH /toggle)

- [ ] **Step 3:** Implement delete (DELETE) with confirmation

- [ ] **Step 4:** Implement manual trigger (POST /trigger) — only show for ADMIN/MANAGER if possible via client role or just let backend reject

- [ ] **Step 5:** Show success toasts using existing toast pattern (sonner)

- [ ] **Step 6:** Commit

---

### Task 18: Frontend — Execution History View

**Files:**
- Add a modal or expandable section

- [ ] **Step 1:** On click "History", fetch executions for that config

- [ ] **Step 2:** Display table: executedAt, status, recipientsCount, emailsSent, errorMessage

- [ ] **Step 3:** Commit

---

### Task 19: Backend Integration Test — Site Isolation on CRUD

**Files:**
- Create or add to: `apps/backend/src/modules/reports/__tests__/scheduled-reports.site-isolation.spec.ts`

- [ ] **Step 1:** Write tests that:
  - A MANAGER from site A cannot create a config for site B
  - A MANAGER from site A can list only site A configs (or all if cross-site)
  - Trigger respects the same rules

Use the existing pattern from other site isolation tests in the project (see ticketing site isolation specs).

- [ ] **Step 2:** Run the test file

- [ ] **Step 3:** Commit

---

### Task 20: Backend Integration Test — Dynamic Scheduler + Execution Logging

**Files:**
- `apps/backend/src/modules/reports/__tests__/dynamic-scheduled-reports.spec.ts`

- [ ] **Step 1:** Create a config via the service

- [ ] **Step 2:** Call the internal runReport method (or expose a test trigger)

- [ ] **Step 3:** Assert that an execution record was created

- [ ] **Step 4:** Assert that recipient validation happened (wrong site users are excluded)

- [ ] **Step 5:** Run and make it pass

- [ ] **Step 6:** Commit

---

### Task 21: Deprecate / Disable Old Hardcoded ScheduledReportsService

**Files:**
- Modify: `apps/backend/src/modules/reports/generators/scheduled-reports.service.ts`

- [ ] **Step 1:** Add a big comment at the top: "DEPRECATED — replaced by DynamicScheduledReportsService + user configs. This file is kept temporarily for reference and will be removed after migration."

- [ ] **Step 2:** Comment out the @Cron methods (or guard them behind an env flag SCHEDULED_REPORTS_LEGACY_ENABLED=false by default)

- [ ] **Step 3:** Ensure the module still compiles

- [ ] **Step 4:** Commit with clear message

---

### Task 22: End-to-End Manual Verification Steps (for the implementer)

- [ ] **Step 1:** Start backend + frontend

- [ ] **Step 2:** As ADMIN or MANAGER, go to Reports → Scheduled Reports tab

- [ ] **Step 3:** Create a daily config for your site, choose Ticket Volume, pick 1-2 agents at the same site, set send time to a few minutes in the future

- [ ] **Step 4:** Wait for the time or use the manual trigger button

- [ ] **Step 5:** Verify:
  - The agents receive an email with the Excel attached
  - Only data from their site is in the report
  - An execution record appears in the history with status SUCCESS

- [ ] **Step 6:** Repeat for AGENT_PERFORMANCE with "Regular" and separately with "Oracle" — confirm the lists are different and correct

- [ ] **Step 7:** Try to create a config for another site as a non-cross-site user → should be rejected

- [ ] **Step 8:** Document any manual test results in a note or PR description

---

### Task 23: Final Polish, Cleanup, and Documentation

- [ ] Update any README or internal docs if the project has a "how to schedule reports" section

- [ ] Make sure error messages in the UI are user-friendly

- [ ] Remove any console.logs or debug code

- [ ] Run full backend test suite for the reports module

- [ ] Commit final state

---

**End of Plan**

After all tasks are complete and the manual verification in Task 22 succeeds, the feature is considered "sudah bekerja" (working).

Remember the user's goal: continue until the end and make sure it is actually working. Do not stop at "code written" — verify with real data and emails.