# Hardware Installation Integration into Hardware Requests

**Date:** 2026-04-07
**Status:** Approved
**Approach:** Backend + Frontend (Pendekatan 2)

## Problem

Hardware Installation tickets (`ticketType: HARDWARE_INSTALLATION`) currently appear mixed with general service tickets in `/tickets/list`. They logically belong to the Hardware Request procurement flow and should be accessible from `/hardware-requests`.

## Solution Overview

**Hybrid approach:** Add an "Installation" tab to the Hardware Requests page for overview of all installations, AND show inline installation info in each Hardware Request card/detail page. Hardware Installation tickets remain visible in the tickets list with a visual highlight and navigation link to Hardware Requests.

## Design Decisions

| Aspect | Decision |
|--------|----------|
| Placement | Hybrid — Tab "Installation" + Inline in card/detail |
| Tab Layout | Table View (columns: Ticket, Hardware, Site, Status, Requester, Assigned To, Scheduled) |
| Click row in tab | Navigate to `/hardware-requests/:id` with installation section highlighted |
| Tickets list | Keep visible with row highlight (purple background + left border) + link "Lihat di Hardware Requests →" |
| Inline card list | Installation indicator badge ("🔧 2/3 installed") + next scheduled date |
| Inline detail page | Full "Installation Progress" section with per-item status cards |

## Backend Changes

### 1. New Endpoint: `GET /ict-budget/installations`

Paginated list of all hardware installation tickets across all ICT Budget requests. Used by the Installation tab.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `status` (string, optional: `TODO`, `IN_PROGRESS`, `RESOLVED`)
- `siteId` (string, optional)
- `search` (string, optional)

**Response:**
```json
{
  "data": [
    {
      "id": "ticket-uuid",
      "ticketNumber": "#b9fed8ee",
      "title": "Hardware Installation: PC AIO",
      "status": "IN_PROGRESS",
      "hardwareType": "PC",
      "scheduledDate": "2026-04-10",
      "scheduledTime": "08:00",
      "site": { "id": "...", "name": "SPJ" },
      "requester": { "id": "...", "name": "bagas" },
      "assignedTo": { "id": "...", "name": "IT-Admin" },
      "ictBudgetRequestId": "budget-uuid",
      "itemName": "PC AIO Dell"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Implementation:** Query `Ticket` entity where `ticketType = HARDWARE_INSTALLATION`, join with `IctBudgetRequest` via `linkedHwTicketId` or `InstallationSchedule.ticketId`, include site/user relations.

### 2. New Endpoint: `GET /ict-budget/:id/installations`

Return all hardware installation tickets for a specific ICT Budget request. Used by the detail page installation section.

**Response:**
```json
{
  "data": [
    {
      "id": "ticket-uuid",
      "ticketNumber": "#b9fed8ee",
      "title": "Hardware Installation: PC AIO",
      "status": "IN_PROGRESS",
      "hardwareType": "PC",
      "scheduledDate": "2026-04-10",
      "scheduledTime": "08:00",
      "assignedTo": { "id": "...", "name": "IT-Admin" },
      "itemIndex": 0,
      "itemName": "PC AIO Dell",
      "createdAt": "2026-04-03T..."
    }
  ],
  "total": 3,
  "installed": 1,
  "inProgress": 1,
  "scheduled": 1
}
```

**Implementation:** Query tickets linked to the ICT Budget request via `InstallationSchedule.ictBudgetRequestId` or by searching tickets where `isHardwareInstallation = true` and title/description references the request.

### 3. Extend `GET /ict-budget` Response

Add `installationSummary` field to each item in the paginated list response. Used by card list indicator.

**New field per item:**
```json
{
  "installationSummary": {
    "total": 3,
    "installed": 1,
    "inProgress": 1,
    "scheduled": 1,
    "nextScheduledDate": "2026-04-12"
  }
}
```

**Implementation:** Left join with installation tickets grouped by ICT Budget request ID, compute counts per status.

## Frontend Changes

### 1. Hardware Requests Page — Tab "Installation"

**File:** `apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx`

- Add "🔧 Installation" tab to existing tab bar (after Completed)
- Tab uses purple accent color (`#7c3aed`) to differentiate from procurement flow tabs
- When active, renders a table view fetching from `GET /ict-budget/installations`

**Sub-filters within tab:**
- All / Scheduled / In Progress / Completed (maps to ticket status)
- Search input
- Site filter dropdown

**Table columns:** Ticket (number + title), Hardware (type/name), Site, Status, Requester, Assigned To, Scheduled (date + time slot)

**Row click:** Navigate to `/hardware-requests/:ictBudgetRequestId` with `?highlight=installation` query param

**New component:** `InstallationTab.tsx` in `features/request-center/components/`

