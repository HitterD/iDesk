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
export function mergedDayToCalendarDay(
    day: MergedCalendarDay,
    filteredAccountIds?: Set<string>,
): CalendarDay {
    return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        isWorkingDay: day.isWorkingDay,
        isBlocked: day.isBlocked,
        slots: day.slots.map((slot) => mergedSlotToCalendarSlot(slot, filteredAccountIds)),
    };
}

function mergedSlotToCalendarSlot(
    slot: MergedCalendarSlot,
    filteredAccountIds?: Set<string>,
): CalendarSlot {
    const applicableBookings = filteredAccountIds
        ? slot.bookings.filter((b) => filteredAccountIds.has(b.zoomAccountId))
        : slot.bookings;

    const first = applicableBookings[0];
    const rest = applicableBookings.slice(1);
    const hasBookings = Boolean(first);

    return {
        date: slot.date,
        time: slot.time,
        endTime: slot.endTime,
        status: hasBookings
            ? slot.status === 'my_booking'
                ? 'my_booking'
                : slot.status
            : 'available',
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
                  zoomAccountId: first.zoomAccountId,
                  zoomAccount: {
                      id: first.zoomAccountId,
                      colorHex: first.accountColorHex,
                  },
              }
            : undefined,
        ...({
            extraBookings: rest.map((r) => ({
                id: r.id,
                title: r.title,
                bookedBy: r.bookedBy,
                durationMinutes: r.durationMinutes,
                startTime: r.startTime,
                endTime: r.endTime,
                isExternal: r.isExternal,
                joinUrl: r.joinUrl,
                zoomAccountId: r.zoomAccountId,
                zoomAccount: {
                    id: r.zoomAccountId,
                    colorHex: r.accountColorHex,
                },
            })),
            overflowCount: filteredAccountIds ? rest.length : slot.bookingsOverflow + rest.length,
            isMyBooking: slot.isMyBooking,
        } as Partial<MergedCalendarSlot>),
    } as CalendarSlot;
}

/**
 * Normalize an array of merged days to legacy CalendarDay[].
 */
export function mergedCalendarToCalendar(
    days: MergedCalendarDay[] | undefined,
    filteredAccountIds?: Set<string>,
): CalendarDay[] | undefined {
    if (!days) return undefined;
    return days.map((d) => mergedDayToCalendarDay(d, filteredAccountIds));
}