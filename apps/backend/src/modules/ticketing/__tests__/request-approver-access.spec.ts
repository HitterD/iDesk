/**
 * The manager / GM a request flow names may open the ticket and chat on it from any site and role, but nothing else.
 * Real enforcement chain (services + RolesGuard) with minimal mocks.
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketPriority, TicketStatus, TicketType } from '../entities/ticket.entity';
import { TicketsController } from '../presentation/tickets.controller';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { TicketQueryService } from '../services/ticket-query.service';
import { createTestSlaClock } from '../services/sla-clock.testing';

const REQUEST_SITE = 'site-smg';
const APPROVER_SITE = 'site-spj';
const APPROVER = 'mgr-1';
const approverViewer = { id: APPROVER, role: UserRole.USER, siteId: APPROVER_SITE };

const requestTicket = (): Ticket => ({
    id: 't1', ticketNumber: '0001', title: 'x', status: TicketStatus.WAITING_VENDOR, priority: TicketPriority.MEDIUM, category: 'HARDWARE_REQUEST',
    ticketType: TicketType.HARDWARE_REQUEST, siteId: REQUEST_SITE, userId: 'requester', createdById: null, participants: [], messages: [],
    user: { id: 'requester', email: 'r@x', fullName: 'R' }, assignedTo: null,
} as unknown as Ticket);

/** `query` answers the flow lookup: true only for the flow's own approver. */
const flowQuery = (approverId: string | null) => jest.fn(async (_sql: string, params: unknown[]) => (params[1] === approverId ? [{ one: 1 }] : []));

describe('request approver access', () => {
    describe('GET /tickets/:id', () => {
        const build = (approverId: string | null) => {
            const ticketRepo = {
                findOne: jest.fn(async () => ({ ...requestTicket(), user: { id: 'requester', department: null } })),
                manager: { query: flowQuery(approverId) },
            };
            return new TicketQueryService(ticketRepo as never, { findOne: jest.fn() } as never, { getOrSet: jest.fn() } as never);
        };

        it('approver from another site can read the ticket as a requester-side viewer', async () => {
            const result = await build(APPROVER).findOne('t1', approverViewer);
            expect(result.viewerAccess).toBe('requester');
        });

        it('assertCanView agrees', async () => {
            const ticketRepo = { findOne: jest.fn(async () => requestTicket()), manager: { query: flowQuery(APPROVER) } };
            const service = new TicketQueryService(ticketRepo as never, {} as never, {} as never);
            await expect(service.assertCanView('t1', approverViewer)).resolves.toBe('requester');
        });

        it('a stranger from another site is still refused', async () => {
            await expect(build(APPROVER).findOne('t1', { id: 'stranger', role: UserRole.USER, siteId: APPROVER_SITE })).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('a user the lookup does not find as approver of this ticket is refused (not a request ticket)', async () => {
            const ticketRepo = { findOne: jest.fn(async () => ({ ...requestTicket(), ticketType: TicketType.SERVICE, category: 'GENERAL' })), manager: { query: jest.fn(async () => []) } };
            const service = new TicketQueryService(ticketRepo as never, {} as never, {} as never);
            await expect(service.assertCanView('t1', approverViewer)).rejects.toBeInstanceOf(ForbiddenException);
            expect(ticketRepo.manager.query).toHaveBeenCalledWith(expect.stringContaining('request_flows'), ['t1', APPROVER]);
        });

        it('a failing flow lookup propagates instead of granting access (fail-closed)', async () => {
            const ticketRepo = { findOne: jest.fn(async () => requestTicket()), manager: { query: jest.fn(async () => { throw new Error('db down'); }) } };
            const service = new TicketQueryService(ticketRepo as never, {} as never, {} as never);
            await expect(service.assertCanView('t1', approverViewer)).rejects.toThrow('db down');
        });

        it('a stranger of another site with an agent role is still refused', async () => {
            await expect(build(APPROVER).findOne('t1', { id: 'agent-9', role: UserRole.AGENT, siteId: APPROVER_SITE })).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('POST /tickets/:id/messages (reply)', () => {
        const build = (approverId: string | null) => {
            const ticket = requestTicket();
            const saved: unknown[] = [];
            const manager = {
                findOne: jest.fn(async (entity: { name?: string }) => (entity?.name === 'User' ? { id: APPROVER, role: UserRole.USER, fullName: 'Pak Manager', siteId: APPROVER_SITE } : ticket)),
                create: jest.fn((_e: unknown, v: unknown) => v),
                save: jest.fn(async (_e: unknown, v: unknown) => { saved.push(v); return { id: 'm1', ...(v as object) }; }),
                query: flowQuery(approverId),
            };
            const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
            const gateway = {
                notifyNewMessage: jest.fn(), notifyReadState: jest.fn(), emitToTicketAudience: jest.fn(), notifyTicketUpdate: jest.fn(),
                notifyStatusChange: jest.fn(), server: { to: () => ({ emit: jest.fn() }) },
            };
            const service = new TicketMessagingService(
                {} as never, {} as never, { manager: { find: jest.fn(async () => []) } } as never, {} as never,
                dataSource as never, gateway as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
            return { service, saved };
        };

        it('approver from another site can send a public message', async () => {
            const { service, saved } = build(APPROVER);
            await expect(service.replyToTicket('t1', APPROVER, 'Setuju, lanjut')).resolves.toMatchObject({ content: 'Setuju, lanjut' });
            expect(saved[0]).toMatchObject({ ticketId: 't1', senderId: APPROVER, isInternal: false });
        });

        it('approver cannot write internal notes', async () => {
            const { service } = build(APPROVER);
            await expect(service.replyToTicket('t1', APPROVER, 'catatan', [], [], true)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('a stranger cannot chat', async () => {
            const { service } = build(null);
            await expect(service.replyToTicket('t1', APPROVER, 'halo')).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('PATCH /tickets/:id/status (any other agent endpoint)', () => {
        it('approver with role USER is refused by the role guard', () => {
            const guard = new RolesGuard(new Reflector());
            const context = {
                getHandler: () => TicketsController.prototype.updateStatus,
                getClass: () => TicketsController,
                switchToHttp: () => ({ getRequest: () => ({ user: { userId: APPROVER, role: UserRole.USER, siteId: APPROVER_SITE } }) }),
            } as unknown as ExecutionContext;
            expect(guard.canActivate(context)).toBe(false);
        });

        it('GET and reply stay open to every signed-in role', () => {
            const guard = new RolesGuard(new Reflector());
            const open = (handler: unknown) => guard.canActivate({
                getHandler: () => handler, getClass: () => TicketsController,
                switchToHttp: () => ({ getRequest: () => ({ user: { userId: APPROVER, role: UserRole.USER } }) }),
            } as unknown as ExecutionContext);
            expect(open(TicketsController.prototype.findOne)).toBe(true);
            expect(open(TicketsController.prototype.replyToTicket)).toBe(true);
        });
    });
});
