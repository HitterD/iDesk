// apps/backend/src/modules/hardware-request/services/hardware-request-query.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestQueryService } from './hardware-request-query.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRole } from '../domain/enums/hardware-role.enum';

describe('HardwareRequestQueryService', () => {
    let service: HardwareRequestQueryService;
    let qb: any;
    let repo: any;

    beforeEach(async () => {
        qb = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'r1' }], 1]),
        };
        repo = {
            createQueryBuilder: jest.fn().mockReturnValue(qb),
            findOne: jest.fn(),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareRequestQueryService,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
            ],
        }).compile();
        service = moduleRef.get(HardwareRequestQueryService);
    });

    it('list enforces USER scope to own requests', async () => {
        await service.list(
            { id: 'user-1', role: HardwareRole.USER },
            { page: 1, pageSize: 20 },
        );
        expect(qb.andWhere).toHaveBeenCalledWith('r.requesterId = :uid', { uid: 'user-1' });
    });

    it('list allows ICT_LEAD to see all without uid filter', async () => {
        await service.list(
            { id: 'lead-1', role: HardwareRole.ICT_STAFF },
            { page: 1, pageSize: 20 },
        );
        const calls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
        expect(calls.some((s: string) => s.includes('requesterId = :uid'))).toBe(false);
    });

    it('list filters by status when provided', async () => {
        await service.list(
            { id: 'lead-1', role: HardwareRole.ICT_STAFF },
            { status: [RequestStatus.SUBMITTED], page: 1, pageSize: 20 },
        );
        expect(qb.andWhere).toHaveBeenCalledWith('r.status IN (:...statuses)', { statuses: [RequestStatus.SUBMITTED] });
    });

    it('getById allows USER only for own request', async () => {
        repo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'user-1' });
        const res = await service.getById({ id: 'user-1', role: HardwareRole.USER }, 'r1');
        expect(res.id).toBe('r1');
    });

    it('getById denies USER for others request', async () => {
        repo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'other' });
        await expect(
            service.getById({ id: 'user-1', role: HardwareRole.USER }, 'r1'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('getById throws not-found when missing', async () => {
        repo.findOne.mockResolvedValue(null);
        await expect(
            service.getById({ id: 'x', role: HardwareRole.ICT_STAFF }, 'missing'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_NOT_FOUND' }) });
    });
});
