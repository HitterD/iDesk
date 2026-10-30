import { describe, expect, it } from 'vitest';
import { formatSiteNames, formatSites } from '../location';

const SPJ = { id: 's1', code: 'SPJ', name: 'Sidoarjo' };
const BKS = { id: 's2', code: 'BKS', name: 'Bekasi' };

describe('location helpers', () => {
    it('joins site codes with " & " for compact labels', () => {
        expect(formatSites([SPJ])).toBe('SPJ');
        expect(formatSites([SPJ, BKS])).toBe('SPJ & BKS');
    });

    it('joins full site names for the review summary', () => {
        expect(formatSiteNames([SPJ, BKS])).toBe('Sidoarjo & Bekasi');
    });

    it('skips missing values and falls back to a dash when nothing is left', () => {
        expect(formatSites([{ id: 'x', code: null, name: null }, BKS])).toBe('BKS');
        expect(formatSiteNames([{ id: 'x', code: 'X1', name: null }])).toBe('X1');
        expect(formatSites([])).toBe('—');
        expect(formatSiteNames([])).toBe('—');
    });
});
