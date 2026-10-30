import { BusinessSchedule, localDateKey, openingOfBusinessDay, startOfLocalDay } from '../sla-config/business-hours.calc';
import { countsTowardsWorkload, installActivationAt } from './install-day.util';
import { workloadDay } from './workload.service';

const schedule: BusinessSchedule = {
    workDays: [1, 2, 3, 4, 5],
    startTime: 480,
    endTime: 1020,
    timezone: 'Asia/Jakarta',
    holidays: ['2026-10-05'],
};

/** WIB wall-clock time -> Date (WIB is UTC+7, no DST). */
const wib = (iso: string) => new Date(`${iso}+07:00`);

// 2026-10-01 is a Thursday, 2026-10-03/04 the weekend, 2026-10-05 (Mon) a holiday.
describe('install-day workload rule', () => {
    describe('calendar helpers', () => {
        it('startOfLocalDay is 00:00 WIB, even when UTC is still the previous day', () => {
            expect(startOfLocalDay(wib('2026-10-01T05:00:00'))).toEqual(wib('2026-10-01T00:00:00'));
        });

        it('localDateKey uses the WIB date', () => {
            expect(localDateKey(wib('2026-10-01T02:00:00'))).toBe('2026-10-01');
        });

        it('openingOfBusinessDay is 08:00 of the same working day, any time of that day', () => {
            expect(openingOfBusinessDay(wib('2026-10-01T14:00:00'), schedule)).toEqual(wib('2026-10-01T08:00:00'));
            expect(openingOfBusinessDay(wib('2026-10-01T19:00:00'), schedule)).toEqual(wib('2026-10-01T08:00:00'));
        });

        it('openingOfBusinessDay rolls a weekend/holiday to the next working day', () => {
            expect(openingOfBusinessDay(wib('2026-10-03T10:00:00'), schedule)).toEqual(wib('2026-10-06T08:00:00'));
        });

        it('workloadDay stores the WIB date at UTC midnight', () => {
            expect(workloadDay(wib('2026-10-01T02:00:00')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
        });
    });

    describe('installActivationAt', () => {
        it('is null for regular tickets and installs without a date', () => {
            expect(installActivationAt({ isHardwareInstallation: false, scheduledDate: wib('2026-10-02T10:00:00') }, schedule)).toBeNull();
            expect(installActivationAt({ isHardwareInstallation: true, scheduledDate: null }, schedule)).toBeNull();
        });

        it('is the opening of the install day', () => {
            expect(installActivationAt({ isHardwareInstallation: true, scheduledDate: wib('2026-10-02T13:00:00') }, schedule))
                .toEqual(wib('2026-10-02T08:00:00'));
        });
    });

    describe('countsTowardsWorkload', () => {
        const install = { isHardwareInstallation: true, scheduledDate: wib('2026-10-02T13:00:00') };

        it('does not count before H', () => {
            expect(countsTowardsWorkload(install, schedule, wib('2026-10-01T16:00:00'))).toBe(false);
            expect(countsTowardsWorkload(install, schedule, wib('2026-10-02T07:59:00'))).toBe(false);
        });

        it('counts from 08:00 on H onwards', () => {
            expect(countsTowardsWorkload(install, schedule, wib('2026-10-02T08:00:00'))).toBe(true);
            expect(countsTowardsWorkload(install, schedule, wib('2026-10-06T09:00:00'))).toBe(true);
        });

        it('a holiday install starts counting on the next working day', () => {
            const onHoliday = { isHardwareInstallation: true, scheduledDate: wib('2026-10-05T10:00:00') };
            expect(countsTowardsWorkload(onHoliday, schedule, wib('2026-10-05T12:00:00'))).toBe(false);
            expect(countsTowardsWorkload(onHoliday, schedule, wib('2026-10-06T08:00:00'))).toBe(true);
        });

        it('regular tickets always count', () => {
            expect(countsTowardsWorkload({ isHardwareInstallation: false }, schedule, wib('2026-10-03T03:00:00'))).toBe(true);
        });
    });
});
