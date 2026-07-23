# Design Spec: Zoom Recurring Booking System Fix

**Date:** 2026-07-23  
**Status:** Approved by User  
**Goal:** Fix the Zoom recurring booking system so users can seamlessly create recurring Zoom meetings (Daily, Weekly, Monthly) with clear feedback and reliable date generation without infinite loops.

---

## 1. Problem Summary
1. **Infinite Loop in `RRuleUtil.generateDates`**: When no `UNTIL` or `COUNT` parameter is provided in the RRule string, `finalRule.all()` in the `rrule` JS package attempts to generate infinite occurrences. The callback `(d, i) => i < maxOccurrences` passed to `.all()` acts as a filter, not a loop terminator, causing Node.js to hang.
2. **Missing Default `UNTIL` Date**: In `SimpleBookingForm.tsx`, when users enable the recurring switch without selecting an optional end date (`until`), an unbounded RRule string (`FREQ=WEEKLY;INTERVAL=1`) is sent to the API.
3. **User Feedback**: Creating recurring bookings did not present a summary of how many occurrences would be generated or clear error messages when individual dates fell outside allowed booking windows.

---

## 2. Proposed Changes

### Backend Changes (`apps/backend`)

#### `apps/backend/src/modules/zoom-booking/utils/rrule.util.ts`
- Update `RRuleUtil.generateDates` to ensure `options.count` or `options.until` is always enforced.
- If neither `UNTIL` nor `COUNT` is present in `rruleStr`, enforce a default `count: 10` (or `maxOccurrences`, up to a hard cap of 50).
- Use `finalRule.all().slice(0, maxOccurrences)` or `finalRule.between()` safely to guarantee loop termination.

#### `apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts`
- Ensure `createBooking` handles recurring series cleanly.
- If some dates in the series fail (e.g., past advance booking limit or blocked), collect created bookings and log informative warning messages.
- Return appropriate success messaging for multi-booking series.

---

### Frontend Changes (`apps/frontend`)

#### `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`
- When `isRecurring` is active and `until` date is empty, default `until` to 30 days after `bookingDate` (or 4 occurrences).
- Display a clear preview text when recurring is enabled (e.g., *"Meeting ini akan dipesan secara berulang hingga 30 Agustus 2026"*).
- Enhance success message when `result` is an array of bookings (e.g., *"Berhasil membuat 4 jadwal Zoom berulang!"*).

---

## 3. Verification Plan
1. **Automated Verification**:
   - `npx tsc --noEmit` on backend and frontend.
   - `npm run build` on frontend.
2. **Manual Test Cases**:
   - Create a weekly recurring meeting starting today with default parameters (until empty). Verify 4-5 weekly occurrences are created and appear in `/client/zoom-calendar`.
   - Create a daily recurring meeting with a specific `until` date.
