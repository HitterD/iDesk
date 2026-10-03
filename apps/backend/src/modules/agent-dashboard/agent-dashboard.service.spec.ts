import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/enums/user-role.enum';
import { ROLE_SCOPE, ServiceScope } from '../../shared/core/utils/service-scope.util';
import { AgentDashboardService, canViewAgentDashboard } from './agent-dashboard.service';

describe('canViewAgentDashboard', () => {
    const agent = { id: 'a-1', role: UserRole.AGENT_WEB_DEV };

    afterEach(() => {
        (ROLE_SCOPE as Record<string, ServiceScope>)[UserRole.AGENT_MOBILE_DEV] = ServiceScope.ICT;
    });

    it('lets an agent see only their own dashboard', () => {
        expect(canViewAgentDashboard({ userId: 'a-1', role: UserRole.AGENT_WEB_DEV }, agent)).toBe(true);
        expect(canViewAgentDashboard({ userId: 'a-2', role: UserRole.AGENT }, agent)).toBe(false);
    });

    it('lets ADMIN and a same-scope MANAGER see any agent', () => {
        expect(canViewAgentDashboard({ userId: 'x', role: UserRole.ADMIN }, agent)).toBe(true);
        expect(canViewAgentDashboard({ userId: 'm', role: UserRole.MANAGER }, agent)).toBe(true);
    });

    it('blocks a MANAGER from agents of another scope (future HC)', () => {
        (ROLE_SCOPE as Record<string, ServiceScope>)[UserRole.AGENT_MOBILE_DEV] = ServiceScope.HC;
        expect(canViewAgentDashboard({ userId: 'm', role: UserRole.MANAGER }, { id: 'h', role: UserRole.AGENT_MOBILE_DEV })).toBe(false);
    });

    it('has no dashboard for non-agents', () => {
        expect(canViewAgentDashboard({ userId: 'x', role: UserRole.ADMIN }, { id: 'u', role: UserRole.USER })).toBe(false);
        expect(canViewAgentDashboard({ userId: 'x', role: UserRole.ADMIN }, { id: 'm', role: UserRole.MANAGER })).toBe(false);
    });
});

describe('AgentDashboardService', () => {
    let service: AgentDashboardService;
    let userRepo: any;
    let ticketRepo: any;
    let workloadRepo: any;
    let qb: any;

    beforeEach(() => {
        qb = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
            getRawOne: jest.fn().mockResolvedValue({ average: '4.5', count: '2' }),
        };
        userRepo = { findOne: jest.fn() };
        ticketRepo = { createQueryBuilder: jest.fn(() => qb), find: jest.fn().mockResolvedValue([]) };
        workloadRepo = { find: jest.fn().mockResolvedValue([{ totalPoints: 5 }, { totalPoints: 3 }]) };
        service = new AgentDashboardService(
            ticketRepo,
            userRepo,
            workloadRepo,
            { createQueryBuilder: jest.fn(() => qb) } as any,
            { getOrSet: jest.fn((_key: string, factory: () => Promise<unknown>) => factory()) } as any,
        );
    });

    it('404s for an unknown agent and 403s for someone else\'s dashboard', async () => {
        userRepo.findOne.mockResolvedValue(null);
        await expect(service.getDashboard({ userId: 'a', role: UserRole.AGENT }, 'missing')).rejects.toBeInstanceOf(NotFoundException);

        userRepo.findOne.mockResolvedValue({ id: 'b', role: UserRole.AGENT });
        await expect(service.getDashboard({ userId: 'a', role: UserRole.AGENT }, 'b')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('gives support agents workload points and installs', async () => {
        userRepo.findOne.mockResolvedValue({ id: 'a', role: UserRole.AGENT_OPERATIONAL_SUPPORT, fullName: 'A', appraisalPoints: 12 });

        const dash = await service.getDashboard({ userId: 'a', role: UserRole.AGENT_OPERATIONAL_SUPPORT }, 'a', '7');

        expect(dash.kind).toBe('support');
        expect(dash.stats.periodDays).toBe(7);
        expect(dash.support?.workloadPointsToday).toBe(8);
        expect(dash.rating).toEqual({ average: 4.5, count: 2 });
        expect(dash.agent.scope).toBe(ServiceScope.ICT);
        expect(qb.where).toHaveBeenCalledWith('ticket.assignedToId = :agentId', { agentId: 'a' });
    });

    it('skips workload/installs for developer agents', async () => {
        userRepo.findOne.mockResolvedValue({ id: 'd', role: UserRole.AGENT_ORACLE, fullName: 'D' });

        const dash = await service.getDashboard({ userId: 'd', role: UserRole.AGENT_ORACLE }, 'd');

        expect(dash.kind).toBe('dev');
        expect(dash.support).toBeNull();
        expect(workloadRepo.find).not.toHaveBeenCalled();
        expect(dash.stats.periodDays).toBe(30);
    });
});
