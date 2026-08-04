import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';

describe('WorkloadService — query count for multi-agent operations', () => {
    let service: WorkloadService;
    let priorityWeightRepo: any;
    let workloadRepo: any;
    let ticketRepo: any;
    let userRepo: any;

    const agent = (id: string) => ({ id, fullName: `Agent ${id}`, email: `${id}@x.com`, role: UserRole.AGENT, siteId: 'site-1', site: { code: 'SPJ', name: 'Site' } });

    beforeEach(() => {
        priorityWeightRepo = { find: jest.fn().mockResolvedValue([]) };
        workloadRepo = {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(async (rows: any) => (Array.isArray(rows) ? rows.map((r, i) => ({ ...r, id: `w${i}` })) : { ...rows, id: 'w1' })),
            create: jest.fn((data: any) => data),
        };
        ticketRepo = { find: jest.fn().mockResolvedValue([]), count: jest.fn() };
        userRepo = { find: jest.fn() };

        service = new WorkloadService(
            { logAsync: jest.fn() } as any,
            priorityWeightRepo,
            workloadRepo,
            ticketRepo,
            userRepo,
            { emit: jest.fn() } as any,
        );
    });

    it('getAllAgentWorkloads issues a fixed number of queries regardless of agent count', async () => {
        userRepo.find.mockResolvedValue([agent('a1'), agent('a2'), agent('a3')]);

        await service.getAllAgentWorkloads('site-1');

        // 1 workload lookup + 1 save-for-missing + 1 active-tickets fetch, not 2 queries per agent.
        expect(workloadRepo.find).toHaveBeenCalledTimes(1);
        expect(workloadRepo.save).toHaveBeenCalledTimes(1);
        expect(ticketRepo.find).toHaveBeenCalledTimes(1);
    });

    it('getAllAgentWorkloads returns empty without querying tickets when there are no agents', async () => {
        userRepo.find.mockResolvedValue([]);

        const result = await service.getAllAgentWorkloads('site-1');

        expect(result).toEqual([]);
        expect(workloadRepo.find).not.toHaveBeenCalled();
        expect(ticketRepo.find).not.toHaveBeenCalled();
    });

    it('findBestAgentForAssignment issues a fixed number of workload queries regardless of agent count', async () => {
        userRepo.find.mockResolvedValue([agent('a1'), agent('a2'), agent('a3')]);

        const best = await service.findBestAgentForAssignment('site-1');

        expect(workloadRepo.find).toHaveBeenCalledTimes(1);
        expect(workloadRepo.save).toHaveBeenCalledTimes(1);
        expect(best).not.toBeNull();
    });

    it('recalculateAgentWorkload fetches priority weights once, not once per ticket', async () => {
        ticketRepo.find.mockResolvedValue([
            { priority: 'HIGH', status: 'TODO' },
            { priority: 'LOW', status: 'IN_PROGRESS' },
            { priority: 'CRITICAL', status: 'WAITING_VENDOR' },
        ]);
        ticketRepo.count.mockResolvedValue(0);
        workloadRepo.find = undefined; // recalculateAgentWorkload uses findOne, not find
        workloadRepo.findOne = jest.fn().mockResolvedValue(null);
        workloadRepo.save = jest.fn(async (w: any) => ({ ...w, id: 'w1' }));

        await service.recalculateAgentWorkload('a1', 'site-1');

        expect(priorityWeightRepo.find).toHaveBeenCalledTimes(1);
    });
});
