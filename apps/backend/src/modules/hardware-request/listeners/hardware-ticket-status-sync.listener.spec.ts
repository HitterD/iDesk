import { HardwareTicketStatusSyncListener } from './hardware-ticket-status-sync.listener';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';

describe('HardwareTicketStatusSyncListener', () => {
    let listener: HardwareTicketStatusSyncListener;
    let ticket: any;
    let schedRepo: any;
    let reqRepo: any;
    let manager: any;
    let gateway: any;
    let workload: any;

    beforeEach(() => {
        ticket = { id: 'ticket-1', siteId: 'site-1', status: TicketStatus.IN_PROGRESS, assignedToId: 'tech-1' };
        schedRepo = { findOne: jest.fn().mockResolvedValue({ id: 'sched-1', ticketId: 'ticket-1' }) };
        reqRepo = { findOne: jest.fn().mockResolvedValue({ id: 'req-1', requestNumber: 'HR-2026-0011' }) };
        manager = {
            findOne: jest.fn(async () => ticket),
            save: jest.fn(async (_e: unknown, t: any) => t),
            create: jest.fn((_e: unknown, m: any) => m),
        };
        gateway = { notifyTicketUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
        workload = { recalculateAgentWorkload: jest.fn() };
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };

        listener = new HardwareTicketStatusSyncListener(reqRepo, schedRepo, dataSource as any, gateway, workload);
    });

    const savedMessage = () => manager.create.mock.calls.find((c: any[]) => c[1]?.isSystemMessage)?.[1];

    it('closes the installation ticket when the request is completed', async () => {
        await listener.onInstallCompleted({ requestId: 'req-1', status: RequestStatus.COMPLETED } as any);

        expect(ticket.status).toBe(TicketStatus.CLOSED);
        expect(ticket.closedAt).toBeInstanceOf(Date);
        expect(savedMessage().content).toContain('HR-2026-0011');
        expect(gateway.notifyTicketUpdate).toHaveBeenCalledWith('ticket-1', expect.anything(), 'site-1');
        expect(workload.recalculateAgentWorkload).toHaveBeenCalledWith(expect.anything(), 'tech-1', 'site-1');
    });

    it('ignores the "marked done, awaiting user" step', async () => {
        await listener.onInstallCompleted({ requestId: 'req-1', status: RequestStatus.AWAITING_USER_CONFIRMATION } as any);

        expect(manager.save).not.toHaveBeenCalled();
        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('cancels the installation ticket when the request is cancelled', async () => {
        await listener.onRequestCancelled({ requestId: 'req-1' } as any);

        expect(ticket.status).toBe(TicketStatus.CANCELLED);
        expect(savedMessage().content).toMatch(/dibatalkan/i);
    });

    it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])('leaves a %s ticket alone', async (status) => {
        ticket.status = status;

        await listener.onInstallCompleted({ requestId: 'req-1', status: RequestStatus.COMPLETED } as any);

        expect(manager.save).not.toHaveBeenCalled();
    });

    it('does nothing when the request never got a ticket', async () => {
        schedRepo.findOne.mockResolvedValue(null);

        await listener.onInstallCompleted({ requestId: 'req-1', status: RequestStatus.COMPLETED } as any);

        expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('swallows errors so the hardware request flow is never rolled back', async () => {
        manager.findOne.mockRejectedValue(new Error('db down'));

        await expect(listener.onInstallCompleted({ requestId: 'req-1', status: RequestStatus.COMPLETED } as any))
            .resolves.toBeUndefined();
    });
});
