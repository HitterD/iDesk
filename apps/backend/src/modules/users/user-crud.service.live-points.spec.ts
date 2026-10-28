import { UserCrudService } from './user-crud.service';
import { UserRole } from './enums/user-role.enum';
import { TicketStatus } from '../ticketing/entities/ticket.entity';

const qb = (overrides: Record<string, unknown> = {}) => {
    const q: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), groupBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), getRawMany: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
    return q;
};

/**
 * "Load Pts" on the Admin Agents page used to read the stored daily workload row
 * (and picked yesterday's row before 07:00 WIB). It now comes from the tickets.
 */
describe('UserCrudService.getAgentStats — live workload points', () => {
    it('reports points from workable tickets only, ignoring any stored row', async () => {
        const agents = [{ id: 'a1', fullName: 'Bagastyo', email: 'b@x', role: UserRole.AGENT, siteId: 's1', appraisalPoints: 0 }];
        const storedRowQb = qb({ getRawMany: jest.fn().mockResolvedValue([{ agentId: 'a1', activeWorkloadPoints: '13' }]) });
        const userRepo = {
            createQueryBuilder: jest.fn().mockReturnValue(qb({ getMany: jest.fn().mockResolvedValue(agents) })),
            manager: { createQueryBuilder: jest.fn().mockReturnValue(storedRowQb) },
        };
        const ticketRepo = {
            createQueryBuilder: jest.fn(() => qb()),
            find: jest.fn().mockResolvedValue([
                { priority: 'LOW', status: TicketStatus.IN_PROGRESS, assignedToId: 'a1', isHardwareInstallation: false, scheduledDate: null },
                { priority: 'LOW', status: TicketStatus.TODO, assignedToId: 'a1', isHardwareInstallation: false, scheduledDate: null },
                { priority: 'HIGH', status: TicketStatus.WAITING_VENDOR, assignedToId: 'a1', isHardwareInstallation: false, scheduledDate: null },
            ]),
        };
        const service = new UserCrudService(
            userRepo as never, ticketRepo as never, {} as never, {} as never, {} as never, {} as never, {} as never, undefined,
            { find: jest.fn().mockResolvedValue([]) } as never,
        );

        const result = await service.getAgentStats();

        expect(result.agents[0].activeWorkloadPoints).toBe(2);
    });
});
