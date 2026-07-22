import { ForbiddenException } from '@nestjs/common';
import { TicketMessagingService } from './ticket-messaging.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketType } from '../entities/ticket.entity';

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
