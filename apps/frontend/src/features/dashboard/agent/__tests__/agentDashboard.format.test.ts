import { describe, it, expect } from 'vitest';
import { firstName, formatDuration, formatSlaCompact, formatSlaRelative, formatWibDateTime, shortDateLabel, wibGreeting } from '../agentDashboard.format';

describe('agent dashboard format', () => {
    it('formats resolve durations', () => {
        expect(formatDuration(null)).toBe('-');
        expect(formatDuration(45)).toBe('45m');
        expect(formatDuration(120)).toBe('2j');
        expect(formatDuration(95)).toBe('1j 35m');
        expect(formatDuration(3000)).toBe('2h 2j');
    });

    it('shows times in WIB regardless of the browser timezone', () => {
        // 23:30 UTC on Oct 6 = 06:30 WIB on Oct 7.
        expect(formatWibDateTime('2026-10-06T23:30:00.000Z')).toMatch(/07.*06[.:]30/);
    });

    it('shortens chart dates', () => {
        expect(shortDateLabel('2026-10-07')).toBe('07/10');
    });
});

describe('relative SLA and greeting', () => {
    const NOW = new Date('2026-10-04T03:00:00.000Z'); // 10:00 WIB

    it('describes SLA distance in plain Indonesian', () => {
        expect(formatSlaRelative('2026-10-01T03:00:00.000Z', NOW)).toEqual({ text: 'Lewat 3 hari', overdue: true });
        expect(formatSlaRelative('2026-10-04T02:15:00.000Z', NOW)).toEqual({ text: 'Lewat 45 menit', overdue: true });
        expect(formatSlaRelative('2026-10-04T05:00:00.000Z', NOW)).toEqual({ text: 'Sisa 2 jam', overdue: false });
        expect(formatSlaRelative('2026-10-04T03:00:30.000Z', NOW)).toEqual({ text: 'Sisa < 1 menit', overdue: false });
    });

    it('uses queue units for the attention SLA bubble', () => {
        expect(formatSlaCompact('2026-10-04T01:19:30.000Z', NOW)).toEqual({ text: 'Lewat 1j 40m', overdue: true });
        expect(formatSlaCompact('2026-10-06T11:00:00.000Z', NOW)).toEqual({ text: 'Sisa 2h 8j', overdue: false });
        expect(formatSlaCompact('2026-10-04T03:20:00.000Z', NOW)).toEqual({ text: 'Sisa 20m', overdue: false });
    });

    it('greets by WIB time of day', () => {
        expect(wibGreeting(new Date('2026-10-03T23:00:00.000Z'))).toBe('Selamat pagi'); // 06:00 WIB
        expect(wibGreeting(new Date('2026-10-04T06:00:00.000Z'))).toBe('Selamat siang'); // 13:00
        expect(wibGreeting(new Date('2026-10-04T09:00:00.000Z'))).toBe('Selamat sore'); // 16:00
        expect(wibGreeting(new Date('2026-10-04T13:00:00.000Z'))).toBe('Selamat malam'); // 20:00
    });

    it('uses the first name only', () => {
        expect(firstName('RM BAGASTYO ANGGORO INDRASTOTO')).toBe('Bagastyo');
        expect(firstName('Dev One')).toBe('Dev');
    });
});
