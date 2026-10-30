import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';
import { TicketPriority, TicketStatus } from '../ticketing/entities/ticket.entity';
import { SiteActor } from '../../shared/core/utils/site-scope.util';

/** WIB wall-clock time -> Date (WIB is UTC+7, no DST). */
const wib = (iso: string) => new Date(`${iso}+07:00`);

// 2026-10-01 is a Thursday; installation weight HARDWARE_INSTALLATION = 3, HIGH = 4.
describe('WorkloadService — installation tickets count from install day (H)', () => {
    let service: WorkloadService;
    let workloadRepo: any;
    let ticketRepo: any;
    let userRepo: any;

    const adminActor: SiteActor = { role: UserRole.ADMIN, siteId: null };
    const installOn = (iso: string, extra: Record<string, unknown> = {}) => ({
        id: `t-${iso}`,
        priority: TicketPriority.HARDWARE_INSTALLATION,
        status: TicketStatus.IN_PROGRESS,
        isHardwareInstallation: true,
        scheduledDate: wib(iso),
        assignedToId: 'tech-1',
        siteId: 'site-1',
        ...extra,
    });

    beforeEach(() => {
        jest.useFakeTimers({ now: wib('2026-10-01T10:00:00'), doNotFake: ['nextTick', 'setImmediate'] });
        workloadRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((data: any) => data),
            save: jest.fn(async (w: any) => ({ ...w, id: 'w1' })),
        };
        ticketRepo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
        userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'tech-1', role: UserRole.AGENT }) };

        service = new WorkloadService(
            { logAsync: jest.fn() } as any,
            { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) } as any,
            workloadRepo,
            ticketRepo,
            userRepo,
            { emit: jest.fn() } as any,
            {} as any,
        );
    });

    afterEach(() => jest.useRealTimers());

    it('workloadPointsFor is 0 before H and the full weight from 08:00 on H', async () => {
        const ticket = installOn('2026-10-02T13:00:00');
        expect(await service.workloadPointsFor(ticket, wib('2026-10-01T16:00:00'))).toBe(0);
        expect(await service.workloadPointsFor(ticket, wib('2026-10-02T08:00:00'))).toBe(3);
    });

    it('recalculate skips a future install but keeps it as an active ticket', async () => {
        ticketRepo.find.mockResolvedValue([
            installOn('2026-10-05T09:00:00'),
            { priority: TicketPriority.HIGH, status: TicketStatus.TODO, isHardwareInstallation: false },
        ]);

        const saved = await service.recalculateAgentWorkload(adminActor, 'tech-1', 'site-1');

        expect(saved.totalPoints).toBe(4);
        expect(saved.activeTickets).toBe(2);
    });

    it('recalculate counts an install whose day has opened', async () => {
        ticketRepo.find.mockResolvedValue([installOn('2026-10-01T14:00:00')]);

        const saved = await service.recalculateAgentWorkload(adminActor, 'tech-1', 'site-1');

        expect(saved.totalPoints).toBe(3);
    });

    it('stores the WIB date as the workload day, even before 07:00 WIB (UTC still yesterday)', async () => {
        jest.setSystemTime(wib('2026-10-01T02:00:00'));

        const saved = await service.recalculateAgentWorkload(adminActor, 'tech-1', 'site-1');

        expect((saved.workDate as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('activation job recalculates only technicians whose install day opened today', async () => {
        const recalc = jest.spyOn(service, 'recalculateAgentWorkload').mockResolvedValue({} as any);
        ticketRepo.find.mockResolvedValue([
            installOn('2026-10-01T14:00:00', { assignedToId: 'tech-today' }),
            installOn('2026-10-02T09:00:00', { assignedToId: 'tech-tomorrow' }),
            installOn('2026-09-30T09:00:00', { assignedToId: 'tech-yesterday' }),
        ]);

        const count = await service.activateInstallDayWorkloads(wib('2026-10-01T08:05:00'));

        expect(count).toBe(1);
        expect(recalc).toHaveBeenCalledTimes(1);
        expect(recalc).toHaveBeenCalledWith(expect.anything(), 'tech-today', 'site-1');
    });

    it('activation job does nothing before opening time', async () => {
        const recalc = jest.spyOn(service, 'recalculateAgentWorkload').mockResolvedValue({} as any);
        ticketRepo.find.mockResolvedValue([installOn('2026-10-01T14:00:00')]);

        expect(await service.activateInstallDayWorkloads(wib('2026-10-01T07:50:00'))).toBe(0);
        expect(recalc).not.toHaveBeenCalled();
    });
});
