import { describeTicketChanges } from './notification-copy.util';

describe('describeTicketChanges', () => {
    it('reads the change list in Indonesian with the app labels', () => {
        expect(describeTicketChanges(
            'Status changed from TODO to IN_PROGRESS, Ticket reassigned to Agent B (was Beny Saputra, S.Kom) (Alasan: cuti), SLA Timer started. Target: 2026-10-24T03:00:00.000Z',
        )).toBe('status Open ke In Progress; PIC kini Agent B');
        expect(describeTicketChanges('Priority changed from MEDIUM to CRITICAL')).toBe('prioritas Normal ke Blocker');
    });

    it('keeps entries it does not recognise', () => {
        expect(describeTicketChanges('Janji vendor: Kamis, 29 Oktober 2026 09.00 WIB')).toBe('Janji vendor: Kamis, 29 Oktober 2026 09.00 WIB');
    });
});
