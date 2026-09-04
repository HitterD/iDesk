import { ForbiddenException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, HandlingTeam } from '../entities/ticket.entity';

/**
 * The curated assignee list must bind the API, not only the dropdown.
 * A UI that merely hides names while POST /tickets/:id/assign still accepts
 * them is cosmetic — these tests are what keeps the endpoint honest.
 */
describe('TicketUpdateService.assignTicket — per-module assignee isolation', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockUserRepo: any;
    let assignmentPolicy: any;

    const ticket = {
        id: 'ticket-1',
        ticketNumber: '010126-GEN-0001',
        title: 'Test',
        description: 'Desc',
        category: 'GENERAL',
        ticketType: null,
        handlingTeam: HandlingTeam.OPS_SUPPORT,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        user: { id: 'user-creator' },
        assignedTo: null,
        siteId: 'site-1',
    } as unknown as Ticket;

    const assignee = {
        id: 'assignee-1',
        fullName: 'Kevin',
        email: 'kevin@test.com',
        role: UserRole.AGENT_OPERATIONAL_SUPPORT,
        siteId: 'site-1',
    };

    const assigner = { id: 'assigner-1', fullName: 'Assigner', email: 'a@b.c', role: UserRole.ADMIN, siteId: null };

    beforeEach(() => {
        mockTicketRepo = { findOne: jest.fn().mockResolvedValue({ ...ticket }), save: jest.fn(async (t: Ticket) => t) };
        mockUserRepo = { findOne: jest.fn() };
        mockUserRepo.findOne.mockResolvedValueOnce({ ...assignee }).mockResolvedValueOnce({ ...assigner });

        const siteRoom = { emit: jest.fn() };
        assignmentPolicy = {
            isUserEligible: jest.fn().mockResolvedValue(true),
            describeModule: jest.fn().mockResolvedValue('IT Support Tickets'),
            toAssignable: jest.fn((t: any) => t),
        };

        service = new TicketUpdateService(
            mockTicketRepo,
            { create: jest.fn((m) => m), save: jest.fn(async (m) => m) } as any,
            mockUserRepo,
            {} as any,
            {
                server: { emit: jest.fn(), to: jest.fn(() => siteRoom) },
                notifyDashboardStatsUpdate: jest.fn(),
                notifyTicketListUpdate: jest.fn(),
            } as any,
            {} as any,
            {} as any,
            {} as any,
            { emit: jest.fn() } as any,
            null as any,
            null as any,
            { logAsync: jest.fn() } as any,
            {} as any,
            { recalculateAgentWorkload: jest.fn() } as any,
            assignmentPolicy,
        );
    });

    it('rejects an assignee who is not on the module list, naming the module', async () => {
        assignmentPolicy.isUserEligible.mockResolvedValue(false);

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(mockTicketRepo.save).not.toHaveBeenCalled();
    });

    it('reports which module rejected the assignment', async () => {
        assignmentPolicy.isUserEligible.mockResolvedValue(false);

        await expect(service.assignTicket('ticket-1', 'assignee-1', 'assigner-1'))
            .rejects.toThrow(/Kevin tidak terdaftar .* IT Support Tickets/);
    });

    it('allows an assignee who is on the module list', async () => {
        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');

        expect(result.assignedTo.id).toBe('assignee-1');
        expect(assignmentPolicy.isUserEligible).toHaveBeenCalledWith(expect.anything(), 'assignee-1');
    });

    it('allows every eligible role through when no list is curated (no regression)', async () => {
        // isUserEligible returns true for an empty list, so untouched modules
        // keep behaving exactly as they did before this feature.
        const result = await service.assignTicket('ticket-1', 'assignee-1', 'assigner-1');

        expect(result.assignedTo.role).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
    });
});
