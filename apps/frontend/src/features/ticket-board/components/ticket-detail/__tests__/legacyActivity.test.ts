import { describe, expect, it } from 'vitest';
import { legacyActivityEvent } from '../legacyActivity';

describe('legacyActivityEvent', () => {
    it('reads a status change and its actor', () => {
        expect(legacyActivityEvent('System: Status changed from TODO to IN_PROGRESS by Rm Bagastyo Anggoro Indrastoto')).toEqual({
            v: 1,
            actor: { id: '', name: 'Rm Bagastyo Anggoro Indrastoto' },
            changes: [{ field: 'status', from: 'TODO', to: 'IN_PROGRESS' }],
        });
    });

    it('reads a reassignment with a reason, keeping commas inside names', () => {
        expect(legacyActivityEvent(
            'System: Ticket reassigned to Rm Bagastyo Anggoro Indrastoto (was Beny Saputra, S.Kom) by Rm Bagastyo Anggoro Indrastoto. Alasan: Beban Kerja Penuh / Overload',
        )).toEqual({
            v: 1,
            actor: { id: '', name: 'Rm Bagastyo Anggoro Indrastoto' },
            changes: [{ field: 'assignee', from: 'Beny Saputra, S.Kom', to: 'Rm Bagastyo Anggoro Indrastoto' }],
            reason: 'Beban Kerja Penuh / Overload',
        });
    });

    it('reads several changes in one message and drops SLA bookkeeping', () => {
        const event = legacyActivityEvent(
            'System: Status changed from TODO to IN_PROGRESS, Ticket reassigned to Agent B (was Agent A) (Alasan: cuti), SLA Timer started. Target: 2026-10-24T03:00:00.000Z by Agent B',
        );
        expect(event?.actor?.name).toBe('Agent B');
        expect(event?.changes).toEqual([
            { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
            { field: 'assignee', from: 'Agent A', to: 'Agent B' },
        ]);
        expect(event?.reason).toBe('cuti');
    });

    it('reads bulk updates and cancellations', () => {
        expect(legacyActivityEvent('System: Bulk update by Admin - Status: TODO → RESOLVED, Priority: MEDIUM → HIGH')?.changes).toEqual([
            { field: 'status', from: 'TODO', to: 'RESOLVED' },
            { field: 'priority', from: 'MEDIUM', to: 'HIGH' },
        ]);
        expect(legacyActivityEvent('System: Ticket cancelled by User SPJ: salah input')).toMatchObject({
            actor: { name: 'User SPJ' },
            changes: [{ field: 'status', from: null, to: 'CANCELLED' }],
            reason: 'salah input',
        });
    });

    it('treats "Unassigned" as no previous PIC', () => {
        expect(legacyActivityEvent('System: Ticket assigned to Agent A (was Unassigned) by Admin')?.changes)
            .toEqual([{ field: 'assignee', from: null, to: 'Agent A' }]);
    });

    it.each([
        ['a non-system note', '⏳ Status tiket diubah ke Waiting Vendor\n\nSLA dijeda.'],
        ['a change it does not know', 'System: Ticket forwarded to Oracle by Admin'],
        ['only SLA bookkeeping', 'System: SLA dilanjutkan. Target: 2026-10-24T03:00:00.000Z by Admin'],
    ])('leaves %s to the previous rendering', (_label, content) => {
        expect(legacyActivityEvent(content)).toBeNull();
    });
});
