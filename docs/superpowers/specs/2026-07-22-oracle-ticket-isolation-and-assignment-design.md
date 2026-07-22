# Design Specification: Oracle Ticket Isolation & Agent Role Assignment Restriction

**Date:** 2026-07-22  
**Status:** Approved  
**Topic:** Strictly separate Oracle/K2 tickets from general support tickets in lists and restrict agent assignment by role.

---

## 1. Overview & Problem Statement

Currently in iDesk:
1. When a user or admin creates an Oracle ticket (`ORACLE_REQUEST`), the ticket appears in both `/tickets/list` (General Tickets) and `/tickets/oracle-k2` (Oracle K2 Requests) for `ADMIN`, `MANAGER`, and `USER` roles.
2. In the ticket assignment dropdown (`Assigned To`), operational support agents can be selected for Oracle tickets, and Oracle agents can be selected for General support tickets. Furthermore, backend checks do not fully prevent cross-role assignment for general tickets.

---

## 2. Requirements & Goals

1. **Ticket List Separation:**
   - **General Tickets Page (`/tickets/list`, endpoint `/tickets/paginated`):** Must strictly exclude Oracle tickets (`ticketType === 'ORACLE_REQUEST'` OR `category === 'ORACLE_REQUEST'`) for **all roles** (USER, ADMIN, AGENT, MANAGER, AGENT_OPERATIONAL_SUPPORT, etc.), unless `ticketType === 'ORACLE_REQUEST'` is explicitly requested as a filter option.
   - **Oracle K2 Requests Page (`/tickets/oracle-k2`, endpoint `/tickets/paginated/oracle`):** Must strictly contain **only** Oracle tickets (`ticketType === 'ORACLE_REQUEST'` OR `category === 'ORACLE_REQUEST'`).

2. **Agent Assignment Role Isolation:**
   - **Oracle Tickets:** Can ONLY be assigned to agents with the `AGENT_ORACLE` role (or `ADMIN`). Non-Oracle agents (`AGENT_OPERATIONAL_SUPPORT`, `AGENT`, `AGENT_ADMIN`) CANNOT be assigned to Oracle tickets and cannot assign Oracle tickets.
   - **General Support Tickets:** Can ONLY be assigned to operational support agents (`AGENT_OPERATIONAL_SUPPORT`, `AGENT`, `AGENT_ADMIN`, `ADMIN`). `AGENT_ORACLE` CANNOT be assigned to General support tickets and cannot assign General support tickets.

---

## 3. Architecture & Data Flow Changes

### 3.1 Backend Changes

#### 1. `TicketQueryService` (`apps/backend/src/modules/ticketing/services/ticket-query.service.ts`)
- **`findAllPaginated`**:
  - Apply exclusion filter for Oracle tickets: `(ticket.ticketType != 'ORACLE_REQUEST' AND ticket.category != 'ORACLE_REQUEST')` for **all roles** by default when querying standard paginated tickets.
  - If `options.ticketType === 'ORACLE_REQUEST'` or `options.category === 'ORACLE_REQUEST'`, filter specifically for Oracle tickets.
- **`findAll`**:
  - Apply similar default filtering for non-paginated queries where appropriate.

#### 2. `UsersController` & `UserCrudService` (`apps/backend/src/modules/users/`)
- Update `getAgents(siteId?: string, callerRole?: UserRole, category?: string, ticketType?: string)`:
  - If `ticketType === 'ORACLE_REQUEST'` or `category === 'ORACLE_REQUEST'` or `callerRole === AGENT_ORACLE`, query agents with role `AGENT_ORACLE` (and `ADMIN`).
  - Otherwise (for general tickets), query operational agents (`AGENT_OPERATIONAL_SUPPORT`, `AGENT`, `AGENT_ADMIN`, `ADMIN`), explicitly **excluding** `AGENT_ORACLE`.

#### 3. `TicketUpdateService` (`apps/backend/src/modules/ticketing/services/ticket-update.service.ts`)
- Update `assignTicket(ticketId, assigneeId, userId)`:
  - Check if ticket is Oracle (`category === 'ORACLE_REQUEST'` OR `ticketType === 'ORACLE_REQUEST'`).
  - **If Oracle Ticket:** Enforce that target `assignee.role` MUST be `AGENT_ORACLE` or `ADMIN`, and `assigner.role` MUST be `AGENT_ORACLE` or `ADMIN`. Throw `ForbiddenException` if broken.
  - **If General Ticket:** Enforce that target `assignee.role` MUST NOT be `AGENT_ORACLE` (must be operational agent or ADMIN), and `assigner.role` MUST NOT be `AGENT_ORACLE`. Throw `ForbiddenException` / `BadRequestException` if broken.

### 3.2 Frontend Changes

#### 1. `BentoOracleK2TicketsPage.tsx`
- Pass `ticketType: 'ORACLE_REQUEST'` when fetching assignable agents via `/users/agents?ticketType=ORACLE_REQUEST`.

#### 2. `BentoTicketListPage.tsx` & `AssigneeSelect.tsx`
- Pass current ticket's `ticketType` / `category` when fetching assignable agents to ensure the dropdown list dynamically renders only valid candidates.

#### 3. `BentoMyTicketsPage.tsx`
- Ensure client-side filtering includes `t.ticketType !== 'ORACLE_REQUEST' && t.category !== 'ORACLE_REQUEST'` as a safeguard.

---

## 4. Verification Plan

1. **Unit & Integration Tests:**
   - Run NestJS backend unit tests for `ticket-query.service.spec.ts`, `ticket-update.service.spec.ts`, and `oracle-ticket-access.util.spec.ts`.
2. **Manual Verification:**
   - Create an Oracle ticket via Create Ticket page.
   - Verify it appears ONLY under `/tickets/oracle-k2` and NOT under `/tickets/list` or `/client/my-tickets`.
   - Verify `Assigned To` dropdown on `/tickets/oracle-k2` lists ONLY Oracle agents.
   - Verify `Assigned To` dropdown on `/tickets/list` lists ONLY Operational Support agents.
   - Verify backend throws ForbiddenException if cross-role assignment is attempted via API.
