import { TicketStatsService } from './ticket-stats.service';

describe('TicketStatsService', () => {
    let service: any;
    let mockRepo: any;
    let mockQueryBuilder: any;

    beforeEach(() => {
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({
                total: '10',
                pending: '3',
                inProgress: '5',
                completed: '2'
            }),
        };

        mockRepo = {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        service = new TicketStatsService(
            mockRepo,
            { getOrSet: jest.fn().mockImplementation(async (key, cb) => await cb()) } as any, // mock cache
            {} as any // cache invalidation service
        );
    });

    it('should calculate hardware installation stats', async () => {
        const stats = await service.getHardwareInstallationStats('user1');
        
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('ticket.isHardwareInstallation = true');
        expect(stats).toEqual({
            total: 10,
            pending: 3,
            inProgress: 5,
            completed: 2
        });
    });
});
