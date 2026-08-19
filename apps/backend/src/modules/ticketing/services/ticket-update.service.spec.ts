import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, TicketType } from '../entities/ticket.entity';

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
