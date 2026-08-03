import { ForbiddenException } from '@nestjs/common';
import { TicketMergeService } from './ticket-merge.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketType } from '../entities/ticket.entity';

describe('TicketMergeService Oracle scope', () => {
    it('blocks AGENT_ORACLE merge containing a standard ticket before writes', async () => {
        const manager = {
            findOne: jest.fn()
                .mockResolvedValueOnce({ id: 'oracle', category: 'ORACLE_REQUEST', ticketType: TicketType.ORACLE_REQUEST })
                .mockResolvedValueOnce({ id: 'oracle-1', role: UserRole.AGENT_ORACLE }),
            find: jest.fn().mockResolvedValue([
                { id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE },
            ]),
        };
        const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
        const service = new TicketMergeService(
            {} as never,
            {} as never,
            {} as never,
            dataSource as never,
            {} as never,
            {} as never,
        );

        await expect(service.mergeTickets('oracle', ['standard'], 'oracle-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect((manager as { save?: jest.Mock }).save).toBeUndefined();
    });
});
