import { TicketStatus } from '../entities/ticket.entity';
import { TicketSlaExtendService } from './ticket-sla-extend.service';
import { SlaAdjustment, SlaAdjustmentReasonCategory } from '../entities/sla-adjustment.entity';

const NOW = new Date('2026-08-31T09:00:00');

describe('TicketSlaExtendService', () => {
    let service: TicketSlaExtendService;
    let ticketRepo: any;
    let adjustmentRepo: any;
    let slaConfigRepo: any;
    let slaClock: any;

    let messageRepo: any;
    let eventsGateway: any;

    const baseTicket = {
        id: 't1',
        ticketNumber: 'TK-001',
        status: TicketStatus.IN_PROGRESS,
        priority: 'HIGH',
        slaTarget: new Date('2026-08-31T17:00:00'),
        slaStartedAt: new Date('2026-08-31T08:00:00'),
        originalSlaTarget: new Date('2026-08-31T17:00:00'),
        isOverdue: false,
    };

    beforeEach(() => {
        ticketRepo = {
            findOne: jest.fn(async () => ({ ...baseTicket })),
            save: jest.fn(async (t: any) => t),
        };
        adjustmentRepo = {
            create: jest.fn((d: any) => d),
            save: jest.fn(async (a: any) => ({ id: 'adj-1', ...a })),
            createQueryBuilder: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
            })),
        };
        slaConfigRepo = {
            findOne: jest.fn(async () => ({ resolutionTimeMinutes: 480 })), // HIGH, 8h
        };
        messageRepo = {
            create: jest.fn((d: any) => d),
            save: jest.fn(async (m: any) => ({ id: 'msg-1', ...m })),
        };
        slaClock = {
            minutesBetween: jest.fn(async () => 120), // 2h elapsed
            targetFor: jest.fn(async (_priority: string, start: Date, minutes: number) =>
                new Date(start.getTime() + minutes * 60000)
            ),
        };
        eventsGateway = {
            server: {
                to: jest.fn().mockReturnThis(),
                emit: jest.fn(),
            },
        };

        service = new TicketSlaExtendService(
            ticketRepo,
            adjustmentRepo,
            slaConfigRepo,
            messageRepo,
            slaClock,
            eventsGateway,
        );
    });

    const dto = {
        reasonCategory: SlaAdjustmentReasonCategory.WAITING_VENDOR,
        reasonText: 'Waiting for vendor to ship part',
        minutes: 60,
    };
    const actor = { userId: 'u-agent', role: 'AGENT' };

    it('extends the target by business minutes and records the adjustment', async () => {
        const result = await service.extendSla('t1', dto, actor);

        expect(result.ticket.slaTarget!.getTime()).toBe(baseTicket.slaTarget!.getTime() + 60 * 60000);
        expect(result.adjustment.minutes).toBe(60);
        expect(result.adjustment.reasonText).toBe('Waiting for vendor to ship part');
        expect(result.adjustment.previousTarget).toEqual(baseTicket.slaTarget);
        expect(result.adjustment.actorId).toBe('u-agent');
    });

    it('clears the overdue marker when extending', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, isOverdue: true }));
        const result = await service.extendSla('t1', dto, actor);
        expect(result.ticket.isOverdue).toBe(false);
    });

    it('rejects a ticket without started SLA clock', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, slaStartedAt: null }));
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('SLA clock has not started');
    });

    it('extends a paused ticket by adding to slaRemainingMinutes', async () => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 120, siteId: 'site-1' });

        const result = await service.extendSla('t1', dto, actor);

        expect(result.ticket.slaRemainingMinutes).toBe(180);
        expect(result.ticket.slaTarget).toEqual(baseTicket.slaTarget);
        expect(result.adjustment).toMatchObject({ minutes: 60,
            previousTarget: baseTicket.slaTarget, newTarget: baseTicket.slaTarget });
        expect(adjustmentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ minutes: 60 }));
        expect(messageRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('ditambah 60 menit (dijeda)'),
        }));
        expect(eventsGateway.server.to).toHaveBeenCalledWith('ticket:t1');
        expect(eventsGateway.server.to).toHaveBeenCalledWith('site:site-1');
        expect(eventsGateway.server.emit).toHaveBeenCalledWith('ticket:updated', { ticketId: 't1' });
    });

    it('rejects newTargetDate while paused', async () => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 120 });
        await expect(service.extendSla('t1', { ...dto, newTargetDate: NOW.toISOString() }, actor))
            .rejects.toThrow('SLA sedang dijeda; perpanjang dengan jumlah menit, bukan tanggal');
        expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('requires a started clock even while paused', async () => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 120, slaStartedAt: null });
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('SLA clock has not started');
    });

    it('extends a held clock with no target without creating a deadline', async () => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 0, slaTarget: null });
        const result = await service.extendSla('t1', dto, actor);
        expect(result.ticket.slaRemainingMinutes).toBe(60);
        expect(result.ticket.slaTarget).toBeNull();
        expect(result.adjustment).toMatchObject({ previousTarget: null, newTarget: null, minutes: 60 });
    });

    it('rejects paused extensions projected beyond the 90-day ceiling', async () => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 120 });
        slaClock.targetFor.mockResolvedValue(new Date(Date.now() + 91 * 24 * 60 * 60 * 1000));
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('tidak boleh melebihi 90 hari ke depan');
        expect(slaClock.targetFor).toHaveBeenCalledWith(baseTicket.priority, expect.any(Date), 180);
        expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it.each([0, -1, undefined])('rejects invalid paused extension minutes: %s', async (minutes) => {
        ticketRepo.findOne.mockResolvedValue({ ...baseTicket, status: TicketStatus.WAITING_VENDOR,
            slaRemainingMinutes: 120 });
        await expect(service.extendSla('t1', { ...dto, minutes }, actor))
            .rejects.toThrow('Harap tentukan menit perpanjangan atau tanggal deadline baru');
    });

    it('rejects a RESOLVED ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.RESOLVED }));
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('SLA can only be extended');
    });

    it('allows long extensions exceeding old business hours cap (e.g. 30 days ahead)', async () => {
        const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        slaClock.minutesBetween = jest.fn(async () => 14400); // 30 days of business minutes

        const result = await service.extendSla('t1', {
            ...dto,
            newTargetDate: thirtyDaysLater.toISOString(),
        }, actor);

        expect(result.ticket.slaTarget).toEqual(thirtyDaysLater);
        expect(result.ticket.isOverdue).toBe(false);
    });

    it('rejects an extension exceeding the 90-day sanity limit', async () => {
        const ninetyOneDaysLater = new Date(Date.now() + 92 * 24 * 60 * 60 * 1000);
        await expect(
            service.extendSla('t1', { ...dto, newTargetDate: ninetyOneDaysLater.toISOString() }, actor)
        ).rejects.toThrow('tidak boleh melebihi 90 hari ke depan');
    });

    it('extends the target by manual newTargetDate and creates system message', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const targetDateStr = tomorrow.toISOString();
        slaClock.minutesBetween = jest.fn(async () => 480);

        const result = await service.extendSla('t1', {
            reasonCategory: SlaAdjustmentReasonCategory.TECHNICAL_COMPLEXITY,
            reasonText: 'Need deeper investigation',
            newTargetDate: targetDateStr,
        }, actor);

        expect(result.ticket.slaTarget).toEqual(new Date(targetDateStr));
        expect(messageRepo.create).toHaveBeenCalled();
        expect(messageRepo.save).toHaveBeenCalled();
    });
});
