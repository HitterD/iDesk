import { TicketHardwareLinkService } from './ticket-hardware-link.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';

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
        };
        slaClock = { hold: jest.fn(), release: jest.fn() };
        vendorVisit = { clear: jest.fn() };
        gateway = { notifyNewMessage: jest.fn(), notifyTicketUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };
        service = new TicketHardwareLinkService(reqRepo as any, dataSource as any, slaClock, vendorVisit, gateway, { recalculateAgentWorkload: jest.fn() } as any);
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
