# Implementation Plan - Zoom Recurring Booking Fix

Fix the Zoom recurring booking system to prevent infinite loops when `until` is omitted, enforce default bounds, and improve frontend recurring UI feedback.

## User Review Required
> [!NOTE]
> When `Berulang?` is turned on without an explicit `until` date, the system will default to 4 occurrences or 30 days maximum to prevent infinite date generation.

## Proposed Changes

### Backend

#### [MODIFY] [rrule.util.ts](file:///f:/Program%20Bagas/SynologyDrive/iDesk-main/apps/backend/src/modules/zoom-booking/utils/rrule.util.ts)
- Prevent infinite loops by enforcing `count` (default max 10/50) if neither `UNTIL` nor `COUNT` is present in `rruleStr`.
- Safely slice generated dates.

#### [MODIFY] [zoom-booking.service.ts](file:///f:/Program%20Bagas/SynologyDrive/iDesk-main/apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts)
- Enhance `createBooking` for recurring series to handle partial window errors cleanly and return all created bookings.

### Frontend

#### [MODIFY] [SimpleBookingForm.tsx](file:///f:/Program%20Bagas/SynologyDrive/iDesk-main/apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx)
- Automatically compute default `until` date (30 days from `bookingDate`) when `isRecurring` is active and `until` is empty.
- Add summary text showing how many meetings will be booked.
- Improve success toast to mention the number of meetings created.

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` on `apps/backend`.
- Run `npx tsc --noEmit` on `apps/frontend`.
- Run `npm run build` on `apps/frontend`.

### Manual Verification
- Test creating a recurring weekly booking and verify multiple records appear on the user's booking list.
