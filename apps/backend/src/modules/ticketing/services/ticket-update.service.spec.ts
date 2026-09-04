import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, TicketType, HandlingTeam } from '../entities/ticket.entity';

describe('TicketUpdateService.assignTicket — Oracle/K2 enforcement', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockMessageRepo: any;
    let mockUserRepo: any;
    let mockEventsGateway: any;
    let mockAuditService: any;
    let mockEventEmitter: any;
    let mockWorkloadService: any;

    const buildTicket = (category: string, ticketType: string | null = null): Ticket => ({
        id: 'ticket-1',
        ticketNumber: '010126-GEN-0001',
        title: 'Test',
        description: 'Desc',
        category,
        ticketType: ticketType as any,
        // handlingTeam is the source of truth for team access: an Oracle
        // category/ticketType implies the ticket currently belongs to
        // ORACLE_DEV unless the test explicitly forwards it.
        handlingTeam: (category === 'ORACLE_REQUEST' || ticketType === TicketType.ORACLE_REQUEST)
            ? HandlingTeam.ORACLE_DEV
            : HandlingTeam.OPS_SUPPORT,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        user: { id: 'user-creator' } as any,
        assignedTo: null,
        siteId: 'site-1',
    } as Ticket);

    const buildAssignee = (role: UserRole, siteId: string | null = 'site-1') => ({
        id: 'assignee-1',
        fullName: 'Test Assignee',
        email: 'assignee@test.com',
        role,
        siteId,
    } as any);

    beforeEach(() => {
        mockTicketRepo = {
            findOne: jest.fn(),
            save: jest.fn(async (t: Ticket) => t),
        };
        mockMessageRepo = {
            create: jest.fn((m) => m),
            save: jest.fn(async (m) => m),
        };
        mockUserRepo = {
            findOne: jest.fn(),
        };
        const chainEmit = jest.fn();
        const siteRoom = { emit: chainEmit };
        mockEventsGateway = {
            server: { emit: jest.fn(), to: jest.fn(() => siteRoom) },
            notifyDashboardStatsUpdate: jest.fn(),
            notifyTicketListUpdate: jest.fn(),
        };
        mockAuditService = { logAsync: jest.fn() };
        mockEventEmitter = { emit: jest.fn() };
        mockWorkloadService = { recalculateAgentWorkload: jest.fn() };

        service = new TicketUpdateService(
            mockTicketRepo,
            mockMessageRepo,
            mockUserRepo,
            {} as any, // slaConfigRepo
            mockEventsGateway,
            {} as any, // surveysService
            {} as any, // cacheService
            {} as any, // cacheInvalidationService
            mockEventEmitter,
            null as any, // telegramService
            null as any, // businessHoursService
            mockAuditService,
            {} as any, // dataSource
            mockWorkloadService,
            {
                isUserEligible: jest.fn().mockResolvedValue(true),
                describeModule: jest.fn().mockResolvedValue('modul ini'),
                toAssignable: jest.fn((t: any) => t),
            } as any,
        );
    });

    it('throws ForbiddenException when non-AGENT_ORACLE is assigned to an Oracle/K2 category ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_OPERATIONAL_SUPPORT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null });

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when non-AGENT_ORACLE is assigned to an Oracle/K2 ticketType ticket', async () => {
        const ticket = buildTicket('GENERAL', TicketType.ORACLE_REQUEST);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null });

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows AGENT_ORACLE to be assigned to an Oracle/K2 ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_ORACLE));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.AGENT_ORACLE, siteId: 'site-1' });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo).toEqual(buildAssignee(UserRole.AGENT_ORACLE));
    });

    it('allows ADMIN to be assigned to an Oracle/K2 ticket', async () => {
        const ticket = buildTicket('ORACLE_REQUEST', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.ADMIN));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo.role).toBe(UserRole.ADMIN);
    });

    it('allows AGENT to be assigned to a non-Oracle ticket (no regression)', async () => {
        const ticket = buildTicket('GENERAL', null);
        mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
        mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT));
        mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.AGENT_ADMIN, siteId: 'site-1' });

        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
        expect(result.assignedTo.role).toBe(UserRole.AGENT);
    });

    describe('Site isolation', () => {
        it('blocks a site-locked assigner from assigning a foreign-site ticket', async () => {
            const ticket = buildTicket('GENERAL', null);
            // ticket site-1, assigner site-2 (site-locked role)
            mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
            mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_ADMIN, 'site-2'));
            mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.AGENT_ADMIN, siteId: 'site-2' });
            await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1')).rejects.toBeInstanceOf(ForbiddenException);
        });
        it('blocks assigning a foreign-site assignee to the ticket', async () => {
            const ticket = buildTicket('GENERAL', null);
            mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
            mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.AGENT_ADMIN, 'site-2'));
            mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null });
            await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1')).rejects.toBeInstanceOf(ForbiddenException);
        });
        it('allows cross-site ADMIN to assign across sites', async () => {
            const ticket = buildTicket('GENERAL', null);
            mockTicketRepo.findOne.mockResolvedValueOnce(ticket);
            mockUserRepo.findOne.mockResolvedValueOnce(buildAssignee(UserRole.ADMIN, null));
            mockUserRepo.findOne.mockResolvedValueOnce({ id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null });
            const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');
            expect(result.assignedTo.id).toBe('assignee-1');
        });
    });
});

