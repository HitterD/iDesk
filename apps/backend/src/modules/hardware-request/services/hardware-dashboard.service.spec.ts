import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareDashboardService } from './hardware-dashboard.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';

describe('HardwareDashboardService', () => {
    let svc: HardwareDashboardService;

    const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getCount: jest.fn(),
        getMany: jest.fn(),
    };

    const reqRepo = {
        createQueryBuilder: jest.fn(() => qb),
        count: jest.fn(),
    };
    const schedRepo = {
        createQueryBuilder: jest.fn(() => qb),
        find: jest.fn(),
    };
    const itemRepo = {
        createQueryBuilder: jest.fn(() => qb),
    };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                HardwareDashboardService,
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: getRepositoryToken(InstallationSchedule), useValue: schedRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: itemRepo },
            ],
        }).compile();
        svc = mod.get(HardwareDashboardService);
        jest.clearAllMocks();
        // Reset qb mocks (since clearAllMocks resets implementations)
        qb.select.mockReturnThis();
        qb.addSelect.mockReturnThis();
        qb.where.mockReturnThis();
        qb.andWhere.mockReturnThis();
        qb.groupBy.mockReturnThis();
        qb.addGroupBy.mockReturnThis();
        qb.orderBy.mockReturnThis();
        qb.limit.mockReturnThis();
        qb.innerJoin.mockReturnThis();
        qb.leftJoinAndSelect.mockReturnThis();
        reqRepo.createQueryBuilder.mockReturnValue(qb);
        schedRepo.createQueryBuilder.mockReturnValue(qb);
        itemRepo.createQueryBuilder.mockReturnValue(qb);
    });

    it('kpi returns active/procurement/pending-install/completed-this-month', async () => {
        reqRepo.count
            .mockResolvedValueOnce(12) // active
            .mockResolvedValueOnce(3)  // in procurement
            .mockResolvedValueOnce(5); // pending install
        qb.getCount.mockResolvedValue(8); // completed this month

        const r = await svc.kpi();
        expect(r).toEqual({
            totalActive: 12,
            inProcurement: 3,
            pendingInstall: 5,
            completedThisMonth: 8,
        });
    });

    it('statusDistribution returns mapped array', async () => {
        qb.getRawMany.mockResolvedValue([
            { status: 'SUBMITTED', count: '4' },
            { status: 'APPROVED', count: '2' },
        ]);
        const r = await svc.statusDistribution();
        expect(r).toEqual([
            { status: 'SUBMITTED', count: 4 },
            { status: 'APPROVED', count: 2 },
        ]);
    });

    it('aging filters by thresholdDays and casts days to number', async () => {
        qb.getRawMany.mockResolvedValue([
            { id: 'r1', requestNumber: 'HR-2026-0001', status: 'UNDER_REVIEW', days: '5' },
        ]);
        const r = await svc.aging(3);
        expect(r[0].days).toBe(5);
        expect(typeof r[0].days).toBe('number');
    });
});
