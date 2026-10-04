import { addDaysToDateStr, wibNow } from '../zoom-booking.service';

describe('zoom booking WIB clock', () => {
    // 14:00 WIB = 07:00 UTC. The old UTC clock said 07:00, so a 08:00-13:00 meeting looked upcoming.
    it('reads date and minutes on the WIB wall clock', () => {
        expect(wibNow(new Date('2026-10-04T07:00:00.000Z'))).toEqual({ dateStr: '2026-10-04', timeStr: '14:00', minutes: 840 });
    });

    it('rolls the date at WIB midnight, not UTC midnight', () => {
        expect(wibNow(new Date('2026-10-03T18:30:00.000Z')).dateStr).toBe('2026-10-04');
    });

    it('adds calendar days across a month end', () => {
        expect(addDaysToDateStr('2026-10-30', 3)).toBe('2026-11-02');
    });
});
