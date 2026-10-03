import { HardwareScheduleTicketListener } from './hardware-schedule-ticket.listener';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';

/** WIB wall-clock time -> Date (WIB is UTC+7, no DST). */
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe('HardwareScheduleTicketListener — reschedule moves the existing ticket', () => {
    let listener: HardwareScheduleTicketListener;
    let schedRepo: any;
    let ticketRepo: any;
    let workloadService: any;
    let dataSource: any;
    let ticket: any;

    const payload = {
        requestId: 'req-1',
        scheduleId: 'sched-new',
        technicianId: 'tech-2',
        scheduledStart: wib('2026-10-06T09:00:00'),
        scheduledEnd: wib('2026-10-06T11:00:00'),
    };

    beforeEach(() => {
        ticket = {
            id: 'ticket-1', ticketNumber: '011026-ICT-0001', siteId: 'site-1',
            status: TicketStatus.IN_PROGRESS, assignedToId: 'tech-1',
            scheduledDate: wib('2026-10-02T09:00:00'), scheduledTime: '09.00 - 11.00',
        };
        schedRepo = {
            findOne: jest.fn(async ({ where }: any) => (where.id === 'sched-new'
                ? { id: 'sched-new', requestId: 'req-1', ticketId: null, items: [] }
                : { id: 'sched-old', requestId: 'req-1', ticketId: 'ticket-1' })),
            update: jest.fn(),
        };
        ticketRepo = {
            findOne: jest.fn(async () => ticket),
            save: jest.fn(async (t: any) => t),
        };
        workloadService = {
            recalculateAgentWorkload: jest.fn(),
            workloadPointsFor: jest.fn(),
            incrementAgentWorkload: jest.fn(),
        };
        dataSource = { transaction: jest.fn() };

        listener = new HardwareScheduleTicketListener(
            { findOne: jest.fn().mockResolvedValue({ id: 'req-1', requesterId: 'u-1', items: [], siteId: 'site-1' }) } as any,
            schedRepo,
            ticketRepo,
            { findOne: jest.fn().mockResolvedValue({ id: 'tech-2', fullName: 'Tech' }) } as any,
            dataSource,
            workloadService,
            { notifyDashboardStatsUpdate: jest.fn(), notifyNewTicket: jest.fn() } as any,
            { hardwareTarget: jest.fn().mockResolvedValue(wib('2026-10-07T17:00:00')) } as any,
        );
    });

    it('updates date/time/SLA/technician and does not create a second ticket', async () => {
        await listener.onScheduleConfirmed(payload);

        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(ticket.scheduledDate).toEqual(payload.scheduledStart);
        expect(ticket.scheduledTime).toBe('09.00 - 11.00');
        expect(ticket.slaTarget).toEqual(wib('2026-10-07T17:00:00'));
        expect(ticket.assignedToId).toBe('tech-2');
        expect(schedRepo.update).toHaveBeenCalledWith('sched-new', { ticketId: 'ticket-1' });
    });

    it('recalculates both the previous and the new technician', async () => {
        await listener.onScheduleConfirmed(payload);

        const agents = workloadService.recalculateAgentWorkload.mock.calls.map((c: any[]) => c[1]);
        expect(agents.sort()).toEqual(['tech-1', 'tech-2']);
        expect(workloadService.incrementAgentWorkload).not.toHaveBeenCalled();
    });

    it('opens a new ticket when the previous one is already closed', async () => {
        ticket.status = TicketStatus.RESOLVED;
        dataSource.transaction.mockResolvedValue({ id: 'ticket-2', siteId: 'site-1' });

        await listener.onScheduleConfirmed(payload);

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(ticketRepo.save).not.toHaveBeenCalled();
    });
});