### 2. Hardware Request Card — Installation Indicator

**Files:**
- `apps/frontend/src/features/request-center/components/HardwareRequestCardItem.tsx`
- `apps/frontend/src/features/request-center/components/HardwareRequestListItem.tsx`

**Display logic:**
- If `installationSummary.total > 0` AND all installed → green badge "✅ X/X installed"
- If `installationSummary.total > 0` AND not all installed → purple badge "🔧 X/Y installed" + "Next: [date]"
- If `installationSummary.total === 0` or null → italic text "Belum ada instalasi" (only show on Arrived/Realized status)
- Don't show anything for Pending/Purchasing status

### 3. Hardware Request Detail Page — Installation Section

**File:** `apps/frontend/src/features/request-center/pages/HardwareRequestDetailPage.tsx`

**New section** after existing Items section:
- Header: "🔧 Installation Progress" with completion badge ("2/3 completed")
- Background: `#f8f6ff` (light purple) with border `#e0d9f7`
- Per-item cards with left border color by status:
  - Green (`#16a34a`) = Completed
  - Blue (`#2563eb`) = In Progress
  - Yellow (`#d97706`) = Scheduled
- Each card shows: item name, ticket number, assigned to, scheduled date/time
- Fetches from `GET /ict-budget/:id/installations`
- Auto-scroll to this section when `?highlight=installation` query param is present

**New component:** `InstallationProgressSection.tsx` in `features/request-center/components/`

### 4. Tickets List — Row Highlight

**Files:**
- `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`
- `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx` (or equivalent row component)

**Row treatment for `isHardwareInstallation === true`:**
- Background: `#f5f3ff`
- Border-left: `3px solid #7c3aed`
- Add link below title: "🔧 Lihat di Hardware Requests →" in color `#6d28d9`
- Link navigates to `/hardware-requests/:ictBudgetRequestId`
- `ictBudgetRequestId` is resolved by extending `GET /tickets/paginated` response to include this field when `ticketType === HARDWARE_INSTALLATION`. This avoids extra API calls per row.

### 5. New API Hook

**File:** `apps/frontend/src/features/request-center/api/ict-budget.api.ts`

Add hooks:
- `useIctBudgetInstallations(params)` — for tab Installation table
- `useIctBudgetRequestInstallations(id)` — for detail page installation section

## Data Flow

```
Hardware Request Created (ICT_BUDGET ticket)
  → Purchasing → Items Arrive
  → Request Installation for each item
    → Creates HARDWARE_INSTALLATION ticket
    → Creates InstallationSchedule
    → Links via InstallationSchedule.ictBudgetRequestId

Tab "Installation":
  GET /ict-budget/installations → Table of all HW installation tickets

Card List Indicator:
  GET /ict-budget (extended) → installationSummary per request

Detail Page Section:
  GET /ict-budget/:id/installations → Per-item installation status

Tickets List Badge:
  GET /tickets/paginated (extended) → ictBudgetRequestId for HW tickets
  → Row highlight + link to /hardware-requests/:ictBudgetRequestId
```

## Color System

| Element | Color | Hex |
|---------|-------|-----|
| Installation accent | Purple | `#7c3aed` |
| Row/section background | Light purple | `#f5f3ff` / `#f8f6ff` |
| Badge background | Lighter purple | `#ede9fe` |
| Badge text | Dark purple | `#6d28d9` |
| Link text | Dark purple | `#6d28d9` |
| Border (section) | Muted purple | `#e0d9f7` |
| Status: Scheduled | Yellow | `#d97706` bg `#fef3c7` |
| Status: In Progress | Blue | `#1e40af` bg `#dbeafe` |
| Status: Completed | Green | `#166534` bg `#dcfce7` |

## Files to Create

1. `apps/frontend/src/features/request-center/components/InstallationTab.tsx`
2. `apps/frontend/src/features/request-center/components/InstallationProgressSection.tsx`

## Files to Modify

### Backend
1. `apps/backend/src/modules/ict-budget/ict-budget.controller.ts` — add 2 new endpoints
2. `apps/backend/src/modules/ict-budget/ict-budget.service.ts` — add query methods
3. `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` — extend paginated response
4. `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` — include ictBudgetRequestId

### Frontend
5. `apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx` — add Installation tab
6. `apps/frontend/src/features/request-center/pages/HardwareRequestDetailPage.tsx` — add installation section
7. `apps/frontend/src/features/request-center/components/HardwareRequestCardItem.tsx` — add indicator
8. `apps/frontend/src/features/request-center/components/HardwareRequestListItem.tsx` — add indicator
9. `apps/frontend/src/features/request-center/api/ict-budget.api.ts` — add new hooks
10. `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` — row highlight logic
11. `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx` — row highlight styling + link
