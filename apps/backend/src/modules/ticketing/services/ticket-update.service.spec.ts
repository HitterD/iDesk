import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { createTestSlaClock } from './sla-clock.testing';
import { REASSIGN_CONFIRMATION_REQUIRED } from './status-takeover';
import { AuditAction } from '../../audit/entities/audit-log.entity';

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
            null as any, // businessHoursService
            mockAuditService,
            {} as any, // dataSource
            mockWorkloadService,
            {
                isUserEligible: jest.fn().mockResolvedValue(true),
                describeModule: jest.fn().mockResolvedValue('modul ini'),
                toAssignable: jest.fn((t: any) => t),
            } as any, createTestSlaClock(), { resolveVisit: () => new Date(Date.now() + 86_400_000), schedule: jest.fn(), clear: jest.fn(), note: () => '' } as any);
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
            null as any, // businessHoursService
            mockAuditService,
            mockDataSource,
            mockWorkloadService,
            {
                isUserEligible: jest.fn().mockResolvedValue(true),
                describeModule: jest.fn().mockResolvedValue('modul ini'),
                toAssignable: jest.fn((t: any) => t),
            } as any, createTestSlaClock(), { resolveVisit: () => new Date(Date.now() + 86_400_000), schedule: jest.fn(), clear: jest.fn(), note: () => '' } as any);
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

