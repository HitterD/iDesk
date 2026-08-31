import { TicketStatus, HandlingTeam } from '../entities/ticket.entity';
import { TicketForwardService } from './ticket-forward.service';

describe('TicketForwardService', () => {
    let service: TicketForwardService;
    let ticketRepo: any;
    let messageRepo: any;
    let slaConfigRepo: any;
    let eventsGateway: any;
    let workloadService: any;
    let businessHoursService: any;

    const baseTicket = {
        id: 't1',
        ticketNumber: 'TK-001',
        status: TicketStatus.IN_PROGRESS,
        priority: 'HIGH',
        handlingTeam: HandlingTeam.OPS_SUPPORT,
        isOverdue: true,
        siteId: 'site-jkt',
        slaStartedAt: new Date('2026-08-01T08:00:00'),
        slaTarget: new Date('2026-08-05T08:00:00'),
        originalSlaTarget: new Date('2026-08-05T08:00:00'),
        assignedTo: null,
        assignedToId: null,
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
        slaConfigRepo = {
            findOne: jest.fn(async () => ({ resolutionTimeMinutes: 480, responseTimeMinutes: 120 })), // HIGH 8h
        };
        eventsGateway = {
            server: {
                to: jest.fn().mockReturnValue({
                    emit: jest.fn(),
                }),
            },
        };
        workloadService = {
            autoAssignTicket: jest.fn(async () => ({
                id: 't1',
                assignedToId: 'agent-ops-1',
                assignedTo: { id: 'agent-ops-1', fullName: 'Ops Agent' },
            })),
        };
        businessHoursService = {
            calculateSlaTarget: jest.fn(async (start: Date, minutes: number) =>
                new Date(start.getTime() + minutes * 60000)
            ),
        };

        service = new TicketForwardService(
            ticketRepo,
            messageRepo,
            slaConfigRepo,
            eventsGateway,
            workloadService as any,
            businessHoursService as any,
        );
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

    it('resets the SLA clock on forward (slaStartedAt=now, slaTarget recalculated)', async () => {
        const result = await service.forwardTicket('t1', dto, actor);

        expect(result.slaStartedAt).toBeInstanceOf(Date);
        expect(result.isOverdue).toBe(false);
        expect(result.originalSlaTarget).toBeInstanceOf(Date);
        // businessHoursService mock adds 480 minutes from now
        const expected = result.slaStartedAt!.getTime() + 480 * 60000;
        expect(result.slaTarget!.getTime()).toBe(expected);
    });

    it('auto-assigns the best OPS agent when forwarding to OPS_SUPPORT', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, handlingTeam: HandlingTeam.ORACLE_DEV }));
        const result = await service.forwardTicket('t1', {
            targetTeam: HandlingTeam.OPS_SUPPORT,
            reason: 'Kembali ke ops support',
        }, actor);

        expect(workloadService.autoAssignTicket).toHaveBeenCalledWith('t1');
        expect(result.assignedToId).toBe('agent-ops-1');
        const msg = messageRepo.save.mock.calls.at(-1)[0];
        expect(msg.content).toContain('Auto-assigned to Ops Agent');
    });

    it('does not auto-assign when forwarding to ORACLE_DEV', async () => {
        await service.forwardTicket('t1', dto, actor);
        expect(workloadService.autoAssignTicket).not.toHaveBeenCalled();
    });

    it('skips auto-assign without failing when no site is set', async () => {
        ticketRepo.findOne = jest.fn(async () => ({
            ...baseTicket,
            handlingTeam: HandlingTeam.ORACLE_DEV,
            siteId: null,
        }));
        const result = await service.forwardTicket('t1', {
            targetTeam: HandlingTeam.OPS_SUPPORT,
            reason: 'ops',
        }, actor);

        expect(result.handlingTeam).toBe(HandlingTeam.OPS_SUPPORT);
        expect(workloadService.autoAssignTicket).not.toHaveBeenCalled();
    });

    it('does not fail the forward when auto-assign throws', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, handlingTeam: HandlingTeam.ORACLE_DEV }));
        workloadService.autoAssignTicket = jest.fn(async () => {
            throw new Error('No available agents for this site');
        });
        const result = await service.forwardTicket('t1', {
            targetTeam: HandlingTeam.OPS_SUPPORT,
            reason: 'ops',
        }, actor);

        expect(result.handlingTeam).toBe(HandlingTeam.OPS_SUPPORT);
        const msg = messageRepo.save.mock.calls.at(-1)[0];
        expect(msg.content).toContain('Auto-assign skipped');
    });
});
