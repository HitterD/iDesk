import { TicketQueryService } from './ticket-query.service';
import { UserRole } from '../../users/enums/user-role.enum';

const OPS_SUPPORT_ONLY =
    '(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)';
const OPS_SUPPORT_PARAMS = {
    opsTeam: 'OPS_SUPPORT',
};
const ORACLE_ONLY =
    '(ticket."handlingTeam" = :oracleTeam)';
const ORACLE_FILTER_PARAMS = {
    oracleTeam: 'ORACLE_DEV',
};

describe('TicketQueryService', () => {
    let service: any;
    let mockRepo: any;
    let mockQueryBuilder: any;

    beforeEach(() => {
        mockQueryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(0),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            getMany: jest.fn().mockResolvedValue([]),
        };

        mockRepo = {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        service = new TicketQueryService(
            mockRepo,
            {} as any, // slaConfigRepo
            {} as any  // cacheService
        );
    });

    it('should apply excludeCategory, startDate, and endDate filters', async () => {
        const options = {
            excludeCategory: 'Hardware Request',
            startDate: '2023-01-01',
            endDate: '2023-12-31'
        };

        await service.findAllPaginated('user1', UserRole.ADMIN, null, options);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ticket.category NOT IN (:...excludeCategories)', { excludeCategories: ['Hardware Request'] });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ticket.createdAt >= :startDate', { startDate: '2023-01-01' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ticket.createdAt <= :endDate', { endDate: '2023-12-31' });
    });

    it('does not filter out handling team for USER role', async () => {
        await service.findAllPaginated('user-1', UserRole.USER, 'site-1');

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
            '(ticket.userId = :userId OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp."ticketId" = ticket.id AND tp."userId" = :userId))',
            { userId: 'user-1' },
        );
        expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
            OPS_SUPPORT_ONLY,
            OPS_SUPPORT_PARAMS,
        );
    });

    it.each([
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.AGENT,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ADMIN,
        UserRole.AGENT_ORACLE,
    ])('keeps developer queues out of the general paginated list for %s', async (role) => {
        await service.findAllPaginated('actor-1', role, 'site-1');

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
            OPS_SUPPORT_ONLY,
            OPS_SUPPORT_PARAMS,
        );
    });

    it('keeps the Oracle queue Oracle-only', async () => {
        await service.findAllPaginatedOracle('oracle-1', UserRole.AGENT_ORACLE, 'site-1');

        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
            ORACLE_ONLY,
            ORACLE_FILTER_PARAMS,
        );
    });
});
