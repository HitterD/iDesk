import { describe, expect, it } from 'vitest';
import { minutesLabel, hoursLabel, DAILY_CREATED_LABEL, DAILY_DONE_LABEL, DAILY_TREND_CAPTION } from './ReportParts';

describe('report duration honesty', () => {
    it('distinguishes missing measurements from real sub-minute samples', () => {
        expect(minutesLabel(null)).toBe('—');
        expect(minutesLabel(undefined)).toBe('—');
        expect(hoursLabel(null)).toBe('—');
        expect(minutesLabel(0)).toBe('<1 menit');
        expect(minutesLabel(0.5)).toBe('<1 menit');
        expect(hoursLabel(0.125)).toBe('8m');
    });
});

describe('daily trend labels', () => {
    it('describe the created-day cohort, not completion-day throughput', () => {
        expect(DAILY_CREATED_LABEL).toBe('Dibuat');
        expect(DAILY_DONE_LABEL).toBe('Kini selesai');
        expect(DAILY_TREND_CAPTION).toContain('dari tiket hari itu');
        expect(`${DAILY_DONE_LABEL} ${DAILY_TREND_CAPTION}`).not.toMatch(/diselesaikan per hari/i);
    });
});
