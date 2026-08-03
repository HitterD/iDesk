import type { CalendarDay, CalendarSlot } from '../types';
import type { MergedCalendarDay, MergedCalendarSlot } from '../hooks/useZoomBooking';

/**
 * Convert a merged (Gabungan) calendar day into the legacy `CalendarDay` shape
 * the existing Week/Day/Month views understand. Each merged slot becomes one
 * `CalendarSlot` per owning-account booking — preserving the visible cap (4) and
 * the overflow counter so the existing `processBookingsForDayV2` + popover flow
 * keeps working without view-level changes.
 *
 * The first booking in a slot becomes `slot.booking` (singular, used by views).
 * The remaining visible bookings are kept in `slot.extraBookings` and the
 * overflow count is preserved as `slot.overflowCount`.
 */
export function mergedDayToCalendarDay(day: MergedCalendarDay): CalendarDay {
    return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        isWorkingDay: day.isWorkingDay,
        isBlocked: day.isBlocked,
        slots: day.slots.map(mergedSlotToCalendarSlot),
    };
}

function mergedSlotToCalendarSlot(slot: MergedCalendarSlot): CalendarSlot {
    const first = slot.bookings[0];
    const rest = slot.bookings.slice(1);
    return {
        date: slot.date,
        time: slot.time,
        endTime: slot.endTime,
        // Keep 'available' / 'blocked' / 'external' as-is; collapse 'my_booking'
        // semantics into the singular `booking` for downstream rendering.
        status: slot.status === 'my_booking' ? 'my_booking' : slot.status,
        booking: first
            ? {
                  id: first.id,
                  title: first.title,
                  bookedBy: first.bookedBy,
                  durationMinutes: first.durationMinutes,
                  startTime: first.startTime,
                  endTime: first.endTime,
                  isExternal: first.isExternal,
                  joinUrl: first.joinUrl,
              }
            : undefined,
        // Carry overflow + extra bookings for components that need them
        // (e.g. ZoomOverflowPopover). `CalendarSlot` doesn't declare these but
        // existing code (ZoomWeekView / ZoomOverflowPopover) reads them via
        // runtime checks — see processBookingsForDayV2 in ZoomCalendarGrid.
        // Cast to the broader merged-slot type so downstream consumers can
        // branch on `isMyBooking` / `extraBookings` without TS complaints.
        ...({
            extraBookings: rest,
            overflowCount: slot.bookingsOverflow + rest.length,
            isMyBooking: slot.isMyBooking,
        } as Partial<MergedCalendarSlot>),
    } as CalendarSlot;
}

/**
 * Normalize an array of merged days to legacy CalendarDay[].
 */
export function mergedCalendarToCalendar(
    days: MergedCalendarDay[] | undefined,
): CalendarDay[] | undefined {
    if (!days) return undefined;
    return days.map(mergedDayToCalendarDay);
}