import { describe, it, expect } from 'vitest';
import { formatSlaStatus, sortByUrgency } from '../tvBoardTime';

const NOW = new Date('2026-09-28T10:00:00Z');

describe('formatSlaStatus', () => {
    it('reports how late an overdue ticket is in the largest whole unit', () => {
        expect(formatSlaStatus('2026-09-25T09:00:00Z', true, NOW)).toEqual({ label: 'Terlambat 3 hari', overdue: true });
        expect(formatSlaStatus('2026-09-28T07:30:00Z', true, NOW)).toEqual({ label: 'Terlambat 2 jam', overdue: true });
        expect(formatSlaStatus('2026-09-28T09:55:00Z', false, NOW)).toEqual({ label: 'Terlambat 5 mnt', overdue: true });
    });

    it('shows remaining time before the deadline', () => {
        expect(formatSlaStatus('2026-09-28T14:00:00Z', false, NOW)).toEqual({ label: 'Sisa 4 jam', overdue: false });
    });

    it('trusts the server overdue flag even when the TV clock is behind', () => {
        expect(formatSlaStatus('2026-09-28T14:00:00Z', true, NOW)).toEqual({ label: 'Terlambat', overdue: true });
        expect(formatSlaStatus(null, true, NOW)).toEqual({ label: 'Terlambat', overdue: true });
    });

    it('returns nothing without a deadline', () => {
        expect(formatSlaStatus(null, false, NOW)).toBeNull();
        expect(formatSlaStatus('bukan tanggal', false, NOW)).toBeNull();
    });
});

describe('sortByUrgency', () => {
    it('puts the longest-overdue ticket first and tickets without SLA last', () => {
        const cards = [
            { id: 'no-sla', slaTarget: null, isOverdue: false },
            { id: 'future', slaTarget: '2026-09-29T10:00:00Z', isOverdue: false },
            { id: 'late-2d', slaTarget: '2026-09-26T10:00:00Z', isOverdue: true },
            { id: 'late-9d', slaTarget: '2026-09-19T10:00:00Z', isOverdue: true },
        ];
        expect(sortByUrgency(cards).map((c) => c.id)).toEqual(['late-9d', 'late-2d', 'future', 'no-sla']);
        expect(cards[0].id).toBe('no-sla');
    });
});
