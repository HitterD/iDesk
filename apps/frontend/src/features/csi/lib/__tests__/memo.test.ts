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
    it('fills empty settings without overwriting saved memo text', () => {
        const header = memoDefaults({ subject: 'Memo tersimpan', opening: '' }, periods, '2026-12-01');
        expect(header.subject).toBe('Memo tersimpan');
        expect(header.opening).toBe(defaultOpening(periods));
        expect(header.date).toBe('2026-12-01');
        expect(validMemo(header)).toBe(false);
        expect(validMemo({ ...header, to: 'Manager', from: 'Supervisor', number: '001', signerLeft: { name: 'A', title: 'Supervisor' }, signerRight: { name: 'B', title: 'Manager' } })).toBe(true);
    });
});
