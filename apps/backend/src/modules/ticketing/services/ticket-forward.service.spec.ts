import { TicketStatus, HandlingTeam } from '../entities/ticket.entity';
import { TicketForwardService } from './ticket-forward.service';

describe('TicketForwardService', () => {
    let service: TicketForwardService;
    let ticketRepo: any;
    let messageRepo: any;
    let eventsGateway: any;

    const baseTicket = {
        id: 't1',
        ticketNumber: 'TK-001',
        status: TicketStatus.IN_PROGRESS,
        handlingTeam: HandlingTeam.OPS_SUPPORT,
        isOverdue: true,
        siteId: 'site-jkt',
    };

    beforeEach(() => {
        ticketRepo = {
            findOne: jest.fn(async () => ({ ...baseTicket })),
            save: jest.fn(async (t: any) => t),
        };
        messageRepo = {
            create: jest.fn((m: any) => m),
            save: jest.fn(async (m: any) => ({ id: 'msg-1', ...m })),
        };
        eventsGateway = {
            server: {
                to: jest.fn().mockReturnValue({
                    emit: jest.fn(),
                }),
            },
        };
        service = new TicketForwardService(ticketRepo, messageRepo, eventsGateway as any);
    });

    const dto = {
        targetTeam: HandlingTeam.ORACLE_DEV,
        reason: 'Masalahnya di sisi aplikasi Oracle, butuh developer',
    };
    const actor = { userId: 'u-agent', fullName: 'Agent One' };

    it('moves the ticket to the target team and records a system message', async () => {
        const result = await service.forwardTicket('t1', dto, actor);

        expect(result.handlingTeam).toBe(HandlingTeam.ORACLE_DEV);
        expect(messageRepo.save).toHaveBeenCalledTimes(1);
        const msg = messageRepo.save.mock.calls[0][0];
        expect(msg.content).toContain('from OPS_SUPPORT to ORACLE_DEV');
        expect(msg.content).toContain(dto.reason);
    });

    it('clears the overdue marker on forward', async () => {
        const result = await service.forwardTicket('t1', dto, actor);
        expect(result.isOverdue).toBe(false);
    });

    it('rejects a forward to the same team', async () => {
        await expect(
            service.forwardTicket('t1', { targetTeam: HandlingTeam.OPS_SUPPORT, reason: 'no-op' }, actor)
        ).rejects.toThrow('already handled');
    });

    it('rejects forwarding a resolved ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.RESOLVED }));
        await expect(service.forwardTicket('t1', dto, actor)).rejects.toThrow('resolved or cancelled');
    });

    it('rejects forwarding a cancelled ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.CANCELLED }));
        await expect(service.forwardTicket('t1', dto, actor)).rejects.toThrow('resolved or cancelled');
    });

    it('emits a ticket update to the site channel', async () => {
        await service.forwardTicket('t1', dto, actor);
        expect(eventsGateway.server.to).toHaveBeenCalledWith('site:site-jkt');
    });
});
