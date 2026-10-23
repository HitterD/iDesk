import {
    categoryRows,
    fmtDateTime,
    fmtMinutes,
    fmtPeriod,
    humanizeSentence,
    priorityRows,
    statusRows,
} from './report-pdf-canvas';

describe('report PDF formatting', () => {
    it('shows enum values with the labels the app uses', () => {
        expect(statusRows({ WAITING_VENDOR: 2, TODO: 5 }).map((r) => r.label)).toEqual(['Open', 'Waiting Vendor']);
        expect(priorityRows({ MEDIUM: 9, CRITICAL: 1, HIGH: 3 }).map((r) => r.label)).toEqual(['Blocker', 'Urgent', 'Normal']);
        expect(categoryRows({ HARDWARE: 3 })[0].label).toBe('Hardware');
    });

    it('groups the long tail of categories as "Lainnya"', () => {
        const rows = categoryRows({ A: 9, B: 8, C: 7, D: 1, E: 1 }, 3);
        expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C', 'Lainnya']);
        expect(rows[3].value).toBe(2);
    });

    it('rewrites insight sentences for Indonesian readers without touching thousands', () => {
        expect(humanizeSentence('Kategori terbanyak "SOFTWARE_LICENSE" (32.0%) dari 1.234 tiket, rata-rata 6.4 jam.'))
            .toBe('Kategori terbanyak Software license (32,0%) dari 1.234 tiket, rata-rata 6,4 jam.');
    });

    it('prints times in WIB whatever the server timezone', () => {
        expect(fmtDateTime(new Date('2026-10-23T07:42:00Z'))).toMatch(/23 Okt 2026, 14[.:]42 WIB/);
    });

    it('reads a manager period string as a date range', () => {
        expect(fmtPeriod('2026-10-01 to 2026-10-31')).toBe('1 Okt 2026 - 31 Okt 2026');
        expect(fmtPeriod('bukan tanggal')).toBe('bukan tanggal');
    });

    it('formats durations in the unit a reader expects', () => {
        expect(fmtMinutes(14)).toBe('14 mnt');
        expect(fmtMinutes(95)).toBe('1,6 jam');
        expect(fmtMinutes(60 * 72)).toBe('3,0 hari');
    });
});
