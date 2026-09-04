import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import { ForbiddenException } from '@nestjs/common';

describe('WorkloadService — atomic workload increment (PROD-20 lost-update)', () => {
    let service: WorkloadService;
    let workloadRepo: any;
    let priorityWeightRepo: any;
    let ticketRepo: any;
    let userRepo: any;

    const adminActor: SiteActor = { role: UserRole.ADMIN, siteId: null };
    const siteLockedActor: SiteActor = { role: UserRole.AGENT, siteId: 'site-spj' };

    // A single reusable insert query-builder chain that records `orIgnore`.
    let insertExecute: jest.Mock;
    let orIgnoreSpy: jest.Mock;
    const makeInsertQb = () => {
        const qb: any = {};
        qb.insert = jest.fn(() => qb);
        qb.into = jest.fn(() => qb);
        qb.values = jest.fn(() => qb);
        orIgnoreSpy = jest.fn(() => qb);
        qb.orIgnore = orIgnoreSpy;
        insertExecute = jest.fn().mockResolvedValue({});
        qb.execute = insertExecute;
        return qb;
    };

    beforeEach(() => {
        priorityWeightRepo = { find: jest.fn().mockResolvedValue([]) };
        workloadRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            createQueryBuilder: jest.fn(() => makeInsertQb()),
            increment: jest.fn().mockResolvedValue({ affected: 1 }),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
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
            {
                resolvePolicy: jest.fn().mockResolvedValue({ module: null, autoAssignEnabled: true, userIds: [], roles: [] }),
                toAssignable: jest.fn((t: any) => t),
            } as any,
        );
    });

    it('raises totalPoints atomically instead of read-modify-write', async () => {
        workloadRepo.findOne.mockResolvedValue({
            id: 'w1', agentId: 'a1', siteId: 'site-1', totalPoints: 8, activeTickets: 2, resolvedTickets: 0,
        });

        await service.incrementAgentWorkload(adminActor, 'a1', 'site-1', 4);

        expect(workloadRepo.increment).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: 'a1', siteId: 'site-1' }),
            'totalPoints', 4,
        );
        expect(workloadRepo.increment).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: 'a1', siteId: 'site-1' }),
            'activeTickets', 1,
        );
    });

    it('never uses create-then-save; it races safely via orIgnore', async () => {
        // A concurrent transaction may own the row; the post-insert re-read
        // returns it. Must not fall back to a save that clobbers increments.
        const fresh = {
            id: 'w1', agentId: 'a1', siteId: 'site-1', totalPoints: 10, activeTickets: 3, resolvedTickets: 0,
        };
        workloadRepo.findOne.mockResolvedValue(fresh);

        const result = await service.incrementAgentWorkload(adminActor, 'a1', 'site-1', 2);

        expect(workloadRepo.createQueryBuilder).toHaveBeenCalled();
        expect(orIgnoreSpy).toHaveBeenCalled();
        expect(insertExecute).toHaveBeenCalled();
        // The increment path must not keep a read-modify-write save on the raw repo.
        expect(workloadRepo.save).toBeUndefined();
        expect(result).toBe(fresh);
    });

    it('returns the freshly-read workload so callers see the combined totals', async () => {
        const fresh = {
            id: 'w1', agentId: 'a1', siteId: 'site-1', totalPoints: 10, activeTickets: 3, resolvedTickets: 0,
        };
        workloadRepo.findOne.mockResolvedValue(fresh);

        const result = await service.incrementAgentWorkload(adminActor, 'a1', 'site-1', 4);

        expect(result).toBe(fresh);
    });

    it('denies a site-locked actor reading another site (fail-closed)', async () => {
        await expect(
            service.incrementAgentWorkload(siteLockedActor, 'a1', 'site-smg', 4),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies a site-locked actor with no site (fail-closed)', async () => {
        await expect(
            service.incrementAgentWorkload({ role: UserRole.AGENT, siteId: null }, 'a1', 'site-1', 4),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
