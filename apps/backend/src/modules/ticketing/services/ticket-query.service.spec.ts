import { TicketQueryService } from './ticket-query.service';
import { UserRole } from '../../users/enums/user-role.enum';

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
});