describe('TicketUpdateService — status takeover', () => {
    const picA = { id: 'agent-a', fullName: 'Agent A', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
    const agentB = { id: 'agent-b', fullName: 'Agent B', email: 'b@test.com', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
    let ticket: any;
    let manager: any;
    let mockTicketRepo: any;
    let mockQueryRunner: any;
    let mockAuditService: any;
    let mockWorkloadService: any;
    let mockEventEmitter: any;
    let mockPolicy: any;
    let service: TicketUpdateService;

    const makeTicket = (id = 'ticket-1') => ({
        id, ticketNumber: `TKT-${id}`, title: 'Printer', status: TicketStatus.TODO, priority: TicketPriority.MEDIUM,
        handlingTeam: HandlingTeam.OPS_SUPPORT, category: 'GENERAL', userId: 'owner-1', user: { id: 'owner-1' },
        participants: [], siteId: 'site-1', assignedToId: picA.id, assignedTo: picA,
    });

    beforeEach(() => {
        ticket = makeTicket();
        manager = {
            findOne: jest.fn((entity: unknown) => Promise.resolve(entity === Ticket ? ticket : agentB)),
            save: jest.fn(async (_e: unknown, t: any) => ({ ...t })),
            create: jest.fn((_e: unknown, data: any) => data),
        };
        mockTicketRepo = { find: jest.fn(async () => [ticket]) };
        mockQueryRunner = {
            connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(), release: jest.fn(), manager,
        };
        mockAuditService = { logAsync: jest.fn() };
        mockWorkloadService = { recalculateAgentWorkload: jest.fn() };
        mockEventEmitter = { emit: jest.fn() };
        mockPolicy = {
            toAssignable: jest.fn((t: any) => ({ handlingTeam: t.handlingTeam, ticketType: null, category: t.category })),
            isUserEligible: jest.fn().mockResolvedValue(true),
            describeModule: jest.fn().mockResolvedValue('Modul Printer'),
        };
        const siteRoom = { emit: jest.fn() };
        service = new TicketUpdateService(
            mockTicketRepo,
            { create: jest.fn((m) => m), save: jest.fn(async (m) => m) } as any,
            { findOne: jest.fn().mockResolvedValue(agentB) } as any,
            {} as any,
            { server: { to: jest.fn(() => siteRoom) }, notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn() } as any,
            { createSurvey: jest.fn() } as any,
            {} as any,
            { onTicketChange: jest.fn() } as any,
            mockEventEmitter,
            null as any,
            mockAuditService,
            { transaction: jest.fn((cb: any) => cb(manager)), createQueryRunner: jest.fn(() => mockQueryRunner) } as any,
            mockWorkloadService,
            mockPolicy, createTestSlaClock(), { resolveVisit: () => new Date(Date.now() + 86_400_000), schedule: jest.fn(), clear: jest.fn(), note: () => '' } as any);
    });

    const assignedEvents = () => mockEventEmitter.emit.mock.calls.filter((c: any[]) => c[0] === 'ticket.assigned');

    it('updateTicket takeover emits ticket.assigned marked as self-assigned (listener skips assignee-facing notices)', async () => {
        await service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id, { takeover: true, reason: 'PIC cuti' });

        expect(assignedEvents()).toHaveLength(1);
        expect(assignedEvents()[0][1]).toMatchObject({ assigneeId: agentB.id, assignerId: agentB.id });
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.ASSIGN_TICKET }));
    });

    it('updateTicket takeover by an actor outside the module curated list is rejected with 403', async () => {
        mockPolicy.isUserEligible.mockResolvedValue(false);

        const result = service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id, { takeover: true, reason: 'PIC cuti' });

        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
        await expect(result).rejects.toThrow('Agent B tidak terdaftar sebagai agent yang dapat ditugaskan di Modul Printer');
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('updateTicket unconfirmed start by an ineligible actor is rejected with 403 instead of asking to confirm', async () => {
        mockPolicy.isUserEligible.mockResolvedValue(false);

        await expect(service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updateTicket start of an unassigned ticket by an ineligible actor changes status but leaves it unassigned', async () => {
        ticket = { ...makeTicket(), assignedToId: null, assignedTo: null };
        mockPolicy.isUserEligible.mockResolvedValue(false);

        const saved = await service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id);

        expect(saved.status).toBe(TicketStatus.IN_PROGRESS);
        expect(saved.assignedToId).toBeNull();
        expect(mockAuditService.logAsync).not.toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.ASSIGN_TICKET }));
    });

    it('updateTicket start of an unassigned ticket by an eligible actor assigns the actor', async () => {
        ticket = { ...makeTicket(), assignedToId: null, assignedTo: null };

        const saved = await service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id);

        expect(saved.assignedToId).toBe(agentB.id);
        expect(assignedEvents()).toHaveLength(1);
        expect(assignedEvents()[0][1]).toMatchObject({ assigneeId: agentB.id, assignerId: agentB.id });
    });

    it('bulkUpdate leaves unassigned tickets of a module the actor is not listed in unassigned', async () => {
        const unassigned = { ...makeTicket('ticket-5'), assignedToId: null, assignedTo: null };
        mockTicketRepo.find.mockResolvedValue([unassigned]);
        mockPolicy.isUserEligible.mockResolvedValue(false);

        const result = await service.bulkUpdate(['ticket-5'], { status: TicketStatus.IN_PROGRESS }, agentB.id);

        expect(result).toEqual({ updated: 1, failed: [] });
        expect(unassigned.status).toBe(TicketStatus.IN_PROGRESS);
        expect(unassigned.assignedToId).toBeNull();
    });

    it('bulkUpdate takeover fails tickets of a module the actor is not listed in, without asking to confirm', async () => {
        mockPolicy.isUserEligible.mockResolvedValue(false);

        await expect(service.bulkUpdate(['ticket-1'], { status: TicketStatus.IN_PROGRESS }, agentB.id))
            .resolves.toEqual({ updated: 0, failed: ['ticket-1'] });
        await expect(service.bulkUpdate(['ticket-1'], { status: TicketStatus.IN_PROGRESS, takeover: true, reason: 'PIC cuti' }, agentB.id))
            .resolves.toEqual({ updated: 0, failed: ['ticket-1'] });
        expect(ticket.assignedToId).toBe(picA.id);
        expect(assignedEvents()).toHaveLength(0);
    });

    it('updateTicket IN_PROGRESS by non-PIC without takeover throws 409 and saves nothing', async () => {
        const result = service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id);

        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toMatchObject({
            response: { code: REASSIGN_CONFIRMATION_REQUIRED, currentAssignee: { id: picA.id, fullName: picA.fullName } },
        });
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('updateTicket with takeover saves assignedToId=actor and status IN_PROGRESS in the same transaction', async () => {
        const saved = await service.updateTicket(
            'ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id, { takeover: true, reason: 'PIC cuti' },
        );

        expect(manager.save).toHaveBeenCalledTimes(1);
        expect(manager.save.mock.calls[0][1]).toMatchObject({ status: TicketStatus.IN_PROGRESS, assignedToId: agentB.id });
        expect(saved.assignedToId).toBe(agentB.id);
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            action: AuditAction.ASSIGN_TICKET,
            newValue: expect.objectContaining({ reason: 'PIC cuti', via: 'status-takeover' }),
        }));
        const recalculated = mockWorkloadService.recalculateAgentWorkload.mock.calls.map((c: any[]) => c[1]);
        expect(recalculated).toEqual(expect.arrayContaining([picA.id, agentB.id]));
    });

    it('updateTicket takeover records the reassignment in the system message', async () => {
        const messageRepo = (service as any).messageRepo;
        await service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, agentB.id, { takeover: true, reason: 'PIC cuti' });

        const content = messageRepo.create.mock.calls[0][0].content;
        expect(content).toContain('Ticket reassigned to Agent B (was Agent A) (Alasan: PIC cuti) by Agent B');
        expect(content.match(/by Agent B/g)).toHaveLength(1);
    });

    it('bulkUpdate IN_PROGRESS rejects with 409 listing conflicting tickets', async () => {
        const mine = { ...makeTicket('ticket-2'), assignedToId: agentB.id, assignedTo: agentB };
        mockTicketRepo.find.mockResolvedValue([ticket, mine]);

        const result = service.bulkUpdate(['ticket-1', 'ticket-2'], { status: TicketStatus.IN_PROGRESS }, agentB.id);

        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toMatchObject({
            response: {
                code: REASSIGN_CONFIRMATION_REQUIRED,
                tickets: [{ id: 'ticket-1', ticketNumber: 'TKT-ticket-1', currentAssignee: { id: picA.id, fullName: picA.fullName } }],
            },
        });
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('bulkUpdate takeover fails tickets of a team the actor cannot handle instead of reassigning them', async () => {
        const webDev = { ...makeTicket('ticket-3'), handlingTeam: HandlingTeam.WEB_DEV };
        const unassignedWebDev = { ...makeTicket('ticket-4'), handlingTeam: HandlingTeam.WEB_DEV, assignedToId: null, assignedTo: null };
        mockTicketRepo.find.mockResolvedValue([ticket, webDev, unassignedWebDev]);

        const result = await service.bulkUpdate(
            ['ticket-1', 'ticket-3', 'ticket-4'], { status: TicketStatus.IN_PROGRESS, takeover: true, reason: 'PIC cuti' }, agentB.id,
        );

        expect(result).toEqual({ updated: 1, failed: ['ticket-3', 'ticket-4'] });
        expect(webDev.assignedToId).toBe(picA.id);
        expect(unassignedWebDev.assignedToId).toBeNull();
        expect(manager.save.mock.calls.map((c: any[]) => c[1].id)).toEqual(['ticket-1']);
    });

    it('bulkUpdate does not ask to confirm a takeover the actor could not perform', async () => {
        const webDev = { ...makeTicket('ticket-3'), handlingTeam: HandlingTeam.WEB_DEV };
        mockTicketRepo.find.mockResolvedValue([webDev]);

        const result = await service.bulkUpdate(['ticket-3'], { status: TicketStatus.IN_PROGRESS }, agentB.id);

        expect(result).toEqual({ updated: 0, failed: ['ticket-3'] });
    });

    it('bulkUpdate with takeover reassigns conflicting tickets to the actor', async () => {
        const result = await service.bulkUpdate(
            ['ticket-1'], { status: TicketStatus.IN_PROGRESS, takeover: true, reason: 'PIC cuti' }, agentB.id,
        );

        expect(result).toEqual({ updated: 1, failed: [] });
        expect(manager.save.mock.calls[0][1]).toMatchObject({ status: TicketStatus.IN_PROGRESS, assignedToId: agentB.id });
        expect(assignedEvents()).toHaveLength(1);
        expect(assignedEvents()[0][1]).toMatchObject({ ticketId: 'ticket-1', assigneeId: agentB.id, assignerId: agentB.id });
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            newValue: expect.objectContaining({ via: 'status-takeover' }),
        }));
    });
});
