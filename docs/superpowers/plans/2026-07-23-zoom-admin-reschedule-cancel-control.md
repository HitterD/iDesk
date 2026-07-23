# Zoom Admin & Agent Operational Support Control (Reschedule & Cancel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Admin, Operational Support Agents, and other staff manager roles (`ADMIN`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ADMIN`, `AGENT_ORACLE`, `AGENT`, `MANAGER`) to reschedule and cancel any Zoom meeting directly from the Zoom Calendar page and booking detail modal.

**Architecture:** Update backend service permission checks (`zoom-booking.service.ts`) to validate staff roles alongside booking ownership. Update frontend permission logic in `BookingDetailsModal.tsx` and `ZoomMyBookingsView.tsx` so staff users see and can trigger Reschedule and Cancel buttons for any booking.

**Tech Stack:** NestJS, TypeORM, React 18, TypeScript, TailwindCSS, date-fns.

---

### Task 1: Update Backend Authorization for Reschedule & Cancel

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts`

- [ ] **Step 1: Define staff role permissions helper in ZoomBookingService**

```typescript
const STAFF_ROLES: string[] = [
    UserRole.ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT,
    UserRole.MANAGER,
];

private isStaffOrOwner(userRole?: string, ownerId?: string, currentUserId?: string): boolean {
    if (userRole && STAFF_ROLES.includes(userRole)) {
        return true;
    }
    return ownerId === currentUserId;
}
```

- [ ] **Step 2: Update rescheduleBooking permission check**

In `rescheduleBooking`:
```typescript
if (!this.isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)) {
    throw new ForbiddenException('You can only reschedule your own bookings');
}
```

- [ ] **Step 3: Update performCancellation permission check**

In `performCancellation`:
```typescript
if (mode === 'owner' && !this.isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)) {
    throw new ForbiddenException('You can only cancel your own bookings');
}
```

- [ ] **Step 4: Verify backend compilation**

Run: `npx tsc --noEmit -p tsconfig.json` inside `apps/backend`
Expected: PASS with 0 errors

- [ ] **Step 5: Commit backend changes**

```bash
git add apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts
git commit -m "feat(zoom-booking): allow staff manager roles to reschedule and cancel any booking"
```

---

### Task 2: Update Frontend Permission Checks & Detail Modal Controls

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`

- [ ] **Step 1: Update BookingDetailsModal permission & action buttons**

In `BookingDetailsModal.tsx`:
```typescript
const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

const isStaff = user?.role && STAFF_ROLES.includes(user.role);
const canManage = (isOwner || isStaff) && !isCancelled && !isExternal;
```

Render **Reschedule** and **Batalkan** buttons in `BookingDetailsModal` when `canManage` is true.

- [ ] **Step 2: Update ZoomMyBookingsView permission check for card actions**

In `ZoomMyBookingsView.tsx`:
```typescript
const { user } = useAuth();
const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

const isStaff = user?.role && STAFF_ROLES.includes(user.role);
const canManageCard = (!isPastBooking && status !== 'CANCELLED') && (isOwner || isStaff);
```

- [ ] **Step 3: Verify frontend typecheck & production build**

Run: `npx tsc --noEmit -p tsconfig.json` inside `apps/frontend`
Expected: PASS with 0 errors

Run: `npm run build` inside `apps/frontend`
Expected: PASS

- [ ] **Step 4: Commit frontend changes**

```bash
git add apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx
git commit -m "feat(zoom-booking): show reschedule and cancel actions for staff manager roles in modal and card views"
```
