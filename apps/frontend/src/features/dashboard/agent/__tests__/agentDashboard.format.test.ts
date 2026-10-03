import { describe, it, expect } from 'vitest';
import { formatDuration, formatWibDateTime, shortDateLabel } from '../agentDashboard.format';

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
