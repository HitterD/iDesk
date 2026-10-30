import { describe, expect, it } from 'vitest';
import { defaultOpening, memoDefaults, validMemo } from '../memo';
import type { CsiPeriodListItem } from '../../types';

const periods = [
    { endDate: '2026-10-31', teamLabel: 'Operational Support', sites: [{ id: 's1', name: 'SJA Sepanjang' }] },
    { endDate: '2026-11-30', teamLabel: 'Tim ICT', sites: [{ id: 's1', name: 'SJA Sepanjang' }, { id: 's2', name: 'SJA Sukodono' }] },
] as CsiPeriodListItem[];

describe('memo helpers', () => {
    it('defaultOpening lists latest month, year and unique sites', () => {
        const text = defaultOpening(periods);
        expect(text).toContain('November 2026');
        expect(text).toContain('Nilai CSI 2026');
        expect(text).toContain('Operational Support');
        expect(text).toContain('SJA Sepanjang, SJA Sukodono');
        expect(text.match(/SJA Sepanjang/g)).toHaveLength(1);
    });
    it('reuses only the standing header; date, subject and opening are always fresh for this memo', () => {
        const saved = { to: 'Manager ICT', cc: 'SMO', number: '001/IM/ICT/XI/2025', from: 'Supervisor', closing: 'Salam.',
            date: '2025-11-28', subject: 'Nilai CSI 2025', opening: 'Paragraf memo tahun lalu.',
            signerLeft: { name: 'A', title: 'Supervisor' }, signerRight: { name: 'B', title: 'Manager' } };
        const header = memoDefaults(saved, periods, '2026-12-01');
        expect(header).toMatchObject({ to: 'Manager ICT', cc: 'SMO', from: 'Supervisor', closing: 'Salam.', signerLeft: saved.signerLeft });
        expect(header.date).toBe('2026-12-01');
        expect(header.subject).toBe('Nilai CSI 2026');
        expect(header.opening).toBe(defaultOpening(periods));
    });
    it('fills empty settings with defaults', () => {
        const header = memoDefaults({ opening: '' }, periods, '2026-12-01');
        expect(header.opening).toBe(defaultOpening(periods));
        expect(header.date).toBe('2026-12-01');
        expect(validMemo(header)).toBe(false);
        expect(validMemo({ ...header, to: 'Manager', from: 'Supervisor', number: '001', signerLeft: { name: 'A', title: 'Supervisor' }, signerRight: { name: 'B', title: 'Manager' } })).toBe(true);
    });
});
