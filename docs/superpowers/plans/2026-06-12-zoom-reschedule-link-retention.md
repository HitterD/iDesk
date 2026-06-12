# Zoom Reschedule Link Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the backend and frontend reschedule logic so that Zoom Meeting Links and IDs remain identical when a booking is rescheduled, by strictly enforcing the same zoomAccountId and updating the Zoom Meeting rather than recreating it.

**Architecture:** We will disable the "Auto-Switch Account" behavior ONLY during the reschedule flow. The backend will use `PATCH /meetings/:id` and fail if there's a conflict on the specific account. The frontend will only check calendar availability against the specific `zoomAccountId` of the booking being rescheduled, disabling slots where this specific account is unavailable.

**Tech Stack:** React (Frontend), NestJS/TypeORM (Backend), Zoom API

---

### Task 1: Backend - Strictly Update Zoom Meeting Instead of Recreating

**Files:**
- Modify: `d:\iDesk-main\apps\backend\src\modules\zoom-booking\services\zoom-booking.service.ts`

- [ ] **Step 1: Fix the catch block in rescheduleBooking**

In `zoom-booking.service.ts`, inside the `rescheduleBooking` method's `try...catch` block around the zoom API update.

Find:
```typescript
                    } catch (error: any) {
                        if (this.zoomApi.isScopeError(error)) {
                            await this.zoomApi.deleteMeeting(booking.meeting.zoomMeetingId);
                            const account = booking.zoomAccount;
                            // ... recreates meeting logic ...
```

Modify to:
```typescript
                    } catch (error: any) {
                        if (this.zoomApi.isScopeError(error)) {
                            // If it's a scope error, we still don't want to change the link.
                            // We throw an error instead of recreating the meeting.
                            throw new ConflictException('Gagal mengubah jadwal Zoom (Zoom Meeting API Scope Error). Silakan hubungi administrator.');
                        }
                        this.logger.error(`Failed to update Zoom meeting: ${error.message}`, error.stack);
                        throw new BadRequestException('Gagal mengubah jadwal di platform Zoom');
                    }
```

*Note: The backend `rescheduleBooking` already contains logic to check `bookingRepo.find({ where: { zoomAccountId: booking.zoomAccountId } })` which throws a `ConflictException` if there's a conflict. This inherently forces strict account retention.*

### Task 2: Frontend - Filter Availability by Current Zoom Account

**Files:**
- Modify: `d:\iDesk-main\apps\frontend\src\features\zoom-booking\components\ZoomRescheduleView.tsx`

- [ ] **Step 1: Verify hook usage**

In `ZoomRescheduleView.tsx`, the `useZoomCalendar` hook is already used like this:
```typescript
    const { data: calendarData } = useZoomCalendar(
        booking.zoomAccountId,
        dateRange.start,
        dateRange.end
    );
```
Since `zoomAccountId` is passed to the calendar API, the API returns availability specific to this account. So the UI already disables slots where *this specific account* is busy.

- [ ] **Step 2: Add visual clarity in the UI**

Add a small warning text below the Date and Time fields to remind users why some slots might be blocked.

Find the `return` statement in `ZoomRescheduleView.tsx` and after the `Time` selection block, add:
```tsx
            {/* Warning block */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-xs mt-4">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                    Waktu yang tersedia disesuaikan dengan ketersediaan akun Zoom saat ini untuk memastikan <b>Link Zoom tidak berubah</b>.
                </p>
            </div>
```

### Task 3: Test and Verify

- [ ] **Step 1: Test Rescheduling a Booking**

Run the backend and frontend. Attempt to reschedule a Zoom booking to a time where the same account is free. Verify the link remains the same. Then, attempt to reschedule to a time where it is busy (if you can simulate that) to verify the UI blocks it or the backend rejects it.
