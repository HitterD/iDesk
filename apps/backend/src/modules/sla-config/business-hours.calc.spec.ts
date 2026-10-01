import {
    addBusinessMinutes,
    businessMinutesBetween,
    BusinessSchedule,
    endOfNextBusinessDay,
    isWithinBusinessHours,
    nextBusinessStart,
} from './business-hours.calc';

const schedule: BusinessSchedule = {
    workDays: [1, 2, 3, 4, 5],
    startTime: 480,
    endTime: 1020,
    timezone: 'Asia/Jakarta',
    holidays: ['2026-10-05'],
};

/** WIB wall-clock time -> Date (WIB is UTC+7, no DST). */
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe('business-hours.calc (Asia/Jakarta)', () => {
    // 2026-10-01 is a Thursday, 2026-10-03/04 the weekend, 2026-10-05 (Mon) a holiday.

    describe('isWithinBusinessHours', () => {
        it('is true inside 08:00-17:00 WIB on a weekday', () => {
            expect(isWithinBusinessHours(wib('2026-10-01T08:00:00'), schedule)).toBe(true);
            expect(isWithinBusinessHours(wib('2026-10-01T16:59:00'), schedule)).toBe(true);
        });

        it('is false outside hours, on weekends and on holidays', () => {
            expect(isWithinBusinessHours(wib('2026-10-01T07:59:00'), schedule)).toBe(false);
            expect(isWithinBusinessHours(wib('2026-10-01T17:00:00'), schedule)).toBe(false);
            expect(isWithinBusinessHours(wib('2026-10-03T10:00:00'), schedule)).toBe(false);
            expect(isWithinBusinessHours(wib('2026-10-05T10:00:00'), schedule)).toBe(false);
        });
    });

    describe('nextBusinessStart', () => {
        it('returns the same instant during working hours', () => {
            const at = wib('2026-10-01T10:15:00');
            expect(nextBusinessStart(at, schedule)).toEqual(at);
        });

        it('moves an evening ticket to 08:00 WIB the next working day', () => {
            expect(nextBusinessStart(wib('2026-10-01T20:00:00'), schedule)).toEqual(wib('2026-10-02T08:00:00'));
        });

        it('skips the weekend and a holiday', () => {
            expect(nextBusinessStart(wib('2026-10-02T17:30:00'), schedule)).toEqual(wib('2026-10-06T08:00:00'));
        });

        it('moves an early-morning ticket to 08:00 the same day', () => {
            expect(nextBusinessStart(wib('2026-10-01T06:00:00'), schedule)).toEqual(wib('2026-10-01T08:00:00'));
        });
    });

    describe('addBusinessMinutes', () => {
        it('adds within the same day', () => {
            expect(addBusinessMinutes(wib('2026-10-01T09:00:00'), 60, schedule)).toEqual(wib('2026-10-01T10:00:00'));
        });

        it('starts counting at the next opening for an off-hours start', () => {
            expect(addBusinessMinutes(wib('2026-10-01T22:00:00'), 60, schedule)).toEqual(wib('2026-10-02T09:00:00'));
        });

        it('carries the remainder over the weekend and holiday', () => {
            // Fri 16:00 + 120 min: 60 on Friday, 60 on Tue (Mon is a holiday).
            expect(addBusinessMinutes(wib('2026-10-02T16:00:00'), 120, schedule)).toEqual(wib('2026-10-06T09:00:00'));
        });

        it('ends exactly at closing time when the minutes run out', () => {
            expect(addBusinessMinutes(wib('2026-10-01T16:00:00'), 60, schedule)).toEqual(wib('2026-10-01T17:00:00'));
        });

        it('treats one working day as 540 minutes', () => {
            expect(addBusinessMinutes(wib('2026-10-01T08:00:00'), 540, schedule)).toEqual(wib('2026-10-01T17:00:00'));
            expect(addBusinessMinutes(wib('2026-10-01T08:00:00'), 541, schedule)).toEqual(wib('2026-10-02T08:01:00'));
        });

        it('returns the start for non-positive minutes', () => {
            const at = wib('2026-10-01T22:00:00');
            expect(addBusinessMinutes(at, 0, schedule)).toEqual(at);
        });

        it('falls back to wall-clock when the schedule has no working time', () => {
            const at = wib('2026-10-01T22:00:00');
            expect(addBusinessMinutes(at, 30, { ...schedule, workDays: [] })).toEqual(wib('2026-10-01T22:30:00'));
        });
    });

    describe('businessMinutesBetween', () => {
        it('counts only working minutes', () => {
            expect(businessMinutesBetween(wib('2026-10-02T16:00:00'), wib('2026-10-06T09:00:00'), schedule)).toBe(120);
        });

        it('is zero entirely outside hours', () => {
            expect(businessMinutesBetween(wib('2026-10-02T18:00:00'), wib('2026-10-05T23:00:00'), schedule)).toBe(0);
        });

        it('is the inverse of addBusinessMinutes', () => {
            const start = wib('2026-10-01T13:37:00');
            const end = addBusinessMinutes(start, 1500, schedule);
            expect(businessMinutesBetween(start, end, schedule)).toBe(1500);
        });

        it('is zero when end precedes start', () => {
            expect(businessMinutesBetween(wib('2026-10-02T10:00:00'), wib('2026-10-01T10:00:00'), schedule)).toBe(0);
        });
    });

    describe('endOfNextBusinessDay', () => {
        it('is 17:00 WIB of the next working day', () => {
            expect(endOfNextBusinessDay(wib('2026-10-01T00:00:00'), schedule)).toEqual(wib('2026-10-02T17:00:00'));
        });

        it('skips the weekend and holidays', () => {
            expect(endOfNextBusinessDay(wib('2026-10-02T00:00:00'), schedule)).toEqual(wib('2026-10-06T17:00:00'));
        });
    });
});
