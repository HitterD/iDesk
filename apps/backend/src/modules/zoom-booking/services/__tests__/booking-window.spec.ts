import { withOpenBookingWindow, OPEN_BOOKING_WINDOW } from '../booking-window';
import { ZoomSettings } from '../../entities/zoom-settings.entity';

describe('withOpenBookingWindow', () => {
    // Stored settings restricted bookings to office hours/weekdays; bookings must be
    // possible at any time on any day, ending before midnight.
    it('opens every day and the full 24h regardless of stored settings', () => {
        const stored = {
            slotStartTime: '08:00:00',
            slotEndTime: '17:00:00',
            workingDays: [1, 2, 3, 4, 5],
            blockedDates: ['2026-12-25'],
            slotIntervalMinutes: 30,
        } as ZoomSettings;

        const result = withOpenBookingWindow(stored);

        expect(result.slotStartTime).toBe('00:00');
        expect(result.slotEndTime).toBe('23:59');
        expect(result.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(result.blockedDates).toEqual(['2026-12-25']);
        expect(result.slotIntervalMinutes).toBe(30);
        expect(stored.slotEndTime).toBe('17:00:00');
    });

    it('exposes the window as constants', () => {
        expect(OPEN_BOOKING_WINDOW.slotEndTime).toBe('23:59');
    });
});
