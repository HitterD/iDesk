import { OVERDUE_SQL, TicketQueryService, toPrefixTsQuery } from './ticket-query.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { BadRequestException } from '@nestjs/common';

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

    it.each([
        ['RESOLVED,CLOSED', ['RESOLVED', 'CLOSED']],
        ['TODO', ['TODO']],
        [' TODO, IN_PROGRESS, ,WAITING_VENDOR ', ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR']],
    ])('filters status %s using IN', async (status, statuses) => {
        await service.findAllPaginated('user1', UserRole.ADMIN, null, { status });

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
            'ticket.status IN (:...statuses)', { statuses },
        );
    });

    it('rejects an invalid status value', async () => {
        await expect(service.findAllPaginated('user1', UserRole.ADMIN, null, {
            status: 'RESOLVED,FOO',
        })).rejects.toThrow(BadRequestException);
    });

    it('applies the exported overdue predicate when overdue is true', async () => {
        await service.findAllPaginated('user1', UserRole.ADMIN, null, { overdue: true });

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OVERDUE_SQL);
    });

    it.each([
        ['started TODO past its target', 'TODO', '2026-10-28T08:00:00Z', '2026-10-28T09:00:00Z', 1],
        ['started IN_PROGRESS past its target', 'IN_PROGRESS', '2026-10-28T08:00:00Z', '2026-10-28T09:00:00Z', 1],
        ['target still ahead', 'IN_PROGRESS', '2026-10-28T08:00:00Z', '2026-10-28T13:00:00Z', 0],
        // Legacy rows got a stored projected target before the clock started; that is not a deadline.
        ['clock never started, stale stored target', 'TODO', null, '2026-10-28T09:00:00Z', 0],
        ['waiting on a vendor', 'WAITING_VENDOR', '2026-10-28T08:00:00Z', '2026-10-28T09:00:00Z', 0],
        ['resolved', 'RESOLVED', '2026-10-28T08:00:00Z', '2026-10-28T09:00:00Z', 0],
        ['no target', 'TODO', '2026-10-28T08:00:00Z', null, 0],
    ])('OVERDUE_SQL: %s', (_label, status, slaStartedAt, slaTarget, expected) => {
        // Execute the production predicate itself; NOW() pinned to 12:00 for the fixture.
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(':memory:');
        try {
            db.exec('CREATE TABLE ticket(status TEXT, "slaStartedAt" TEXT, "slaTarget" TEXT)');
            db.prepare('INSERT INTO ticket VALUES (?, ?, ?)').run(status, slaStartedAt, slaTarget);
            const sql = OVERDUE_SQL.replace('NOW()', `'2026-10-28T12:00:00Z'`);
            expect(db.prepare(`SELECT COUNT(*) AS n FROM ticket WHERE ${sql}`).get().n).toBe(expected);
        } finally { db.close(); }
    });

    it('does not add status or overdue filters when absent or false', async () => {
        await service.findAllPaginated('user1', UserRole.ADMIN, null, { overdue: false });

        const predicates = mockQueryBuilder.andWhere.mock.calls.map(([sql]: [string]) => sql);
        expect(predicates.some((sql: string) => sql.includes('ticket.status'))).toBe(false);
        expect(predicates.some((sql: string) => sql.includes('slaTarget'))).toBe(false);
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

describe('TicketQueryService dashboard stats', () => {
    function createStatsQueryBuilder() {
        return {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            addGroupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            setParameters: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({}),
            getRawMany: jest.fn().mockResolvedValue([]),
            getMany: jest.fn().mockResolvedValue([]),
        };
    }

    it('returns critical from activeCritical select, not byPriority', async () => {
        const statusQb = createStatsQueryBuilder();
        statusQb.getRawOne.mockResolvedValue({ total: '8', activeCritical: '2' });
        const priorityQb = createStatsQueryBuilder();
        priorityQb.getRawMany.mockResolvedValue([{ priority: 'CRITICAL', count: '5' }]);
        const service = new TicketQueryService({} as any, {} as any, {} as any);
        jest.spyOn(service as any, 'createFilteredTicketQb')
            .mockImplementation(() => createStatsQueryBuilder())
            .mockReturnValueOnce(statusQb)
            .mockReturnValueOnce(priorityQb);

        const result = await (service as any).computeDashboardStats(UserRole.ADMIN, null);

        expect(result.critical).toBe(2);
        expect(result.byPriority.CRITICAL).toBe(5);
        expect(statusQb.addSelect).toHaveBeenCalledWith(
            `SUM(CASE WHEN ticket.priority = 'CRITICAL' AND ticket.status IN ('TODO', 'IN_PROGRESS', 'WAITING_VENDOR') THEN 1 ELSE 0 END)`,
            'activeCritical',
        );
        expect(statusQb.addSelect).toHaveBeenCalledWith(
            `SUM(CASE WHEN ${OVERDUE_SQL} THEN 1 ELSE 0 END)`, 'overdue',
        );
        expect(priorityQb.andWhere).not.toHaveBeenCalled();
    });
});

describe('TicketQueryService.findOne', () => {
    // A GET must not write: saving here cascaded the requester-filtered messages
    // (internal notes -> ticketId NULL -> 500) and stamped an SLA target on tickets
    // whose clock had not started.
    it('computes a missing SLA target for display without saving the ticket', async () => {
        const ticket = {
            id: 't-1', priority: 'HIGH', createdAt: new Date('2026-10-01T00:00:00Z'), totalPausedMinutes: 0,
            slaTarget: null, userId: 'req-1', siteId: 's-1', handlingTeam: 'OPS_SUPPORT',
            messages: [{ id: 'm1', isInternal: false }, { id: 'm2', isInternal: true }],
            participants: [], user: { id: 'req-1' },
        };
        const ticketRepo = { findOne: jest.fn().mockResolvedValue(ticket), save: jest.fn() };
        const slaConfigRepo = { findOne: jest.fn().mockResolvedValue({ resolutionTimeMinutes: 60 }) };
        const service = new TicketQueryService(ticketRepo as any, slaConfigRepo as any, {} as any);

        const result = await service.findOne('t-1', { id: 'req-1', role: UserRole.USER, siteId: 's-1' });

        expect(ticketRepo.save).not.toHaveBeenCalled();
        expect(result.slaTarget).toEqual(new Date('2026-10-01T01:00:00Z'));
        expect(result.messages.map((m: any) => m.id)).toEqual(['m1']);
    });
});

describe('toPrefixTsQuery', () => {
    // Raw input went straight into to_tsquery: "a(b" -> syntax error -> 500.
    it('strips tsquery syntax so user input can never break the query', () => {
        expect(toPrefixTsQuery('a(b')).toBe('ab:*');
        expect(toPrefixTsQuery("printer & lt:2 | 'x'")).toBe('printer:* & lt2:* & x:*');
        expect(toPrefixTsQuery('laptop rusak')).toBe('laptop:* & rusak:*');
    });

    it('returns a never-matching query when nothing searchable remains', () => {
        expect(toPrefixTsQuery('() & |')).toBe('!_');
    });
});

describe('TicketQueryService queue stats', () => {
    let service: any;
    let qb: any;

    beforeEach(() => {
        const terminals: Record<string, unknown> = { getRawOne: { total: '9', open: '2', waitingVendor: '1', critical: '3' } };
        qb = new Proxy({} as any, {
            get(target, prop: string) {
                if (prop in terminals) return jest.fn().mockResolvedValue(terminals[prop]);
                target[prop] ??= jest.fn(() => qb);
                return target[prop];
            },
        });
        service = new TicketQueryService({ createQueryBuilder: jest.fn(() => qb) } as any, {} as any, {} as any);
    });

    it('counts a developer queue with its team filter and parses every count', async () => {
        const stats = await service.getQueueStats('oracle', 'dev-1', UserRole.AGENT_ORACLE, null);

        expect(qb.where).toHaveBeenCalledWith(ORACLE_ONLY, ORACLE_FILTER_PARAMS);
        expect(stats).toEqual({ total: 9, open: 2, inProgress: 0, waitingVendor: 1, resolved: 0, overdue: 0, critical: 3 });
    });

    it('keeps the IT Support queue on OPS_SUPPORT and out of Request Center categories', async () => {
        await service.getQueueStats('it-support', 'agent-1', UserRole.AGENT, 'site-1');

        expect(qb.andWhere).toHaveBeenCalledWith(OPS_SUPPORT_ONLY, OPS_SUPPORT_PARAMS);
        expect(qb.andWhere).toHaveBeenCalledWith('ticket.category NOT IN (:...requestCenterCategories)', {
            requestCenterCategories: ['ICT_BUDGET', 'LOST_ITEM', 'ACCESS_REQUEST'],
        });
        expect(qb.andWhere).toHaveBeenCalledWith('ticket.siteId = :userSiteId', { userSiteId: 'site-1' });
    });

    it('scopes "Tugas Saya" counts to the caller', async () => {
        await service.getQueueStats('web-dev', 'dev-1', UserRole.AGENT_WEB_DEV, null, { assignedToMe: true });

        expect(qb.andWhere).toHaveBeenCalledWith('ticket.assignedToId = :assigneeId', { assigneeId: 'dev-1' });
    });

    it('filters developer queue lists by status list and overdue on the server', async () => {
        qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
        await service.findAllPaginatedMobileDev('dev-1', UserRole.AGENT_MOBILE_DEV, null, { status: 'RESOLVED,CLOSED', overdue: true });

        expect(qb.andWhere).toHaveBeenCalledWith('ticket.status IN (:...statuses)', { statuses: ['RESOLVED', 'CLOSED'] });
        expect(qb.andWhere).toHaveBeenCalledWith(OVERDUE_SQL);
    });
});
