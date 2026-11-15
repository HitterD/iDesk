import { TicketStatus, HandlingTeam } from '../entities/ticket.entity';
import { TicketForwardService } from './ticket-forward.service';
import { createTestSlaClock } from './sla-clock.testing';

describe('TicketForwardService', () => {
    let service: TicketForwardService;
    let ticketRepo: any;
    let messageRepo: any;
    let slaConfigRepo: any;
    let eventsGateway: any;
    let workloadService: any;

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

        service = new TicketForwardService(
            ticketRepo,
            messageRepo,
            slaConfigRepo,
            eventsGateway,
            workloadService as any,
            createTestSlaClock([{ priority: 'HIGH', resolutionTimeMinutes: 480, responseTimeMinutes: 120 }]),
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

    it('remembers the team it came from, when and by whom', async () => {
        const result = await service.forwardTicket('t1', dto, actor);

        expect(result.forwardedFromTeam).toBe(HandlingTeam.OPS_SUPPORT);
        expect(result.forwardedAt).toBeInstanceOf(Date);
        expect(result.forwardedById).toBe('u-agent');
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
        await expect(service.forwardTicket('t1', dto, actor)).rejects.toThrow('resolved, closed or cancelled');
    });

    it('rejects forwarding a cancelled ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.CANCELLED }));
        await expect(service.forwardTicket('t1', dto, actor)).rejects.toThrow('resolved, closed or cancelled');
    });

    it('rejects forwarding a closed ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.CLOSED }));
        await expect(service.forwardTicket('t1', dto, actor)).rejects.toThrow('resolved, closed or cancelled');
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
        // Round-the-clock test schedule: 480 minutes from now
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

    it('restarts a WAITING_VENDOR ticket with a full budget that stays held until the vendor answers', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.WAITING_VENDOR }));

        const result = await service.forwardTicket('t1', dto, actor);

        expect(result.slaRemainingMinutes).toBe(480);
        expect(result.isOverdue).toBe(false);
    });

    it('forwards OPS_SUPPORT ticket across self-handled sites, recalculates old PIC workload, preserves category/ticketNumber, notifies when unassigned, and emits to both sites', async () => {
        const spjSite = { id: 'site-spj', code: 'SPJ', name: 'Sepanjang', isActive: true, handledBySiteId: null };
        const krwSite = { id: 'site-krw', code: 'KRW', name: 'Karawang', isActive: true, handledBySiteId: null };
        const siteRepo = {
            findOne: jest.fn(async ({ where }: any) => (where.id === 'site-krw' ? krwSite : where.id === 'site-spj' ? spjSite : null)),
        };
        const userRepo = {
            find: jest.fn(async () => [{ id: 'krw-agent-1' }, { id: 'u-agent' }]),
        };
        const notificationService = { notifyNewTicketToAdmins: jest.fn(async () => undefined) };
        const emitter = { emit: jest.fn() };
        const gw: any = {
            server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            emitToTicketAudience: jest.fn(),
            notifyTicketListUpdate: jest.fn(),
            notifyDashboardStatsUpdate: jest.fn(),
        };
        workloadService.recalculateAgentWorkload = jest.fn(async () => ({}));
        workloadService.autoAssignTicket = jest.fn(async () => { throw new Error('auto-assign disabled'); });

        const opsTicket = {
            ...baseTicket,
            ticketNumber: '141126-PRO-0002',
            title: 'Outlook issue',
            category: 'EMAIL',
            priority: 'URGENT',
            siteId: 'site-spj',
            site: spjSite,
            assignedToId: 'old-spj-pic',
            assignedTo: { id: 'old-spj-pic', fullName: 'Beni Saputra' },
            user: { fullName: 'Sandy' },
        };
        ticketRepo.findOne = jest.fn(async () => ({ ...opsTicket }));

        const fullService = new TicketForwardService(
            ticketRepo,
            messageRepo,
            slaConfigRepo,
            gw,
            workloadService,
            createTestSlaClock([{ priority: 'URGENT', resolutionTimeMinutes: 480, responseTimeMinutes: 60 }]),
            emitter as any,
            siteRepo as any,
            userRepo as any,
            notificationService as any,
        );

        const result = await fullService.forwardTicket('t1', {
            targetTeam: HandlingTeam.OPS_SUPPORT,
            targetSiteId: 'site-krw',
            reason: 'Salah routing awal: Lokasi user di Karawang',
        }, actor);

        expect(result.ticketNumber).toBe('141126-PRO-0002');
        expect(result.category).toBe('EMAIL');
        expect(result.handlingTeam).toBe(HandlingTeam.OPS_SUPPORT);
        expect(result.siteId).toBe('site-krw');
        expect(result.forwardedFromSiteId).toBe('site-spj');
        expect(result.forwardedFromTeam).toBe(HandlingTeam.OPS_SUPPORT);
        expect(result.assignedToId).toBeNull();
        expect(workloadService.recalculateAgentWorkload).toHaveBeenCalledWith(
            expect.objectContaining({ siteId: 'site-spj' }),
            'old-spj-pic',
            'site-spj',
        );
        expect(notificationService.notifyNewTicketToAdmins).toHaveBeenCalledWith(
            't1', '141126-PRO-0002', 'Outlook issue', 'URGENT', 'EMAIL', 'Sandy', ['krw-agent-1'],
        );
        expect(gw.notifyTicketListUpdate).toHaveBeenCalledWith('site-spj');
        expect(gw.notifyTicketListUpdate).toHaveBeenCalledWith('site-krw');
        expect(emitter.emit).toHaveBeenCalledWith('tv-board.ticket-changed', { siteId: 'site-spj' });
        expect(emitter.emit).toHaveBeenCalledWith('tv-board.ticket-changed', { siteId: 'site-krw' });
        const sysMsg = messageRepo.save.mock.calls.at(-1)[0].content;
        expect(sysMsg).toContain('Ticket forwarded from OPS_SUPPORT to OPS_SUPPORT by Agent One.');
        expect(sysMsg).toContain('Site forwarded: SPJ -> KRW');
    });

    it('rejects forwarding to a delegated or inactive site, or cross-site by non-handler agent', async () => {
        const siteRepo = {
            findOne: jest.fn(async ({ where }: any) => {
                if (where.id === 'site-skd') return { id: 'site-skd', code: 'SKD', isActive: true, handledBySiteId: 'site-spj' };
                if (where.id === 'site-off') return { id: 'site-off', code: 'OFF', isActive: false, handledBySiteId: null };
                return null;
            }),
        };
        const gw: any = { server: { to: jest.fn(() => ({ emit: jest.fn() })) } };
        const fullService = new TicketForwardService(
            ticketRepo,
            messageRepo,
            slaConfigRepo,
            gw,
            workloadService,
            createTestSlaClock([]),
            undefined,
            siteRepo as any,
        );

        await expect(
            fullService.forwardTicket('t1', { targetTeam: HandlingTeam.OPS_SUPPORT, targetSiteId: 'site-skd', reason: 'delegated' }, actor),
        ).rejects.toThrow('delegated site');

        await expect(
            fullService.forwardTicket('t1', { targetTeam: HandlingTeam.OPS_SUPPORT, targetSiteId: 'site-off', reason: 'inactive' }, actor),
        ).rejects.toThrow('not found or inactive');

        await expect(
            fullService.forwardTicket('t1', dto, { userId: 'u-other', fullName: 'Other', role: 'AGENT', siteId: 'site-krw' }),
        ).rejects.toThrow('Access to tickets from other sites is forbidden');
    });
});
