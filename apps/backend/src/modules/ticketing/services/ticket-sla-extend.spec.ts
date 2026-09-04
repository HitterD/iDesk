import { TicketStatus } from '../entities/ticket.entity';
import { TicketSlaExtendService } from './ticket-sla-extend.service';
import { SlaAdjustment, SlaAdjustmentReasonCategory } from '../entities/sla-adjustment.entity';

const NOW = new Date('2026-08-31T09:00:00');

describe('TicketSlaExtendService', () => {
    let service: TicketSlaExtendService;
    let ticketRepo: any;
    let adjustmentRepo: any;
    let slaConfigRepo: any;
    let businessHoursService: any;

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
        businessHoursService = {
            calculateBusinessMinutes: jest.fn(async () => 120), // 2h elapsed
            calculateSlaTarget: jest.fn(async (start: Date, minutes: number) =>
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
            businessHoursService,
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

    it('rejects a ticket in WAITING_VENDOR', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.WAITING_VENDOR }));
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('SLA can only be extended');
    });

    it('rejects a RESOLVED ticket', async () => {
        ticketRepo.findOne = jest.fn(async () => ({ ...baseTicket, status: TicketStatus.RESOLVED }));
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('SLA can only be extended');
    });

    it('rejects an extension exceeding the cap (2x + 8h business)', async () => {
        // Cap = 2x480 + 480 = 1440. elapsed 1400 + 60 = 1460 > 1440
        businessHoursService.calculateBusinessMinutes = jest.fn(async () => 1400);
        await expect(service.extendSla('t1', dto, actor)).rejects.toThrow('melebihi batas yang diizinkan');
    });

    it('rejects an extension when prior extends already push the total over cap', async () => {
        adjustmentRepo.createQueryBuilder = jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ total: '1400' }),
        }));
        await expect(
            service.extendSla('t1', { ...dto, minutes: 100 }, actor)
        ).rejects.toThrow('melebihi batas yang diizinkan');
    });

    it('extends the target by manual newTargetDate and creates system message', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const targetDateStr = tomorrow.toISOString();
        businessHoursService.calculateBusinessMinutes = jest.fn(async () => 480);

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
