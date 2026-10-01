import { ForbiddenException } from '@nestjs/common';
import { TicketMessagingService } from './ticket-messaging.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus, TicketType } from '../entities/ticket.entity';

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
            {} as never,
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
            {} as never,
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
            {} as never,
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
                dataSource as never, eventsGateway as never, eventEmitter as never,
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

    it('marks ticket as read for agent and user', async () => {
        const ticketRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
        const service = new TicketMessagingService(
            ticketRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        await service.markAsRead('t-1', 'u-1', UserRole.AGENT);
        expect(ticketRepo.update).toHaveBeenCalledWith('t-1', expect.objectContaining({ agentLastReadAt: expect.any(Date) }));

        await service.markAsRead('t-1', 'u-1', UserRole.USER);
        expect(ticketRepo.update).toHaveBeenCalledWith('t-1', expect.objectContaining({ userLastReadAt: expect.any(Date) }));
    });
});
