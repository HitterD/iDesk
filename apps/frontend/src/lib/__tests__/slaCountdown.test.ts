import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));

import { offHoursLabel, slaCountdown, SlaClockInfo } from '../slaCountdown';

const INFO: SlaClockInfo = {
    schedule: { workDays: [1, 2, 3, 4, 5], startTime: 480, endTime: 1020, timezone: 'Asia/Jakarta', holidays: ['2026-10-05'] },
    businessHoursOnly: { MEDIUM: true, CRITICAL: false },
};
const wib = (iso: string) => new Date(`${iso}+07:00`);
const MINUTE = 60_000;

describe('slaCountdown', () => {
    it('falls back to wall-clock time without clock info', () => {
        const c = slaCountdown(wib('2026-10-01T12:00:00'), wib('2026-10-01T10:00:00'), 'MEDIUM', null);
        expect(c).toEqual({ remainingMs: 120 * MINUTE, offHours: false, resumesAt: null });
    });

    it('counts only working minutes during business hours', () => {
        // Thu 16:00 -> Fri 09:00 = 60 + 60 working minutes
        const c = slaCountdown(wib('2026-10-02T09:00:00'), wib('2026-10-01T16:00:00'), 'MEDIUM', INFO);
        expect(c.remainingMs).toBe(120 * MINUTE);
        expect(c.offHours).toBe(false);
    });

    it('freezes outside working hours and resumes after weekend + holiday', () => {
        // Fri 20:00; Sat/Sun weekend, Mon 2026-10-05 holiday -> Tue 08:00
        const now = wib('2026-10-02T20:00:00');
        const c = slaCountdown(wib('2026-10-06T10:00:00'), now, 'MEDIUM', INFO);
        expect(c.remainingMs).toBe(120 * MINUTE);
        expect(c.offHours).toBe(true);
        expect(c.resumesAt).toEqual(wib('2026-10-06T08:00:00'));
        expect(offHoursLabel(c, now, INFO)).toMatch(/^SLA dijeda — di luar jam kerja \(lanjut .*08[.:]00\)$/);
    });

    it('runs around the clock for 24/7 priorities', () => {
        const c = slaCountdown(wib('2026-10-03T23:00:00'), wib('2026-10-03T22:00:00'), 'CRITICAL', INFO);
        expect(c).toEqual({ remainingMs: 60 * MINUTE, offHours: false, resumesAt: null });
    });

    it('reports overdue time as negative working minutes and is not paused', () => {
        const c = slaCountdown(wib('2026-10-01T09:00:00'), wib('2026-10-01T20:00:00'), 'MEDIUM', INFO);
        expect(c.remainingMs).toBe(-480 * MINUTE);
        expect(c.offHours).toBe(false);
    });
});
