import { ForbiddenException } from '@nestjs/common';
import { TicketMessagingService } from './ticket-messaging.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus, TicketType } from '../entities/ticket.entity';
import { createTestSlaClock } from './sla-clock.testing';

describe('TicketMessagingService Oracle scope', () => {
    it('blocks AGENT_ORACLE from reading standard-ticket messages', async () => {
        const ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE }),
        };
        const service = new TicketMessagingService(
            ticketRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.getMessages('standard', UserRole.AGENT_ORACLE)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks AGENT_ORACLE from paginated standard-ticket messages before querying messages', async () => {
        const ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE }),
        };
        const messageRepo = { createQueryBuilder: jest.fn() };
        const service = new TicketMessagingService(
            ticketRepo as never,
            messageRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.getMessagesPaginated('standard', 1, 20, UserRole.AGENT_ORACLE))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('blocks AGENT_ORACLE reply to a standard ticket before message write', async () => {
        const manager = {
            findOne: jest.fn()
                .mockResolvedValueOnce({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE })
                .mockResolvedValueOnce({ id: 'oracle-1', role: UserRole.AGENT_ORACLE }),
        };
        const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
        const service = new TicketMessagingService(
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            dataSource as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.replyToTicket('standard', 'oracle-1', 'reply'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect((manager as { create?: jest.Mock }).create).toBeUndefined();
    });

    describe('TV board refresh on reply', () => {
        const buildService = (ticketStatus: TicketStatus) => {
            const ticket = {
                id: 't-1', siteId: 'site-1', userId: 'owner', status: ticketStatus, ticketType: TicketType.SERVICE,
                category: 'GENERAL', participants: [], slaStartedAt: new Date(), user: { id: 'owner' },
            };
            const manager = {
                findOne: jest.fn()
                    .mockResolvedValueOnce(ticket)
                    .mockResolvedValueOnce({ id: 'agent-1', role: UserRole.AGENT, siteId: 'site-1' }),
                create: jest.fn((_entity, data) => data),
                save: jest.fn((_entity, data) => Promise.resolve(data)),
            };
            const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
            const eventsGateway = {
                notifyNewMessage: jest.fn(),
                emitToTicketAudience: jest.fn(),
                server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            };
            const eventEmitter = { emit: jest.fn() };
            const service = new TicketMessagingService(
                {} as never, {} as never, {} as never, {} as never,
                dataSource as never, eventsGateway as never, eventEmitter as never, createTestSlaClock(),
            );
            return { service, eventEmitter };
        };

        it('refreshes TV boards when an agent reply starts work on an Open ticket', async () => {
            const { service, eventEmitter } = buildService(TicketStatus.TODO);

            await service.replyToTicket('t-1', 'agent-1', 'on it');

            expect(eventEmitter.emit).toHaveBeenCalledWith('tv-board.ticket-changed', { siteId: 'site-1' });
        });

        it('leaves TV boards alone when the ticket was already in progress', async () => {
            const { service, eventEmitter } = buildService(TicketStatus.IN_PROGRESS);

            await service.replyToTicket('t-1', 'agent-1', 'update');

            expect(eventEmitter.emit).not.toHaveBeenCalledWith('tv-board.ticket-changed', expect.anything());
        });
    });

    describe('reply from the requester side', () => {
        const build = (role: UserRole) => {
            const ticket = {
                id: 't-1', siteId: 'site-smg', userId: 'agent-smg', status: TicketStatus.TODO,
                handlingTeam: 'ORACLE_DEV', ticketType: TicketType.ORACLE_REQUEST, category: 'ORACLE_REQUEST',
                participants: [], user: { id: 'agent-smg' }, firstResponseAt: null,
            };
            const manager = {
                findOne: jest.fn()
                    .mockResolvedValueOnce(ticket)
                    .mockResolvedValueOnce({ id: 'agent-smg', role, siteId: 'site-smg' }),
                create: jest.fn((_entity, data) => data),
                save: jest.fn((_entity, data) => Promise.resolve(data)),
            };
            const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
            const eventsGateway = {
                notifyNewMessage: jest.fn(),
                emitToTicketAudience: jest.fn(),
                server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            };
            const service = new TicketMessagingService(
                {} as never, {} as never, {} as never, {} as never,
                dataSource as never, eventsGateway as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
            return { service, ticket };
        };

        it('a support agent chatting on their forwarded dev ticket acts as requester (no first response, no start)', async () => {
            const { service, ticket } = build(UserRole.AGENT);

            await service.replyToTicket('t-1', 'agent-smg', 'any update?');

            expect(ticket.firstResponseAt).toBeNull();
            expect(ticket.status).toBe(TicketStatus.TODO);
            expect((ticket as Record<string, unknown>).lastMessageSenderRole).toBe(UserRole.USER);
        });

        it('rejects an internal note from the requester side', async () => {
            const { service } = build(UserRole.AGENT);

            await expect(service.replyToTicket('t-1', 'agent-smg', 'note', [], [], true))
                .rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('markAsRead', () => {
        const build = (ticket: Record<string, unknown>) => {
            const set = jest.fn();
            const qb: any = {
                update: jest.fn(() => qb),
                set: jest.fn((v) => { set(v); return qb; }),
                where: jest.fn(() => qb),
                execute: jest.fn().mockResolvedValue({ affected: 1 }),
            };
            const ticketRepo = {
                createQueryBuilder: jest.fn(() => qb),
                findOne: jest.fn().mockResolvedValue(ticket),
            };
            const emitter = { emit: jest.fn() };
            const service = new TicketMessagingService(
                ticketRepo as never, {} as never, {} as never, {} as never,
                {} as never, {} as never, emitter as never, createTestSlaClock(),
            );
            return { service, ticketRepo, set, emitter };
        };
        const opsTicket = { id: 't-1', userId: 'owner', createdById: null, handlingTeam: 'OPS_SUPPORT', siteId: 'site-1' };

        it('tells iPop who opened the ticket so their chat notifications clear', async () => {
            const { service, emitter } = build(opsTicket);
            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(emitter.emit).toHaveBeenCalledWith('ticket.read', { ticketId: 't-1', userId: 'owner' });
        });

        it('marks the agent side for a handling agent and the user side for a USER', async () => {
            const { service, set } = build(opsTicket);

            await service.markAsRead('t-1', 'u-1', UserRole.AGENT, 'site-1');
            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ agentLastReadAt: expect.any(Date) }));
            expect(set.mock.lastCall[0]).not.toHaveProperty('userLastReadAt');

            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ userLastReadAt: expect.any(Date) }));
        });

        it('a support agent who filed a dev ticket reads only the requester side', async () => {
            const { service, set } = build({ ...opsTicket, createdById: 'agent-smg', handlingTeam: 'ORACLE_DEV' });

            await service.markAsRead('t-1', 'agent-smg', UserRole.AGENT, 'site-1');

            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ userLastReadAt: expect.any(Date) }));
            expect(set.mock.lastCall[0]).not.toHaveProperty('agentLastReadAt');
        });

        // Reading must not look like activity: keep updatedAt and version as they are.
        it('keeps updatedAt and version unchanged when marking as read', async () => {
            const { service, set } = build(opsTicket);

            await service.markAsRead('t-1', 'owner', UserRole.USER);

            const values = set.mock.lastCall[0];
            expect(values.updatedAt()).toBe('"updatedAt"');
            expect(values.version()).toBe('"version"');
        });
    });
});
