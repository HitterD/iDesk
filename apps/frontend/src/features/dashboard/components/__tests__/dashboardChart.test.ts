import { describe, it, expect } from 'vitest';
import { bucketByDays, columnAxis, dayMonthLabel, daySlashLabel, isWeekly, lineAxis } from '../dashboardChart';
import { buildTrendRows, trendDescription } from '../../agent/AgentTrendChart';

const days = (n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 22 + i));
    return { date: d.toISOString().slice(0, 10), assigned: 1, resolved: i % 2 };
});

describe('dashboard chart helpers', () => {
    it('buckets from the newest day so only the oldest week is partial', () => {
        const weeks = bucketByDays(days(30), ['assigned', 'resolved'] as const, 7);
        expect(weeks).toHaveLength(5);
        expect(weeks[0]).toMatchObject({ start: '2026-09-22', end: '2026-09-23', values: { assigned: 2 } });
        expect(weeks[4]).toMatchObject({ start: '2026-10-15', end: '2026-10-21', values: { assigned: 7 } });
    });

    it('switches to weekly beyond two weeks (mockup 30/90 days)', () => {
        expect(isWeekly(7)).toBe(false);
        expect(isWeekly(14)).toBe(false);
        expect(isWeekly(30)).toBe(true);
        expect(trendDescription(7)).toBe('Tiket ditugaskan vs diselesaikan per hari');
        expect(trendDescription(90)).toBe('Tiket ditugaskan vs diselesaikan per minggu');
    });

    it('labels trend rows by day, week start, or week number', () => {
        expect(buildTrendRows(days(7), 7).map((r) => r.label)).toEqual(['22 Sep', '23 Sep', '24 Sep', '25 Sep', '26 Sep', '27 Sep', '28 Sep']);
        expect(buildTrendRows(days(30), 30).map((r) => r.label)).toEqual(['22 Sep', '24 Sep', '1 Okt', '8 Okt', '15 Okt']);
        const ninety = buildTrendRows(days(90), 90);
        expect(ninety).toHaveLength(13);
        expect(ninety[0].label).toBe('Mg 1');
        expect(ninety[12]).toMatchObject({ label: 'Mg 13', assigned: 7 });
    });

    it('builds round axes with headroom', () => {
        expect(lineAxis(11)).toEqual({ max: 16, ticks: [0, 4, 8, 12, 16] });
        expect(lineAxis(4)).toEqual({ max: 6, ticks: [0, 3, 6] });
        expect(lineAxis(0)).toEqual({ max: 2, ticks: [0, 1, 2] });
        expect(columnAxis(20)).toEqual({ max: 20, ticks: [0, 5, 10, 15, 20] });
        expect(columnAxis(214).max).toBe(300);
        expect(columnAxis(5)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    });

    it('formats Indonesian axis dates', () => {
        expect(dayMonthLabel('2026-10-06')).toBe('6 Okt');
        expect(daySlashLabel('2026-10-06')).toBe('6/10');
    });
});
