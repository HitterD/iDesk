import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketResolutionService, RESOLUTION_MESSAGES } from './ticket-resolution.service';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { createTestSlaClock } from './sla-clock.testing';

describe('TicketResolutionService', () => {
    const owner = { id: 'owner-1', fullName: 'Budi', role: 'USER' } as User;
    let ticket: Partial<Ticket>;
    let saved: { tickets: Ticket[]; messages: any[] };
    let manager: any;
    let deps: Record<string, any>;
    let service: TicketResolutionService;

    const makeTicket = (status: TicketStatus): Partial<Ticket> => ({
        id: 't-1', ticketNumber: 'TKT-1', userId: owner.id, assignedToId: 'agent-1', siteId: 'site-1',
        status, resolvedAt: new Date('2026-09-28T02:00:00Z'), resolutionDeadlineAt: new Date('2026-09-29T02:00:00Z'),
    });

    beforeEach(() => {
        ticket = makeTicket(TicketStatus.RESOLVED);
        saved = { tickets: [], messages: [] };
        manager = {
            findOne: jest.fn((entity: unknown) => Promise.resolve(entity === Ticket ? ticket : owner)),
            create: jest.fn((_e: unknown, data: any) => ({ ...data })),
            save: jest.fn((entity: unknown, data: any) => {
                if (entity === TicketMessage) saved.messages.push(data);
                if (entity === Ticket) saved.tickets.push({ ...data });
                return Promise.resolve(data);
            }),
        };
        deps = {
            dataSource: { transaction: jest.fn((cb: any) => cb(manager)) },
            ticketRepo: { findOne: jest.fn(() => Promise.resolve(ticket)), find: jest.fn() },
            eventsGateway: { notifyNewMessage: jest.fn(), notifyStatusChange: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() },
            cache: { onTicketChange: jest.fn() },
            eventEmitter: { emit: jest.fn() },
            audit: { logAsync: jest.fn() },
            workload: { recalculateAgentWorkload: jest.fn() },
            notification: { create: jest.fn() },
            notificationCenter: { emitActionItemsRefresh: jest.fn() },
        };
        service = new TicketResolutionService(
            deps.dataSource, deps.ticketRepo, deps.eventsGateway, deps.cache, deps.eventEmitter,
            deps.audit, deps.workload, deps.notification, deps.notificationCenter, createTestSlaClock(),
        );
    });

    describe('confirmResolution', () => {
        it('closes a RESOLVED ticket and keeps resolvedAt for stats', async () => {
            await service.confirmResolution('t-1', owner.id);

            const closed = saved.tickets[0];
            expect(closed.status).toBe(TicketStatus.CLOSED);
            expect(closed.closedAt).toBeInstanceOf(Date);
            expect(closed.resolutionDeadlineAt).toBeNull();
            expect(closed.resolvedAt).toEqual(new Date('2026-09-28T02:00:00Z'));
            expect(deps.eventEmitter.emit).toHaveBeenCalledWith('ticket.updated', expect.objectContaining({ userId: owner.id, closedReason: 'confirmed' }));
            expect(deps.eventsGateway.notifyStatusChange).toHaveBeenCalledWith('t-1', TicketStatus.CLOSED, 'Budi', 'site-1');
        });

        it('refuses anyone but the requester', async () => {
            await expect(service.confirmResolution('t-1', 'someone-else'))
                .rejects.toThrow(new ForbiddenException(RESOLUTION_MESSAGES.NOT_OWNER));
            expect(saved.tickets).toHaveLength(0);
        });

        it('refuses tickets that are not awaiting confirmation', async () => {
            ticket = makeTicket(TicketStatus.IN_PROGRESS);
            await expect(service.confirmResolution('t-1', owner.id)).rejects.toThrow(RESOLUTION_MESSAGES.NOT_AWAITING_CONFIRMATION);
        });

        it('refuses closed tickets', async () => {
            ticket = makeTicket(TicketStatus.CLOSED);
            await expect(service.confirmResolution('t-1', owner.id)).rejects.toThrow(new BadRequestException(TICKET_CLOSED_MESSAGE));
        });
    });

    describe('disputeResolution', () => {
        it('reopens the ticket for the same agent, posts the reason and notifies the agent', async () => {
            await service.disputeResolution('t-1', owner.id, '  Printer masih error  ');

            const reopened = saved.tickets[0];
            expect(reopened.status).toBe(TicketStatus.IN_PROGRESS);
            expect(reopened.assignedToId).toBe('agent-1');
            expect(reopened.disputedAt).toBeInstanceOf(Date);
            expect(reopened.resolutionDeadlineAt).toBeNull();
            expect(reopened.resolvedAt).toBeNull();

            expect(saved.messages[0]).toMatchObject({
                content: 'Sanggahan penyelesaian: Printer masih error',
                senderId: owner.id,
                isSystemMessage: false,
            });
            expect(deps.notification.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'agent-1',
                ticketId: 't-1',
                message: expect.stringContaining('Printer masih error'),
            }));
            expect(deps.notificationCenter.emitActionItemsRefresh).toHaveBeenCalledWith('agent-1', 'TICKET', 't-1');
            expect(deps.eventEmitter.emit).toHaveBeenCalledWith('ticket.updated', expect.objectContaining({
                userId: owner.id, reason: 'Printer masih error', closedReason: undefined,
            }));
        });
    });

    describe('disputeResolution SLA', () => {
        const target = new Date('2026-09-28T04:00:00Z');

        it('keeps the original target, so a dispute after it passed is overdue', async () => {
            // Resolved at 02:00 with 2h left, disputed long after the 04:00 target.
            ticket = { ...makeTicket(TicketStatus.RESOLVED), slaStartedAt: new Date('2026-09-28T00:00:00Z'), slaTarget: target, slaRemainingMinutes: 120, isOverdue: false };
            await service.disputeResolution('t-1', owner.id, 'Belum beres');

            const reopened = saved.tickets[0];
            expect(reopened.slaTarget).toEqual(target);
            expect(reopened.slaRemainingMinutes).toBeNull();
            expect(reopened.isOverdue).toBe(true);
        });

        it('stays on time when disputed before the original target', async () => {
            const future = new Date(Date.now() + 3_600_000);
            ticket = { ...makeTicket(TicketStatus.RESOLVED), slaStartedAt: new Date(), slaTarget: future, slaRemainingMinutes: 60, isOverdue: false };
            await service.disputeResolution('t-1', owner.id, 'Belum beres');

            expect(saved.tickets[0].slaTarget).toEqual(future);
            expect(saved.tickets[0].isOverdue).toBe(false);
        });
    });

    describe('selfResolve', () => {
        it.each([TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_VENDOR])('closes a %s ticket', async (status) => {
            ticket = { ...makeTicket(status), resolvedAt: null, lastPausedAt: status === TicketStatus.WAITING_VENDOR ? new Date() : null };
            await service.selfResolve('t-1', owner.id);

            const closed = saved.tickets[0];
            expect(closed.status).toBe(TicketStatus.CLOSED);
            expect(closed.resolvedAt).toBeInstanceOf(Date);
            expect(closed.closedAt).toBeInstanceOf(Date);
            expect(closed.lastPausedAt).toBeNull();
            expect(deps.eventEmitter.emit).toHaveBeenCalledWith('ticket.updated', expect.objectContaining({ closedReason: 'manual' }));
        });

        it.each([TicketStatus.RESOLVED, TicketStatus.CANCELLED])('refuses a %s ticket', async (status) => {
            ticket = makeTicket(status);
            await expect(service.selfResolve('t-1', owner.id)).rejects.toThrow(RESOLUTION_MESSAGES.NOT_SELF_RESOLVABLE);
        });
    });

    describe('autoCloseExpired', () => {
        it('closes expired tickets as the system and skips ones answered meanwhile', async () => {
            deps.ticketRepo.find.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);
            manager.findOne = jest.fn()
                .mockResolvedValueOnce(ticket)
                .mockResolvedValueOnce(makeTicket(TicketStatus.CLOSED));

            const result = await service.autoCloseExpired(new Date('2026-09-30T00:00:00Z'));

            expect(result).toEqual({ closed: 1, failed: 0 });
            expect(saved.tickets).toHaveLength(1);
            expect(saved.tickets[0].status).toBe(TicketStatus.CLOSED);
            expect(deps.audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'system' }));
            expect(deps.eventEmitter.emit).toHaveBeenCalledWith('ticket.updated', expect.objectContaining({ userId: 'system', closedReason: 'auto_unconfirmed' }));
        });

        it('counts failures without stopping the scan', async () => {
            deps.ticketRepo.find.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);
            manager.findOne = jest.fn()
                .mockRejectedValueOnce(new Error('deadlock'))
                .mockResolvedValueOnce(ticket);

            await expect(service.autoCloseExpired()).resolves.toEqual({ closed: 1, failed: 1 });
        });
    });
});
