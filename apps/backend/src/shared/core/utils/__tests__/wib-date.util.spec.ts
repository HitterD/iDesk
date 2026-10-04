import {
    wibDateRange,
    wibDateSql,
    wibEndOfDate,
    wibStartOfDate,
    wibStartOfMonth,
    wibStartOfToday,
    wibStartOfWeek,
    wibMonthRange,
} from '../wib-date.util';

describe('wib-date util', () => {
    it('turns a date-only string into whole WIB days', () => {
        expect(wibStartOfDate('2026-10-04').toISOString()).toBe('2026-10-03T17:00:00.000Z');
        expect(wibEndOfDate('2026-10-04').toISOString()).toBe('2026-10-04T16:59:59.999Z');
    });

    it('keeps a same-day "Today" range non-empty', () => {
        const { start, end } = wibDateRange('2026-10-04', '2026-10-04');
        // 05:00 WIB on Oct 4 (22:00 UTC Oct 3) must be inside "today".
        const earlyMorning = new Date('2026-10-03T22:00:00.000Z');
        expect(earlyMorning >= start && earlyMorning <= end).toBe(true);
    });

    it('passes full ISO timestamps through unchanged', () => {
        expect(wibStartOfDate('2026-10-04T10:00:00.000Z').toISOString()).toBe('2026-10-04T10:00:00.000Z');
    });

    it('computes today / week / month starts in WIB', () => {
        // 01:00 WIB Monday Oct 5 2026 = 18:00 UTC Sunday Oct 4.
        const at = new Date('2026-10-04T18:00:00.000Z');
        expect(wibStartOfToday(at).toISOString()).toBe('2026-10-04T17:00:00.000Z');
        expect(wibStartOfWeek(at).toISOString()).toBe('2026-10-04T17:00:00.000Z');
        expect(wibStartOfMonth(at).toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });

    it('builds a WIB date SQL expression', () => {
        expect(wibDateSql('ticket."createdAt"')).toBe(`DATE(ticket."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')`);
    });
});

describe('wibMonthRange', () => {
    it('covers the whole WIB month including the last second', () => {
        const { startDate, endDate } = wibMonthRange(2026, 12);
        expect(startDate.toISOString()).toBe('2026-11-30T17:00:00.000Z');
        expect(endDate.toISOString()).toBe('2026-12-31T16:59:59.999Z');
    });
});
