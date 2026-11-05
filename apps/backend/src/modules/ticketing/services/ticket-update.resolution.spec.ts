import { TicketCancelReasonCode } from '../ticket-cancel.constants';
import { BadRequestException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketStatus, TicketPriority, HandlingTeam } from '../entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { createTestSlaClock } from './sla-clock.testing';

/** RESOLVED opens the requester's confirmation window; CLOSED is locked for everyone. */
describe('TicketUpdateService — resolution confirmation', () => {
    const DEADLINE = new Date('2026-09-30T10:00:00Z');
    const admin = { id: 'admin-1', fullName: 'Admin', role: UserRole.ADMIN, siteId: null };
    let ticket: Partial<Ticket>;
    let businessHours: { calculateSlaTarget: jest.Mock };
    let mockTicketRepo: any;
    let service: TicketUpdateService;

    const makeTicket = (status: TicketStatus): Partial<Ticket> => ({
        id: 'ticket-1', ticketNumber: 'TKT-1', status, priority: TicketPriority.MEDIUM,
        handlingTeam: HandlingTeam.OPS_SUPPORT, category: 'GENERAL', userId: 'owner-1', user: { id: 'owner-1' } as User,
        participants: [], siteId: 'site-1', resolutionDeadlineAt: null, disputedAt: null,
    });

    beforeEach(() => {
        ticket = makeTicket(TicketStatus.IN_PROGRESS);
        businessHours = { calculateSlaTarget: jest.fn().mockResolvedValue(DEADLINE) };
        const manager = {
            findOne: jest.fn((entity: unknown) => Promise.resolve(entity === Ticket ? ticket : admin)),
            save: jest.fn(async (_e: unknown, t: Ticket) => t),
        };
        mockTicketRepo = {
            findOne: jest.fn(() => Promise.resolve(ticket)),
            find: jest.fn(() => Promise.resolve([ticket])),
            save: jest.fn(async (t: Ticket) => t),
        };
        const siteRoom = { emit: jest.fn() };
        service = new TicketUpdateService(
            mockTicketRepo,
            { create: jest.fn((m) => m), save: jest.fn(async (m) => m) } as any,
            { findOne: jest.fn().mockResolvedValue(admin) } as any,
            {} as any,
            { server: { to: jest.fn(() => siteRoom) }, notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyStatusChange: jest.fn() } as any,
            { createSurvey: jest.fn() } as any,
            {} as any,
            { onTicketChange: jest.fn() } as any,
            { emit: jest.fn() } as any,
            businessHours as any,
            { logAsync: jest.fn() } as any,
            {
                transaction: jest.fn((cb: any) => cb(manager)),
                query: jest.fn(),
                createQueryRunner: jest.fn(() => ({
                    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
                    rollbackTransaction: jest.fn(), release: jest.fn(), manager,
                })),
            } as any,
            { recalculateAgentWorkload: jest.fn() } as any,
            { toAssignable: jest.fn((t: any) => t), isUserEligible: jest.fn().mockResolvedValue(true) } as any, createTestSlaClock(), { resolveVisit: () => new Date(Date.now() + 86_400_000), schedule: jest.fn(), clear: jest.fn(), note: () => '' } as any);
    });

    it('sets a one-working-day confirmation deadline when an agent resolves', async () => {
        ticket.disputedAt = new Date('2026-09-28T00:00:00Z');

        const saved = await service.updateTicket('ticket-1', { status: TicketStatus.RESOLVED }, admin.id);

        expect(businessHours.calculateSlaTarget).toHaveBeenCalledWith(expect.any(Date), 540);
        expect(saved.resolutionDeadlineAt).toEqual(DEADLINE);
        expect(saved.resolvedAt).toBeInstanceOf(Date);
        expect(saved.disputedAt).toBeNull();
    });

    it('clears the deadline when the agent takes a RESOLVED ticket back', async () => {
        ticket = { ...makeTicket(TicketStatus.RESOLVED), resolutionDeadlineAt: DEADLINE };

        const saved = await service.updateTicket('ticket-1', { status: TicketStatus.IN_PROGRESS }, admin.id);

        expect(saved.status).toBe(TicketStatus.IN_PROGRESS);
        expect(saved.resolutionDeadlineAt).toBeNull();
    });

    it('does not let agents or admins set CLOSED directly', async () => {
        await expect(service.updateTicket('ticket-1', { status: TicketStatus.CLOSED }, admin.id))
            .rejects.toBeInstanceOf(BadRequestException);
        await expect(service.bulkUpdate(['ticket-1'], { status: TicketStatus.CLOSED }, admin.id))
            .rejects.toBeInstanceOf(BadRequestException);
    });

    it('locks CLOSED tickets against any change, even by an admin', async () => {
        ticket = makeTicket(TicketStatus.CLOSED);

        await expect(service.updateTicket('ticket-1', { priority: TicketPriority.HIGH }, admin.id))
            .rejects.toThrow(TICKET_CLOSED_MESSAGE);
        await expect(service.assignTicket('ticket-1', 'agent-2', admin.id))
            .rejects.toThrow(TICKET_CLOSED_MESSAGE);
        await expect(service.cancelTicket('ticket-1', admin.id, UserRole.ADMIN, TicketCancelReasonCode.DUPLICATE))
            .rejects.toBeInstanceOf(BadRequestException);

        const bulk = await service.bulkUpdate(['ticket-1'], { priority: 'HIGH' }, admin.id);
        expect(bulk).toEqual({ updated: 0, failed: ['ticket-1'] });
    });
    describe('cancel reason', () => {
        it('stores the reason code and trimmed note on the ticket', async () => {
            const saved = await service.cancelTicket('ticket-1', admin.id, UserRole.ADMIN, TicketCancelReasonCode.DUPLICATE, '  sama dengan #TKT-2  ');

            expect(saved.status).toBe(TicketStatus.CANCELLED);
            expect(saved.cancelReasonCode).toBe(TicketCancelReasonCode.DUPLICATE);
            expect(saved.cancelReason).toBe('sama dengan #TKT-2');
        });

        it('allows a fixed reason without a note', async () => {
            const saved = await service.cancelTicket('ticket-1', admin.id, UserRole.ADMIN, TicketCancelReasonCode.NOT_NEEDED);

            expect(saved.cancelReasonCode).toBe(TicketCancelReasonCode.NOT_NEEDED);
            expect(saved.cancelReason).toBeNull();
        });

        it.each([undefined, '   ', 'abc'])('rejects OTHER with a missing or too short note (%p)', async (note) => {
            await expect(service.cancelTicket('ticket-1', admin.id, UserRole.ADMIN, TicketCancelReasonCode.OTHER, note))
                .rejects.toBeInstanceOf(BadRequestException);
            expect(mockTicketRepo.save).not.toHaveBeenCalled();
        });
    });
});
