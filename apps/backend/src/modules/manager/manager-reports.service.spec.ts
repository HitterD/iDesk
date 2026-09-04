import { ManagerReportsService } from './manager-reports.service';
import { ReportType } from './dto';
import { UserRole } from '../users/enums/user-role.enum';

// Actor cross-site (MANAGER) — resolveSiteScope() → mode 'all'.
const MANAGER_ACTOR = { role: UserRole.MANAGER, siteId: 'site-x' };

describe('ManagerReportsService.getAgentPerformance — query count', () => {
    let service: ManagerReportsService;
    let ticketRepo: any;
    let userRepo: any;
    let siteRepo: any;

    const agent = (id: string) => ({ id, fullName: `Agent ${id}`, role: UserRole.AGENT, site: { code: 'SPJ' } });

    beforeEach(() => {
        ticketRepo = {
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                setParameters: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                addGroupBy: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };
        userRepo = { find: jest.fn() };
        siteRepo = { find: jest.fn().mockResolvedValue([]) };

        service = new ManagerReportsService(ticketRepo, userRepo, siteRepo);
    });

    it('issues a fixed number of ticket queries regardless of agent count', async () => {
        userRepo.find.mockResolvedValue([agent('a1'), agent('a2'), agent('a3')]);

        await service.generateReport({
            reportType: ReportType.CONSOLIDATED,
            includeTicketStats: false,
            includeAgentPerformance: true,
            includeSlaMetrics: false,
            sections: ['agents'],
        } as any, MANAGER_ACTOR);

        // One grouped count query (createQueryBuilder) + one find for resolved tickets,
        // no matter how many agents — not 2 queries per agent.
        expect(ticketRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(ticketRepo.find).toHaveBeenCalledTimes(1);
        expect(ticketRepo.count).not.toHaveBeenCalled();
    });

    it('returns empty performance list without querying tickets when there are no agents', async () => {
        userRepo.find.mockResolvedValue([]);

        const report = await service.generateReport({
            reportType: ReportType.CONSOLIDATED,
            includeTicketStats: false,
            includeAgentPerformance: true,
            includeSlaMetrics: false,
            sections: ['agents'],
        } as any, MANAGER_ACTOR);

        expect(report.agentPerformance).toEqual([]);
        expect(ticketRepo.createQueryBuilder).not.toHaveBeenCalled();
        expect(ticketRepo.find).not.toHaveBeenCalled();
    });
});
