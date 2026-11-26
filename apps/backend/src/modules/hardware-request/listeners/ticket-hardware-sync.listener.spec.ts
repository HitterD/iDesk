import { TicketHardwareSyncListener } from './ticket-hardware-sync.listener';
import { RequestStatus } from '../domain/enums/request-status.enum';

describe('TicketHardwareSyncListener', () => {
    const link = { record: jest.fn(), resumeForInstallation: jest.fn() };
    const reqRepo = { findOne: jest.fn(async () => ({ id: 'req-1', requesterId: 'user-1', rejectReason: 'Stok vendor kosong' })) };
    const schedRepo = { findOne: jest.fn(async () => ({ id: 's-1', scheduledStart: new Date('2026-10-27T02:00:00Z') })) };
    const flows = { has: jest.fn(async () => false) };
    const listener = new TicketHardwareSyncListener(link as any, reqRepo as any, schedRepo as any, flows as any);
    const base = { requestId: 'req-1', occurredAt: new Date(), requesterId: 'user-1' };

    beforeEach(() => { link.record.mockClear(); link.resumeForInstallation.mockClear(); flows.has.mockReset(); flows.has.mockResolvedValue(false); });

    it.each([
        ['user-1', 'DECLINED'],
        ['agent-1', 'WITHDRAWN'],
    ])('tells a cancelled proposal apart by who cancelled it (%s → %s)', async (actorId, phase) => {
        await listener.onCancelled({ ...base, actorId, fromStatus: RequestStatus.DRAFT });
        expect(link.record).toHaveBeenCalledWith('req-1', phase, { actorId });
    });

    it('resumes the SLA when picking the slot moved the request into INSTALLATION, and only then', async () => {
        const slot = { requestId: 'req-1', scheduleId: 's-1', technicianId: 't-1', scheduledStart: new Date('2026-10-27T02:00:00Z'), scheduledEnd: new Date('2026-10-27T03:00:00Z') };
        await listener.onSlotConfirmed({ ...slot, enteredInstallation: true });
        expect(link.resumeForInstallation).toHaveBeenCalledWith('req-1', undefined);
        link.resumeForInstallation.mockClear();
        await listener.onSlotConfirmed(slot);
        expect(link.resumeForInstallation).not.toHaveBeenCalled();
        expect(link.record).toHaveBeenCalledWith('req-1', 'SCHEDULED', { at: slot.scheduledStart });
    });

    it('a request that lives on a ticket gets no second "cancelled" card: the flow already wrote its own', async () => {
        flows.has.mockResolvedValue(true);
        await listener.onCancelled({ ...base, actorId: 'agent-1', fromStatus: RequestStatus.INSTALLATION });
        expect(link.record).not.toHaveBeenCalled();
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

    it('a request flow gets no INSTALLED, COMPLETED or ISSUE_REPORTED card (the flow posts its own single message)', async () => {
        flows.has.mockResolvedValue(true);
        await listener.onInstallCompleted({ ...base, actorId: 'agent-1', status: RequestStatus.AWAITING_USER_CONFIRMATION });
        await listener.onInstallCompleted({ ...base, actorId: 'user-1', status: RequestStatus.COMPLETED });
        await listener.onIssueReported({ ...base, actorId: 'user-1', comments: 'Monitor tidak menyala' });
        expect(link.record).not.toHaveBeenCalled();
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

    it('a request that belongs to a request flow gets no PROCUREMENT_DONE card (the flow writes its own message)', async () => {
        flows.has.mockResolvedValue(true);
        await listener.onProcurementDone({ requestId: 'req-1', ownerId: 'user-1', approvedItems: 2, rejectedItems: 0 });
        expect(flows.has).toHaveBeenCalledWith('req-1');
        expect(link.record).not.toHaveBeenCalled();
    });

    it('ends the ticket wait when procurement approved nothing, with the reason', async () => {
        await listener.onProcurementDone({ requestId: 'req-1', ownerId: 'user-1', approvedItems: 0, rejectedItems: 2 });
        expect(link.record).toHaveBeenCalledWith('req-1', 'REJECTED', { reason: 'Stok vendor kosong' });
    });

    it('skips REJECTED and 0-approved procurement sync for request-flow hardware requests', async () => {
        flows.has.mockResolvedValue(true);
        await listener.onRejected({ ...base, actorId: 'mgr-1', reason: 'Ditolak' });
        await listener.onProcurementDone({ requestId: 'req-1', ownerId: 'user-1', approvedItems: 0, rejectedItems: 2 });
        expect(link.record).not.toHaveBeenCalled();
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
