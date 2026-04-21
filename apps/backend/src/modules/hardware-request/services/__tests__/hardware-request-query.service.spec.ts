import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestQueryService, ActingUser } from '../hardware-request-query.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRole } from '../../domain/enums/hardware-role.enum';
import { HardwareRequestNotFoundError, PermissionDeniedError } from '../../domain/errors';
import { RequestStatus } from '../../domain/enums/request-status.enum';

describe('HardwareRequestQueryService', () => {
    let service: HardwareRequestQueryService;
    let repo: any;

    beforeEach(async () => {
        repo = {
            createQueryBuilder: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HardwareRequestQueryService,
                {
                    provide: getRepositoryToken(HardwareRequest),
                    useValue: repo,
                },
            ],
        }).compile();

        service = module.get<HardwareRequestQueryService>(HardwareRequestQueryService);
    });

    describe('findById', () => {
        it('should return request if found', async () => {
            const req = new HardwareRequest();
            req.id = '123';
            repo.findOne.mockResolvedValue(req);

            const result = await service.findById('123');
            expect(result).toBe(req);
            expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '123' } }));
        });

        it('should throw NotFound if not found', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.findById('123')).rejects.toThrow(HardwareRequestNotFoundError);
        });
    });

    describe('getById', () => {
        const user: ActingUser = { id: 'u1', role: HardwareRole.USER };

        it('should throw NotFound if not found', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.getById(user, '123')).rejects.toThrow(HardwareRequestNotFoundError);
        });

        it('should throw PermissionDenied if role USER and requesterId mismatch', async () => {
            const req = new HardwareRequest();
            req.id = '123';
            req.requesterId = 'u2';
            repo.findOne.mockResolvedValue(req);

            await expect(service.getById(user, '123')).rejects.toThrow(PermissionDeniedError);
        });

        it('should return request if role USER and requesterId match', async () => {
            const req = new HardwareRequest();
            req.id = '123';
            req.requesterId = 'u1';
            repo.findOne.mockResolvedValue(req);

            const result = await service.getById(user, '123');
            expect(result).toBe(req);
        });

        it('should return request if role is not USER regardless of requesterId', async () => {
            const admin: ActingUser = { id: 'a1', role: HardwareRole.ICT_STAFF };
            const req = new HardwareRequest();
            req.id = '123';
            req.requesterId = 'u2';
            repo.findOne.mockResolvedValue(req);

            const result = await service.getById(admin, '123');
            expect(result).toBe(req);
        });
    });

    describe('list', () => {
        it('should apply requester filter for USER role', async () => {
            await service.list({ id: 'u1', role: HardwareRole.USER }, {});
            expect(repo.andWhere).toHaveBeenCalledWith('r.requesterId = :uid', { uid: 'u1' });
        });

        it('should apply scope my filter', async () => {
            await service.list({ id: 'a1', role: HardwareRole.ICT_STAFF }, { scope: 'my' });
            expect(repo.andWhere).toHaveBeenCalledWith('r.requesterId = :uid', { uid: 'a1' });
        });

        it('should filter by statuses', async () => {
            await service.list({ id: 'a1', role: HardwareRole.ICT_STAFF }, { status: [RequestStatus.DRAFT] });
            expect(repo.andWhere).toHaveBeenCalledWith('r.status IN (:...statuses)', { statuses: [RequestStatus.DRAFT] });
        });

        it('should apply multiple filters', async () => {
            await service.list(
                { id: 'a1', role: HardwareRole.ICT_STAFF },
                { siteId: 's1', requesterId: 'u2', search: 'macbook', page: 2, pageSize: 10 }
            );

            expect(repo.andWhere).toHaveBeenCalledWith('r.siteId = :siteId', { siteId: 's1' });
            expect(repo.andWhere).toHaveBeenCalledWith('r.requesterId = :reqId', { reqId: 'u2' });
            expect(repo.andWhere).toHaveBeenCalledWith('(r.requestNumber ILIKE :q OR r.justification ILIKE :q)', { q: '%macbook%' });
            expect(repo.skip).toHaveBeenCalledWith(10);
            expect(repo.take).toHaveBeenCalledWith(10);
        });

        it('should return empty array if offset exceeds total (handled by getManyAndCount naturally)', async () => {
            repo.getManyAndCount.mockResolvedValue([[], 50]);
            const result = await service.list({ id: 'a1', role: HardwareRole.ICT_STAFF }, { page: 100, pageSize: 10 });
            expect(result.rows).toEqual([]);
            expect(result.total).toBe(50);
        });
    });
});