describe('TicketUpdateService.bulkAssign', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockMessageRepo: any;
    let mockUserRepo: any;
    let mockEventsGateway: any;
    let mockAuditService: any;
    let mockEventEmitter: any;
    let mockWorkloadService: any;
    let mockDataSource: any;
    let mockQueryRunner: any;

    const buildTicket = (id: string, handlingTeam: HandlingTeam = HandlingTeam.OPS_SUPPORT): Ticket => ({
        id,
        ticketNumber: `T-${id}`,
        title: 'Test',
        description: 'Desc',
        category: 'GENERAL',
        ticketType: null as any,
        handlingTeam,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        user: { id: 'user-creator' } as any,
        assignedTo: null,
        siteId: 'site-1',
    } as Ticket);

    const buildUser = (id: string, role: UserRole, siteId: string | null = 'site-1') => ({
        id,
        fullName: `User ${id}`,
        email: `${id}@test.com`,
        role,
        siteId,
    } as any);

    beforeEach(() => {
        mockTicketRepo = {
            findOne: jest.fn(),
            save: jest.fn(async (t: Ticket) => t),
        };
        mockMessageRepo = {
            create: jest.fn((m) => m),
            save: jest.fn(async (m) => m),
        };
        mockUserRepo = {
            findOne: jest.fn(),
        };
        const chainEmit = jest.fn();
        const siteRoom = { emit: chainEmit };
        mockEventsGateway = {
            server: { emit: jest.fn(), to: jest.fn(() => siteRoom) },
            notifyDashboardStatsUpdate: jest.fn(),
            notifyTicketListUpdate: jest.fn(),
        };
        mockAuditService = { logAsync: jest.fn() };
        mockEventEmitter = { emit: jest.fn() };
        mockWorkloadService = { recalculateAgentWorkload: jest.fn() };

        mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                save: jest.fn(async (entity: any) => entity),
                create: jest.fn((ctor: any, data: any) => data),
            },
        };
        mockDataSource = {
            createQueryRunner: jest.fn(() => mockQueryRunner),
            transaction: jest.fn(async (fn: any) => fn({})),
        };

        service = new TicketUpdateService(
            mockTicketRepo,
            mockMessageRepo,
            mockUserRepo,
            {} as any, // slaConfigRepo
            mockEventsGateway,
            {} as any, // surveysService
            {} as any, // cacheService
            {} as any, // cacheInvalidationService
            mockEventEmitter,
            null as any, // telegramService
            null as any, // businessHoursService
            mockAuditService,
            mockDataSource,
            mockWorkloadService,
            {
                isUserEligible: jest.fn().mockResolvedValue(true),
                describeModule: jest.fn().mockResolvedValue('modul ini'),
                toAssignable: jest.fn((t: any) => t),
            } as any,
        );
    });

    it('assigns multiple tickets successfully and returns counts', async () => {
        const t1 = buildTicket('t1');
        const t2 = buildTicket('t2');
        const assignee = buildUser('assignee-1', UserRole.AGENT);
        const assigner = buildUser('assigner-1', UserRole.ADMIN, null);

        // bulkAssign first looks up the actor (userId), then the assignee.
        // Then for each ticket, assignTicket looks up: ticket, assignee, assigner.
        mockTicketRepo.findOne
            .mockResolvedValueOnce(t1)
            .mockResolvedValueOnce(t2);
        mockUserRepo.findOne
            .mockResolvedValueOnce(assigner) // bulkAssign: actor (userId)
            .mockResolvedValueOnce(assignee) // bulkAssign: assignee
            // ticket 1 inside assignTicket
            .mockResolvedValueOnce(assignee)
            .mockResolvedValueOnce(assigner)
            // ticket 2 inside assignTicket
            .mockResolvedValueOnce(assignee)
            .mockResolvedValueOnce(assigner);

        const result = await service.bulkAssign(['t1', 't2'], 'assignee-1', 'assigner-1', 'bulk reason');

        expect(result.updated).toBe(2);
        expect(result.failed).toEqual([]);
    });

    it('continues on per-ticket failure and reports failed ids', async () => {
        const okTicket = buildTicket('ok', HandlingTeam.OPS_SUPPORT);
        const oracleTicket = buildTicket('oracle', HandlingTeam.ORACLE_DEV);
        const nonOracleAssignee = buildUser('assignee-ops', UserRole.AGENT_OPERATIONAL_SUPPORT);
        const oracleAssignee = buildUser('assignee-oracle', UserRole.AGENT_ORACLE);
        const assigner = buildUser('assigner-admin', UserRole.ADMIN, null);

        // First ticket: ok (ops ticket + ops assignee)
        // Second ticket: oracle ticket + non-oracle assignee → Forbidden inside assignTicket
        mockTicketRepo.findOne
            .mockResolvedValueOnce(okTicket)
            .mockResolvedValueOnce(oracleTicket);

        mockUserRepo.findOne
            // ticket 'ok'
            .mockResolvedValueOnce(nonOracleAssignee).mockResolvedValueOnce(assigner)
            // ticket 'oracle' (will fail inside assignTicket because assignee is not oracle)
            .mockResolvedValueOnce(nonOracleAssignee).mockResolvedValueOnce(assigner);

        const result = await service.bulkAssign(['ok', 'oracle'], 'assignee-ops', 'assigner-admin');

        expect(result.updated).toBe(1);
        expect(result.failed).toEqual(['oracle']);
    });

    it('rejects invalid assignee role before processing any ticket', async () => {
        // bulkAssign first validates the assignee role before touching tickets.
        mockUserRepo.findOne
            .mockResolvedValueOnce(buildUser('assigner-1', UserRole.ADMIN, null)) // actor
            .mockResolvedValueOnce(buildUser('bad', UserRole.USER)); // assignee with invalid role

        await expect(service.bulkAssign(['t1'], 'bad', 'assigner-1'))
            .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when assignee not found', async () => {
        mockUserRepo.findOne.mockResolvedValueOnce(null); // assignee lookup

        await expect(service.bulkAssign(['t1'], 'missing-assignee', 'assigner-1'))
            .rejects.toBeInstanceOf(NotFoundException);
    });
});
