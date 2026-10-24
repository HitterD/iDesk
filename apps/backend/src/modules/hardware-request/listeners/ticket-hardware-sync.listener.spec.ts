import { TicketHardwareSyncListener } from './ticket-hardware-sync.listener';
import { RequestStatus } from '../domain/enums/request-status.enum';

describe('TicketHardwareSyncListener', () => {
    const link = { record: jest.fn() };
    const reqRepo = { findOne: jest.fn(async () => ({ id: 'req-1', requesterId: 'user-1', rejectReason: 'Stok vendor kosong' })) };
    const schedRepo = { findOne: jest.fn(async () => ({ id: 's-1', scheduledStart: new Date('2026-10-27T02:00:00Z') })) };
    const listener = new TicketHardwareSyncListener(link as any, reqRepo as any, schedRepo as any);
    const base = { requestId: 'req-1', occurredAt: new Date(), requesterId: 'user-1' };

    beforeEach(() => link.record.mockClear());

    it.each([
        ['user-1', 'DECLINED'],
        ['agent-1', 'WITHDRAWN'],
    ])('tells a cancelled proposal apart by who cancelled it (%s → %s)', async (actorId, phase) => {
        await listener.onCancelled({ ...base, actorId, fromStatus: RequestStatus.DRAFT });
        expect(link.record).toHaveBeenCalledWith('req-1', phase, { actorId });
    });

    it('treats cancelling a running request as CANCELLED', async () => {
        await listener.onCancelled({ ...base, actorId: 'agent-1', fromStatus: RequestStatus.INSTALLATION });
        expect(link.record).toHaveBeenCalledWith('req-1', 'CANCELLED', { actorId: 'agent-1' });
    });

    it('splits "ICT marked done" from "requester confirmed"', async () => {
        await listener.onInstallCompleted({ ...base, actorId: 'agent-1', status: RequestStatus.AWAITING_USER_CONFIRMATION });
        await listener.onInstallCompleted({ ...base, actorId: 'user-1', status: RequestStatus.COMPLETED });
        expect(link.record.mock.calls.map((c) => c[1])).toEqual(['INSTALLED', 'COMPLETED']);
    });

    it('carries the confirmed installation time', async () => {
        await listener.onScheduleConfirmed({ ...base, scheduleId: 's-1', confirmedBy: 'user-1', technicianId: 't-1' });
        expect(link.record).toHaveBeenCalledWith('req-1', 'SCHEDULED', { actorId: 'user-1', at: new Date('2026-10-27T02:00:00Z') });
    });

    it('puts the requester\'s complaint about the installation on the ticket', async () => {
        await listener.onIssueReported({ ...base, actorId: 'user-1', comments: 'Monitor tidak menyala' });
        expect(link.record).toHaveBeenCalledWith('req-1', 'ISSUE_REPORTED', { actorId: 'user-1', reason: 'Monitor tidak menyala' });
    });

    it('keeps saying procurement is done while something was approved', async () => {
        await listener.onProcurementDone({ requestId: 'req-1', ownerId: 'user-1', approvedItems: 2, rejectedItems: 1 });
        expect(link.record).toHaveBeenCalledWith('req-1', 'PROCUREMENT_DONE');
    });

    it('ends the ticket wait when procurement approved nothing, with the reason', async () => {
        await listener.onProcurementDone({ requestId: 'req-1', ownerId: 'user-1', approvedItems: 0, rejectedItems: 2 });
        expect(link.record).toHaveBeenCalledWith('req-1', 'REJECTED', { reason: 'Stok vendor kosong' });
    });

    it('tells the ticket when the requester asks for another installation time', async () => {
        await listener.onRescheduleRequested({ requestId: 'req-1', scheduleId: 's-1', technicianId: 't-1', reason: 'Saya cuti hari itu', rescheduleCount: 1 });
        expect(link.record).toHaveBeenCalledWith('req-1', 'RESCHEDULE_REQUESTED', { actorId: 'user-1', reason: 'Saya cuti hari itu' });
    });

    it('posts a moved installation as a new time to confirm', async () => {
        await listener.onRescheduled({ ...base, actorId: 'agent-1', oldId: 's-0', newId: 's-1', technicianId: 't-1', reason: 'Teknisi sakit' });
        expect(link.record).toHaveBeenCalledWith('req-1', 'SCHEDULE_PROPOSED', { actorId: 'agent-1', reason: 'Teknisi sakit', at: new Date('2026-10-27T02:00:00Z') });
    });
});
