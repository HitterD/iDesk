# Workload Points Recalculation Fix Design

## Goal
Fix the bug where Agent Workload Points (Scoring) show as 0 or are out of sync with their actual active tickets in the `AdminWorkloadDashboard`.

## Background
Currently, the `AgentDailyWorkload` points are only recalculated when a ticket is manually assigned (`assignTicket`) or auto-assigned. When a ticket's status is changed (e.g., from `TODO` to `RESOLVED` or vice versa), its priority is modified, or it is cancelled, the workload points are not synchronized in real-time. This leads to agents appearing to have 0 workload points despite having active tickets, which breaks the auto-assignment logic.

## Proposed Changes (Option A: Direct Recalculation)

We will implement direct recalculation in `TicketUpdateService` to ensure `WorkloadService` is always notified of changes that affect ticket scoring.

### Components

**1. `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`**

We will update the following methods to call `this.workloadService.recalculateAgentWorkload(assigneeId, siteId)`:

- `postUpdateActions()`: Ensure that any update to an assigned ticket (especially status or priority changes) triggers a workload recalculation for the assignee.
- `cancelTicket()`: Ensure that cancelling an assigned ticket recalculates the assignee's workload to drop the cancelled ticket's points.
- `bulkUpdate()`: After a bulk update completes successfully, gather all unique affected agents and recalculate their workload points.

**2. `apps/backend/src/modules/workload/workload.service.ts`**

- Ensure `recalculateAgentWorkload` handles edge cases robustly (e.g., when called frequently). It already filters out `RESOLVED` and `CANCELLED` tickets and calculates total points based on current `PriorityWeight`s.
- `onTicketStatusChange` method in `WorkloadService` can be kept as-is or deprecated if `recalculateAgentWorkload` supersedes it, but no changes are strictly necessary here since the manual trigger ensures accuracy.

## Data Flow
1. User/Admin updates ticket (Status, Priority, etc.).
2. `TicketUpdateService` processes the change and saves the `Ticket`.
3. `TicketUpdateService` identifies if the ticket is assigned to an agent.
4. `TicketUpdateService` invokes `WorkloadService.recalculateAgentWorkload(agentId, siteId)`.
5. `WorkloadService` aggregates the weights of all open tickets for that agent and updates `AgentDailyWorkload.totalPoints`.
6. Dashboard fetches the accurate `totalPoints`.

## Error Handling
The recalculation calls will be wrapped in `try-catch` blocks to ensure that if a workload recalculation fails for any reason, the primary ticket operation (update/cancel) still succeeds without rolling back. Errors will be logged via `Logger`.
