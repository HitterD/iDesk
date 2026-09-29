import { WorkloadService } from './workload.service';
import { TicketStatus } from '../ticketing/entities/ticket.entity';

describe('WorkloadService.onTicketStatusChange — RESOLVED / CLOSED transitions', () => {
    let service: WorkloadService;
    let workloadRepo: any;
    let workload: { totalPoints: number; activeTickets: number; resolvedTickets: number };

    beforeEach(() => {
        workload = { totalPoints: 10, activeTickets: 3, resolvedTickets: 0 };
        workloadRepo = { save: jest.fn(async (w: any) => w) };
        const ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 't1', assignedToId: 'a1', siteId: 's1', priority: 'HIGH' }),
        };

        service = new WorkloadService(
            { logAsync: jest.fn() } as any,
            {} as any,
            workloadRepo,
            ticketRepo as any,
            undefined as any,
            { emit: jest.fn() } as any,
            {} as any,
        );
        jest.spyOn(service, 'getPriorityWeight').mockResolvedValue(4);
        jest.spyOn(service, 'getAgentWorkload').mockResolvedValue(workload as any);
    });

    it('IN_PROGRESS -> RESOLVED reduces workload and counts one resolution', async () => {
        await service.onTicketStatusChange('t1', TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED);

        expect(workload).toEqual({ totalPoints: 6, activeTickets: 2, resolvedTickets: 1 });
    });

    it('RESOLVED -> CLOSED does not reduce or count again', async () => {
        await service.onTicketStatusChange('t1', TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED);
        await service.onTicketStatusChange('t1', TicketStatus.RESOLVED, TicketStatus.CLOSED);

        expect(workload).toEqual({ totalPoints: 6, activeTickets: 2, resolvedTickets: 1 });
        expect(workloadRepo.save).toHaveBeenCalledTimes(1);
    });

    it('IN_PROGRESS -> CLOSED (requester self-resolve) reduces workload and counts a resolution', async () => {
        await service.onTicketStatusChange('t1', TicketStatus.IN_PROGRESS, TicketStatus.CLOSED);

        expect(workload).toEqual({ totalPoints: 6, activeTickets: 2, resolvedTickets: 1 });
    });

    it('TODO -> CANCELLED reduces workload without counting a resolution', async () => {
        await service.onTicketStatusChange('t1', TicketStatus.TODO, TicketStatus.CANCELLED);

        expect(workload).toEqual({ totalPoints: 6, activeTickets: 2, resolvedTickets: 0 });
    });
});
