import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketLinkedRequestService } from './ticket-linked-request.service';

const DEADLINE = new Date('2026-11-24T10:00:00Z');

function setup(ticket: Partial<Ticket>, running = '0') {
    const row: any = { id: 't-1', siteId: 'site-1', assignedToId: 'agent-1', ...ticket };
    const manager = {
        findOne: jest.fn(async (entity: unknown) => (entity === Ticket ? row : null)),
        save: jest.fn(async (_e: unknown, v: any) => ({ id: 'msg-1', ...v })),
        create: jest.fn((_e: unknown, v: unknown) => v),
        query: jest.fn(async () => [{ running, proposals: '0' }]),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const slaClock = { hold: jest.fn(async () => undefined), release: jest.fn(async () => false) };
    const vendorVisit = { clear: jest.fn(async () => undefined) };
    const gateway = { notifyNewMessage: jest.fn(), notifyTicketUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
    const businessHours = { calculateSlaTarget: jest.fn(async () => DEADLINE) };
    const service = new TicketLinkedRequestService(
        dataSource as never, slaClock as never, vendorVisit as never, gateway as never, { recalculateAgentWorkload: jest.fn() } as never, businessHours as never,
    );
    const phase = (target: TicketStatus) => ({
        ticketId: 't-1', actorId: null, target, text: 'x', event: { hardwareRequest: { id: 'hr-1', number: 'HR-1', phase: 'INSTALLED' as const } },
    });
    return { service, row, slaClock, phase, businessHours };
}

describe('TicketLinkedRequestService RESOLVED target', () => {
    it('resolves the ticket, opens the confirmation window and holds the SLA', async () => {
        const { service, row, slaClock, phase } = setup({ status: TicketStatus.IN_PROGRESS });

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(true);

        expect(row.status).toBe(TicketStatus.RESOLVED);
        expect(row.resolvedAt).toBeInstanceOf(Date);
        expect(row.resolutionDeadlineAt).toBe(DEADLINE);
        expect(row.disputedAt).toBeNull();
        expect(slaClock.hold).toHaveBeenCalled();
    });

    it('stays out while another request on the ticket still runs', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.IN_PROGRESS }, '1');

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(false);
        expect(row.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('does not reopen a closed ticket', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.CLOSED });

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(false);
        expect(row.status).toBe(TicketStatus.CLOSED);
    });
});
