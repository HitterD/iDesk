import { diffActivity, snapshotTicket, systemEvent } from './ticket-activity.util';

describe('ticket activity', () => {
    const base = { status: 'TODO', priority: 'HIGH', category: 'NETWORK', vendorVisitAt: null, assignedTo: { fullName: 'Beny' } } as any;

    it('reports every changed field with its old and new value, in display order', () => {
        const after = { ...base, status: 'IN_PROGRESS', assignedTo: { fullName: 'Bagas' }, vendorVisitAt: new Date('2026-10-29T02:00:00Z') };

        expect(diffActivity(snapshotTicket(base), snapshotTicket(after))).toEqual([
            { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
            { field: 'assignee', from: 'Beny', to: 'Bagas' },
            { field: 'vendorVisit', from: null, to: '2026-10-29T02:00:00.000Z' },
        ]);
    });

    it('reports a new vendor note', () => {
        const after = { ...base, status: 'WAITING_VENDOR', vendorNote: 'Menunggu spare part' };
        expect(diffActivity(snapshotTicket(base), snapshotTicket(after))).toContainEqual(
            { field: 'vendorNote', from: null, to: 'Menunggu spare part' },
        );
    });

    it('is empty when nothing reportable changed', () => {
        expect(diffActivity(snapshotTicket(base), snapshotTicket({ ...base }))).toEqual([]);
    });

    it('records the actor and only keeps a reason that was given', () => {
        expect(systemEvent({ id: 'u1', fullName: 'Bagas' }, [], 'Overload')).toEqual({ v: 1, actor: { id: 'u1', name: 'Bagas' }, changes: [], reason: 'Overload' });
        expect(systemEvent({ id: 'u1', fullName: 'Bagas' }, [], null)).not.toHaveProperty('reason');
    });
});
