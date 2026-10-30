import { describe, expect, it } from 'vitest';
import { describeWorkingHours, formatSlaSpan, formatSlaTarget, workingDayMinutes } from '../utils/slaDuration';

const MIN = 60_000;
const OFFICE = { workDays: [1, 2, 3, 4, 5], startTime: 480, endTime: 1020, timezone: 'Asia/Jakarta', holidays: [] };

describe('formatSlaSpan', () => {
    it('counts a working day as the schedule length, not 24 hours', () => {
        const day = workingDayMinutes(OFFICE)!;
        expect(day).toBe(540);
        // 2 working days (18 h) + 3 h = 21 business hours.
        expect(formatSlaSpan((2 * 540 + 180) * MIN, day)).toBe('2 hari 3 jam kerja');
        // 24 business hours is 2 working days and 6 hours, never "1 hari".
        expect(formatSlaSpan(24 * 60 * MIN, day)).toBe('2 hari 6 jam kerja');
    });

    it('drops zero parts and shows minutes only under a day', () => {
        expect(formatSlaSpan(540 * MIN, 540)).toBe('1 hari kerja');
        expect(formatSlaSpan(130 * MIN, 540)).toBe('2 jam 10 mnt kerja');
        expect(formatSlaSpan(45 * MIN, 540)).toBe('45 mnt kerja');
        expect(formatSlaSpan(-75 * MIN, 540)).toBe('1 jam 15 mnt kerja');
    });

    it('uses calendar days without the "kerja" label for 24-hour SLAs', () => {
        expect(formatSlaSpan((24 * 60 + 120) * MIN, null)).toBe('1 hari 2 jam');
    });
});

describe('formatSlaTarget', () => {
    const now = new Date('2026-10-26T03:00:00Z'); // Mon 10:00 WIB

    it('reads the target in WIB with today / tomorrow shortcuts', () => {
        expect(formatSlaTarget(new Date('2026-10-26T08:30:00Z'), now)).toBe('Hari ini · 15.30');
        expect(formatSlaTarget(new Date('2026-10-27T02:00:00Z'), now)).toBe('Besok · 09.00');
        expect(formatSlaTarget(new Date('2026-10-29T07:00:00Z'), now)).toMatch(/^Kam, 29 Okt · 14\.00$/);
    });
});

describe('describeWorkingHours', () => {
    it('states the days, hours and working-day length', () => {
        expect(describeWorkingHours(OFFICE)).toBe('Sen–Jum 08.00–17.00 WIB (1 hari kerja = 9 jam)');
    });
});
