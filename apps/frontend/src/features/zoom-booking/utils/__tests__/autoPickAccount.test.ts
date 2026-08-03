import { describe, it, expect } from 'vitest';
import { autoPickAccount, buildAvailability, type AccountLoad } from '../autoPickAccount';

describe('autoPickAccount', () => {
    const accounts: AccountLoad[] = [
        { id: 'a1', name: 'Marketing', colorHex: '#3b82f6', meetingsAtTime: 3 },
        { id: 'a2', name: 'Sales', colorHex: '#10b981', meetingsAtTime: 1 },
        { id: 'a3', name: 'Engineering', colorHex: '#8b5cf6', meetingsAtTime: 0 },
    ];

    it('returns account with zero meetings at the time if any', () => {
        const picked = autoPickAccount(accounts, '10:00');
        expect(picked?.id).toBe('a3');
    });

    it('returns account with fewest meetings when none have zero', () => {
        const busy: AccountLoad[] = accounts.map((a) => ({
            ...a,
            meetingsAtTime: Math.max(1, a.meetingsAtTime),
        }));
        const picked = autoPickAccount(busy, '10:00');
        expect(picked?.id).toBe('a2');
    });

    it('returns null when accounts list is empty', () => {
        expect(autoPickAccount([], '10:00')).toBeNull();
    });

    it('uses stable tiebreaker by id when loads are equal', () => {
        const tied: AccountLoad[] = [
            { id: 'z', name: 'Z', colorHex: '#000', meetingsAtTime: 1 },
            { id: 'a', name: 'A', colorHex: '#fff', meetingsAtTime: 1 },
        ];
        const picked = autoPickAccount(tied, '2026-07-21');
        expect(picked?.id).toBe('a');
    });

    it('skips accounts with an overlapping booking', () => {
        const availability = buildAvailability(
            [
                { id: 'a1', name: 'Marketing', colorHex: '#3b82f6' },
                { id: 'a2', name: 'Sales', colorHex: '#10b981' },
            ] as any,
            new Map([
                ['a1', [{ date: '2026-07-21', slots: [{ time: '10:00', booking: { id: 'b1', title: 'Busy', bookedBy: 'A', durationMinutes: 60, startTime: '10:00', endTime: '11:00' } }] }]],
                ['a2', [{ date: '2026-07-21', slots: [] }]],
            ]) as any,
            '2026-07-21',
        );
        const picked = autoPickAccount(accounts.slice(0, 2), '2026-07-21', '10:30', 30, availability);
        expect(picked?.id).toBe('a2');
    });
});
