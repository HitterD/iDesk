import { ModuleAssignmentPolicyService } from './module-assignment-policy.service';
import { HandlingTeam, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

/**
 * Locks the four behaviours that would otherwise break silently:
 *  1. auto-assign is off for the dev queues (the reported bug),
 *  2. an explicit assignee list wins over assigneeRoles,
 *  3. an empty list falls back to assigneeRoles,
 *  4. eligibility binds the API, not just the dropdown.
 */
describe('ModuleAssignmentPolicyService', () => {
    let moduleRepo: any;
    let service: ModuleAssignmentPolicyService;
    let found: any;

    const makeQb = () => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => found),
        getMany: jest.fn(async () => (found ? [found] : [])),
    });

    beforeEach(() => {
        found = null;
        moduleRepo = { createQueryBuilder: jest.fn(() => makeQb()) };
        service = new ModuleAssignmentPolicyService(moduleRepo);
    });

    const moduleRow = (over: Partial<any> = {}) => ({
        id: 'm1',
        name: 'Oracle K2 Request',
        slug: 'oracle-k2',
        handlingTeams: [HandlingTeam.ORACLE_DEV],
        assigneeRoles: [UserRole.AGENT_ORACLE],
        assigneeUserIds: [],
        autoAssignEnabled: false,
        ...over,
    });

    it('blocks auto-assign for a module with autoAssignEnabled=false', async () => {
        found = moduleRow();

        const allowed = await service.isAutoAssignAllowed({
            handlingTeam: HandlingTeam.ORACLE_DEV,
            ticketType: TicketType.ORACLE_REQUEST,
            category: 'ORACLE_REQUEST',
        });

        expect(allowed).toBe(false);
    });

    it('allows auto-assign for a module with autoAssignEnabled=true', async () => {
        found = moduleRow({
            name: 'IT Support Tickets',
            slug: 'it-support',
            handlingTeams: [HandlingTeam.OPS_SUPPORT],
            autoAssignEnabled: true,
        });

        const allowed = await service.isAutoAssignAllowed({ handlingTeam: HandlingTeam.OPS_SUPPORT });

        expect(allowed).toBe(true);
    });

    it('falls back to OPS_SUPPORT-only auto-assign when no module matches', async () => {
        found = null;

        await expect(service.isAutoAssignAllowed({ handlingTeam: HandlingTeam.OPS_SUPPORT })).resolves.toBe(true);
        await expect(service.isAutoAssignAllowed({ handlingTeam: HandlingTeam.WEB_DEV })).resolves.toBe(false);
    });

    it('lets an explicit assignee list win over assigneeRoles', async () => {
        found = moduleRow({ assigneeUserIds: ['u-1', 'u-2'], autoAssignEnabled: true });

        const policy = await service.resolvePolicy({ handlingTeam: HandlingTeam.ORACLE_DEV });

        expect(policy.userIds).toEqual(['u-1', 'u-2']);
    });

    it('falls back to assigneeRoles when the explicit list is empty', async () => {
        found = moduleRow({ assigneeUserIds: [], assigneeRoles: [UserRole.AGENT_WEB_DEV] });

        const policy = await service.resolvePolicy({ handlingTeam: HandlingTeam.WEB_DEV });

        expect(policy.userIds).toEqual([]);
        expect(policy.roles).toEqual([UserRole.AGENT_WEB_DEV]);
    });

    it('rejects a user who is not on a curated list', async () => {
        found = moduleRow({ assigneeUserIds: ['u-1'] });

        await expect(service.isUserEligible({ handlingTeam: HandlingTeam.ORACLE_DEV }, 'u-9')).resolves.toBe(false);
        await expect(service.isUserEligible({ handlingTeam: HandlingTeam.ORACLE_DEV }, 'u-1')).resolves.toBe(true);
    });

    it('treats everyone as eligible while the list is empty', async () => {
        found = moduleRow({ assigneeUserIds: [] });

        await expect(service.isUserEligible({ handlingTeam: HandlingTeam.ORACLE_DEV }, 'anyone')).resolves.toBe(true);
    });
});
