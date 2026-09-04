import { BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';

/**
 * The reported bug: Oracle/Web/Mobile tickets were being auto-assigned into the
 * IT-support pool. The guard now lives here, in the one place all four
 * auto-assign paths go through, so these tests are what stops it coming back.
 */
describe('WorkloadService — per-module auto-assign policy', () => {
    let service: WorkloadService;
    let ticketRepo: any;
    let userRepo: any;
    let workloadRepo: any;
    let assignmentPolicy: any;

    const ticket = { id: 't1', siteId: 'site-1', priority: 'MEDIUM', handlingTeam: 'ORACLE_DEV' };

    const policy = (over: Partial<any> = {}) => ({
        module: { name: 'Oracle K2 Request' },
        autoAssignEnabled: false,
        userIds: [],
        roles: [],
        ...over,
    });

    beforeEach(() => {
        ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ ...ticket }),
            save: jest.fn(async (t: any) => t),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };
        userRepo = { find: jest.fn().mockResolvedValue([]) };
        workloadRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'w1', totalPoints: 2 }),
            create: jest.fn((d: any) => d),
            save: jest.fn(async (rows: any) => (Array.isArray(rows) ? rows.map((r, i) => ({ ...r, id: `w${i}` })) : { ...rows, id: 'w1' })),
            increment: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                insert: jest.fn().mockReturnThis(),
                into: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                orIgnore: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            })),
        };
        assignmentPolicy = {
            resolvePolicy: jest.fn().mockResolvedValue(policy()),
            toAssignable: jest.fn((t: any) => t),
        };

        service = new WorkloadService(
            { logAsync: jest.fn() } as any,
            { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) } as any,
            workloadRepo,
            ticketRepo,
            userRepo,
            { emit: jest.fn() } as any,
            assignmentPolicy,
        );
    });

    it('refuses to auto-assign a ticket whose module has auto-assign disabled', async () => {
        await expect(service.autoAssignTicket('t1')).rejects.toThrow(BadRequestException);
        await expect(service.autoAssignTicket('t1')).rejects.toThrow(/Oracle K2 Request/);

        // The pool must never even be queried for a disabled module.
        expect(userRepo.find).not.toHaveBeenCalled();
        expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('leaves the ticket unassigned instead of falling back when the curated list is empty of available agents', async () => {
        assignmentPolicy.resolvePolicy.mockResolvedValue(
            policy({ autoAssignEnabled: true, userIds: ['u-1', 'u-2'], module: { name: 'IT Support Tickets' } }),
        );
        userRepo.find.mockResolvedValue([]); // both curated agents inactive/gone

        await expect(service.autoAssignTicket('t1')).rejects.toThrow('No available agents for this ticket module');

        expect(ticketRepo.save).not.toHaveBeenCalled();
        // Crucially: it queried the curated ids, not the role pool.
        expect(userRepo.find).toHaveBeenCalledWith({ where: { id: In(['u-1', 'u-2']), isActive: true } });
        expect(userRepo.find).toHaveBeenCalledTimes(1);
    });

    it('draws the candidate pool from the curated list, cross-site, when one exists', async () => {
        assignmentPolicy.resolvePolicy.mockResolvedValue(
            policy({ autoAssignEnabled: true, userIds: ['u-1'], module: { name: 'IT Support Tickets' } }),
        );
        userRepo.find.mockResolvedValue([
            { id: 'u-1', fullName: 'Kevin', role: UserRole.AGENT, siteId: 'site-9', isActive: true },
        ]);

        const result = await service.autoAssignTicket('t1');

        expect(result.assignedToId).toBe('u-1');
        const where = userRepo.find.mock.calls[0][0].where;
        expect(where).not.toHaveProperty('siteId');
        expect(where).not.toHaveProperty('role');
    });

    it('falls back to the module roles, site-scoped, when no curated list exists', async () => {
        assignmentPolicy.resolvePolicy.mockResolvedValue(
            policy({ autoAssignEnabled: true, userIds: [], roles: [UserRole.AGENT_OPERATIONAL_SUPPORT], module: { name: 'IT Support Tickets' } }),
        );
        userRepo.find.mockResolvedValue([
            { id: 'u-7', fullName: 'Ops', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', isActive: true },
        ]);

        const result = await service.autoAssignTicket('t1');

        expect(result.assignedToId).toBe('u-7');
        expect(userRepo.find).toHaveBeenCalledWith({
            where: { role: In([UserRole.AGENT_OPERATIONAL_SUPPORT]), siteId: 'site-1', isActive: true },
        });
    });
});
