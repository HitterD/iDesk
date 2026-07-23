# Design Spec: Zoom Calendar Admin & Agent Operational Support Control (Reschedule & Cancel)

Date: 2026-07-23  
Status: Approved  

---

## 1. Goal Description
Enable Admin, Operational Support Agents, and other management staff roles (`ADMIN`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ADMIN`, `AGENT_ORACLE`, `AGENT`, `MANAGER`) to inspect, reschedule, and cancel any Zoom booking directly from the Zoom Calendar interface (`/client/zoom-calendar`), regardless of who created the original booking.

---

## 2. Requirements & Permissions Matrix

### Staff Roles Definition
The following roles are classified as **Staff Manager Roles**:
- `ADMIN`
- `AGENT_OPERATIONAL_SUPPORT`
- `AGENT_ADMIN`
- `AGENT_ORACLE`
- `AGENT`
- `MANAGER`

### Permission Rules
- **Owner User (`USER` role)**: Can reschedule and cancel only their own bookings (`bookedByUserId === userId`).
- **Staff Manager Roles**: Can reschedule and cancel **ANY** booking across all Zoom accounts, regardless of `bookedByUserId`.

---

## 3. Architecture & Component Changes

### A. Backend (`apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts`)
1. Create a helper function `isStaffOrOwner(userRole?: string, ownerId?: string, currentUserId?: string): boolean`:
   - Returns `true` if `userRole` is in `STAFF_ROLES` or if `ownerId === currentUserId`.
2. Update `rescheduleBooking`:
   - Allow execution if `isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)` is `true`.
3. Update `performCancellation`:
   - Allow execution if `isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)` is `true`.

### B. Frontend (`apps/frontend/src/features/zoom-booking/components/BookingDetailsModal.tsx`)
1. Update permission calculation:
   ```typescript
   const isStaff = user?.role && STAFF_ROLES.includes(user.role);
   const canManage = (isOwner || isStaff) && !isCancelled && !isExternal;
   ```
2. Render action buttons when `canManage` is `true`:
   - Render **Reschedule** button (opens `RescheduleModal` for the target booking).
   - Render **Batalkan** button (opens `CancelBookingModal` for the target booking).

### C. Frontend (`apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`)
1. Update `isPastBooking` and permission check for `BookingCard`:
   - Allow staff roles (`isStaff`) to see **Reschedule** and **Batal** action buttons on any booking card.

---

## 4. Verification Plan
1. **TypeScript Typecheck**:
   - `npx tsc --noEmit` in `apps/backend` and `apps/frontend`.
2. **Production Build**:
   - `npm run build` in `apps/frontend`.
3. **Behavioral Verification**:
   - Verify non-owner user cannot manage other users' bookings.
   - Verify `AGENT_OPERATIONAL_SUPPORT` and `ADMIN` can reschedule and cancel any user's booking via modal and list view.
