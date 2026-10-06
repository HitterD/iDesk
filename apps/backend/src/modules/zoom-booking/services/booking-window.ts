import { ZoomSettings } from '../entities/zoom-settings.entity';

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Zoom can be booked at any time on any day; a meeting only has to end the same day.
 * Stored office hours/working days (e.g. 08:00-17:00, Mon-Fri) used to block bookings
 * outside them, so they are overridden here. Blocked dates (holidays) still apply.
 */
export const OPEN_BOOKING_WINDOW = {
    slotStartTime: '00:00',
    slotEndTime: '23:59',
    workingDays: ALL_WEEKDAYS,
} as const;

export const withOpenBookingWindow = (settings: ZoomSettings): ZoomSettings => ({
    ...settings,
    slotStartTime: OPEN_BOOKING_WINDOW.slotStartTime,
    slotEndTime: OPEN_BOOKING_WINDOW.slotEndTime,
    workingDays: [...OPEN_BOOKING_WINDOW.workingDays],
});
