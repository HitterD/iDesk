# Workload Dashboard Auto-Refresh Design

## Goal
Make the `AdminWorkloadDashboard` auto-refresh in real-time when ticket workloads change, eliminating the need for manual browser reloads.

## Background
Currently, the Admin Workload Dashboard only fetches workload data upon component mount or when the `activeSiteId` changes. The backend already emits a WebSocket event `dashboard:stats:update` via `EventsGateway` whenever a ticket is created, updated, assigned, cancelled, or bulk updated.

## Proposed Changes (Option A: WebSocket Listener)

We will integrate the existing `useSocket` hook into the `AdminWorkloadDashboard` component to listen for the `dashboard:stats:update` event.

### Implementation Details
**File:** `apps/frontend/src/features/manager/pages/AdminWorkloadDashboard.tsx`

1. **Import Socket Hook:** Import `useSocket` from `@/lib/socket`.
2. **Initialize Socket:** Call `const { socket } = useSocket();` inside the component.
3. **Event Listener Effect:** Add a new `useEffect` that listens for the `dashboard:stats:update` event.
4. **Trigger Refetch:** When the event is received, check if `activeSiteId` is set, and if so, invoke the existing `fetchWorkloads()` function. This will fetch the latest aggregated points from the backend without full page reload.
5. **Cleanup:** Ensure `socket.off()` is called on component unmount or re-render to prevent memory leaks and duplicate listeners.

## Data Flow
1. Backend updates ticket and recalculates workload.
2. Backend `EventsGateway` emits `dashboard:stats:update`.
3. Frontend `useSocket` receives the event.
4. Frontend `useEffect` triggers `fetchWorkloads()`.
5. Frontend calls `workloadApi.getAllAgentWorkloads(activeSiteId)`.
6. Dashboard state updates with fresh data seamlessly.
