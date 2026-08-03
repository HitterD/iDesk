import { ForbiddenException } from '@nestjs/common';
import { TicketCreateService } from './ticket-create.service';
import { TicketPriority, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

describe('TicketCreateService Oracle scope', () => {
    it('rejects AGENT_ORACLE creation outside Oracle/K2 queue', async () => {
        const userRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'oracle-1', role: UserRole.AGENT_ORACLE, siteId: 'site-1' }),
        };
        const service = new TicketCreateService(
            {} as never,
            {} as never,
            userRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        await expect(service.createTicket('oracle-1', {
            title: 'Standard issue',
            description: 'Standard ticket description',
            priority: TicketPriority.MEDIUM,
            category: 'GENERAL',
            ticketType: TicketType.SERVICE,
        })).rejects.toBeInstanceOf(ForbiddenException);
    });
});
