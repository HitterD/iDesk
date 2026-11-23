import { TicketHardwareLinkService } from './ticket-hardware-link.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketLinkedRequestService } from '../../ticketing/services/ticket-linked-request.service';

describe('TicketHardwareLinkService', () => {
    let service: TicketHardwareLinkService;
    let ticket: any;
    let request: any;
    let manager: any;
    let slaClock: any;
    let vendorVisit: any;
    let gateway: any;

    beforeEach(() => {
        ticket = { id: 'ticket-1', siteId: 'site-1', status: TicketStatus.IN_PROGRESS, assignedToId: 'agent-1' };
        request = { id: 'req-1', requestNumber: 'HR-2026-0012', sourceTicketId: 'ticket-1' };
        const reqRepo = { findOne: jest.fn(async () => request) };
        manager = {
            findOne: jest.fn(async (entity: any) => (entity.name === 'User' ? { id: 'user-1', fullName: 'Budi' } : ticket)),
            save: jest.fn(async (_e: unknown, row: any) => ({ id: 'msg-1', ...row })),
            create: jest.fn((_e: unknown, row: any) => row),
            // The other requests raised from the ticket: [hardware_requests, eform_requests] counts of running and unanswered.
            query: jest.fn(async () => [{ running: '0', proposals: '0' }]),
        };
        slaClock = { hold: jest.fn(), release: jest.fn(), resumeOnOriginalTarget: jest.fn() };
        vendorVisit = { clear: jest.fn() };
        gateway = { notifyNewMessage: jest.fn(), notifyTicketUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };
        const linked = new TicketLinkedRequestService(dataSource as any, slaClock, vendorVisit, gateway, { recalculateAgentWorkload: jest.fn() } as any, { calculateSlaTarget: jest.fn() } as any, { createSurvey: jest.fn() } as any);
        service = new TicketHardwareLinkService(reqRepo as any, linked);
    });

    const message = () => manager.create.mock.calls.find((c: any[]) => c[1]?.isSystemMessage)?.[1];

    it('posts a proposal card without touching the ticket status', async () => {
        await service.record('req-1', 'PROPOSED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
        expect(message().systemEvent).toEqual(expect.objectContaining({
            actor: { id: 'user-1', name: 'Budi' }, changes: [],
            hardwareRequest: { id: 'req-1', number: 'HR-2026-0012', phase: 'PROPOSED', at: null },
        }));
        expect(gateway.notifyNewMessage).toHaveBeenCalledWith('ticket-1', expect.objectContaining({ id: 'msg-1' }));
        expect(gateway.notifyTicketListUpdate).not.toHaveBeenCalled();
    });

    it('holds the SLA as a vendor wait once the requester submits', async () => {
        await service.record('req-1', 'SUBMITTED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(ticket.waitingVendorAt).toBeInstanceOf(Date);
        expect(slaClock.hold).toHaveBeenCalledWith(ticket, expect.any(Date));
        expect(message().systemEvent.changes).toEqual([{ field: 'status', from: 'IN_PROGRESS', to: 'WAITING_VENDOR' }]);
        expect(gateway.notifyTicketListUpdate).toHaveBeenCalledWith('site-1');
    });

    it('resumes the ticket when ICT rejects the request', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;
        ticket.lastPausedAt = new Date(Date.now() - 30 * 60_000);

        await service.record('req-1', 'REJECTED', { actorId: 'user-1', reason: 'Stok ada' });

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
        expect(ticket.totalWaitingVendorMinutes).toBe(30);
        expect(slaClock.release).toHaveBeenCalled();
        expect(vendorVisit.clear).toHaveBeenCalledWith(manager, ticket);
        expect(message().systemEvent.reason).toBe('Stok ada');
    });

    it('keeps the SLA held through procurement and delivery (PROCUREMENT_DONE changes no status)', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;

        await service.record('req-1', 'PROCUREMENT_DONE');

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(slaClock.release).not.toHaveBeenCalled();
    });

    it('SCHEDULED is informational: it never changes the ticket status', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;

        await service.record('req-1', 'SCHEDULED', { at: new Date('2026-11-25T02:00:00Z') });

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(slaClock.release).not.toHaveBeenCalled();
        expect(message().systemEvent.changes).toEqual([]);
    });

    it('COMPLETED closes a RESOLVED flow ticket (the requester confirmed the installation)', async () => {
        ticket.status = TicketStatus.RESOLVED;
        ticket.resolutionDeadlineAt = new Date();

        await service.record('req-1', 'COMPLETED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.CLOSED);
        expect(ticket.closedAt).toBeInstanceOf(Date);
        expect(ticket.resolutionDeadlineAt).toBeNull();
    });

    describe.each(['REJECTED', 'CANCELLED'] as const)('%s on a RESOLVED flow ticket', (phase) => {
        it('leaves it waiting for the requester', async () => {
            ticket.status = TicketStatus.RESOLVED;
            ticket.resolutionDeadlineAt = new Date();

            await service.record('req-1', phase, { actorId: 'user-1' });

            expect(ticket.status).toBe(TicketStatus.RESOLVED);
            expect(ticket.resolutionDeadlineAt).toBeInstanceOf(Date);
            expect(ticket.disputedAt).toBeUndefined();
        });
    });

    it('a retried resumeForInstallation after install-done leaves a RESOLVED ticket untouched', async () => {
        ticket.status = TicketStatus.RESOLVED;
        ticket.resolutionDeadlineAt = new Date();

        await expect(service.resumeForInstallation('req-1', 'agent-1', { silentUnlessMoved: true })).resolves.toBe(false);
        await expect(service.resumeForInstallation('req-1', 'agent-1')).resolves.toBe(false);

        expect(ticket.status).toBe(TicketStatus.RESOLVED);
        expect(ticket.disputedAt).toBeUndefined();
    });

    it('ISSUE_REPORTED reopens a RESOLVED ticket as a dispute (deadline cleared, disputedAt set)', async () => {
        ticket.status = TicketStatus.RESOLVED;
        ticket.resolutionDeadlineAt = new Date();
        ticket.resolvedAt = new Date();

        await service.record('req-1', 'ISSUE_REPORTED', { actorId: 'user-1', reason: 'Monitor mati' });

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
        expect(ticket.resolutionDeadlineAt).toBeNull();
        expect(ticket.resolvedAt).toBeNull();
        expect(ticket.disputedAt).toBeInstanceOf(Date);
    });

    it('ISSUE_REPORTED never resumes a ticket that still waits on a vendor', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;
        ticket.lastPausedAt = new Date();

        await service.record('req-1', 'ISSUE_REPORTED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(slaClock.release).not.toHaveBeenCalled();
    });

    it('ISSUE_REPORTED on a ticket that is not resolved changes nothing', async () => {
        ticket.status = TicketStatus.IN_PROGRESS;

        await service.record('req-1', 'ISSUE_REPORTED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
        expect(message().systemEvent.changes).toEqual([]);
    });

    describe('resumeForInstallation (goods arrived, request enters INSTALLATION)', () => {
        it('resumes a ticket that waits on the request', async () => {
            ticket.status = TicketStatus.WAITING_VENDOR;
            ticket.lastPausedAt = new Date(Date.now() - 10 * 60_000);

            await service.resumeForInstallation('req-1', 'agent-1');

            expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
            expect(slaClock.release).toHaveBeenCalled();
            expect(message().systemEvent.changes).toEqual([{ field: 'status', from: 'WAITING_VENDOR', to: 'IN_PROGRESS' }]);
        });

        it('leaves a ticket an agent already moved on alone', async () => {
            ticket.status = TicketStatus.TODO;
            await service.resumeForInstallation('req-1');
            expect(ticket.status).toBe(TicketStatus.TODO);

            ticket.status = TicketStatus.IN_PROGRESS;
            await service.resumeForInstallation('req-1');
            expect(slaClock.release).not.toHaveBeenCalled();
        });

        it('does not reopen a finished ticket', async () => {
            ticket.status = TicketStatus.CLOSED;
            await service.resumeForInstallation('req-1');
            expect(ticket.status).toBe(TicketStatus.CLOSED);
            ticket.status = TicketStatus.CANCELLED;
            await service.resumeForInstallation('req-1');
            expect(ticket.status).toBe(TicketStatus.CANCELLED);
        });

        it('a silent resume posts nothing and reports false while another request keeps the ticket held', async () => {
            ticket.status = TicketStatus.WAITING_VENDOR;
            manager.query.mockResolvedValue([{ running: '1', proposals: '0' }]);

            const moved = await service.resumeForInstallation('req-1', 'agent-1', { silentUnlessMoved: true });

            expect(moved).toBe(false);
            expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
            expect(message()).toBeUndefined();
            expect(gateway.notifyNewMessage).not.toHaveBeenCalled();
            expect(gateway.notifyTicketUpdate).not.toHaveBeenCalled();
        });

        it('a silent resume still records the card when it really moves the ticket', async () => {
            ticket.status = TicketStatus.WAITING_VENDOR;

            const moved = await service.resumeForInstallation('req-1', 'agent-1', { silentUnlessMoved: true });

            expect(moved).toBe(true);
            expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
            expect(message()).toBeDefined();
        });

        it('the first (non-silent) resume keeps posting its card even when the ticket stays held', async () => {
            ticket.status = TicketStatus.WAITING_VENDOR;
            manager.query.mockResolvedValue([{ running: '1', proposals: '0' }]);

            await expect(service.resumeForInstallation('req-1', 'agent-1')).resolves.toBe(false);

            expect(message()).toBeDefined();
        });

        it('ignores requests that did not come from a ticket', async () => {
            request.sourceTicketId = null;
            await service.resumeForInstallation('req-1');
            expect(manager.save).not.toHaveBeenCalled();
        });
    });

    it('keeps the SLA held while a schedule is only proposed (still waiting for the goods)', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;

        await service.record('req-1', 'SCHEDULE_PROPOSED', { actorId: 'user-1' });

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
    });

    it('does not reopen a ticket an agent already moved on from the wait', async () => {
        ticket.status = TicketStatus.TODO;

        await service.record('req-1', 'CANCELLED');

        expect(ticket.status).toBe(TicketStatus.TODO);
        expect(slaClock.release).not.toHaveBeenCalled();
    });

    it('closes the ticket when the request completes', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;

        await service.record('req-1', 'COMPLETED');

        expect(ticket.status).toBe(TicketStatus.CLOSED);
        expect(ticket.closedAt).toBeInstanceOf(Date);
    });

    it('keeps waiting while another request raised from the ticket is still running', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;
        manager.query.mockResolvedValueOnce([{ running: '0', proposals: '0' }]).mockResolvedValueOnce([{ running: '1', proposals: '0' }]);

        await service.record('req-1', 'COMPLETED');

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(ticket.closedAt).toBeUndefined();
        expect(message().systemEvent.changes).toEqual([]);
    });

    it('does not resume the ticket on a rejection while another request is still running', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;
        manager.query.mockResolvedValueOnce([{ running: '1', proposals: '0' }]);

        await service.record('req-1', 'REJECTED');

        expect(ticket.status).toBe(TicketStatus.WAITING_VENDOR);
        expect(slaClock.release).not.toHaveBeenCalled();
    });

    it('hands the ticket back instead of closing it over a proposal nobody answered', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;
        manager.query.mockResolvedValueOnce([{ running: '0', proposals: '1' }]).mockResolvedValueOnce([{ running: '0', proposals: '0' }]);

        await service.record('req-1', 'COMPLETED');

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
        expect(message().systemEvent.changes).toEqual([{ field: 'status', from: 'WAITING_VENDOR', to: 'IN_PROGRESS' }]);
    });

    it('looks at the other requests of this ticket only, never the one that just changed', async () => {
        ticket.status = TicketStatus.WAITING_VENDOR;

        await service.record('req-1', 'COMPLETED');

        const [sql, params] = manager.query.mock.calls[0];
        expect(sql).toContain('"sourceTicketId" = $1');
        expect(params.slice(0, 2)).toEqual(['ticket-1', 'req-1']);
        // Both kinds of linked request are checked: hardware and e-form.
        expect(manager.query.mock.calls.map((c: any[]) => c[0].match(/FROM (\w+)/)[1])).toEqual(['hardware_requests', 'eform_requests']);
    });

    it('ignores requests that did not come from a ticket', async () => {
        request.sourceTicketId = null;

        await service.record('req-1', 'SUBMITTED');

        expect(manager.save).not.toHaveBeenCalled();
    });

    it('never throws back into the hardware request flow', async () => {
        manager.findOne.mockRejectedValue(new Error('db down'));

        await expect(service.record('req-1', 'APPROVED')).resolves.toBeUndefined();
    });
});
