import { ForbiddenException } from '@nestjs/common';
import { TicketMergeService } from './ticket-merge.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketType, Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { TicketNote } from '../notes/entities/ticket-note.entity';

describe('TicketMergeService Oracle scope', () => {
    it('keeps archived internal messages private when merged', async () => {
        const primary = { id: 'p', ticketNumber: 'P', status: TicketStatus.IN_PROGRESS };
        const secondary = { id: 's', ticketNumber: 'S', status: TicketStatus.IN_PROGRESS, description: '' };
        const savedMessages: any[] = [];
        const savedNotes: any[] = [];
        const manager = {
            findOne: jest.fn(async (entity: any) => entity === User ? { id: 'u', role: UserRole.ADMIN } : primary),
            find: jest.fn(async (entity: any) => entity === Ticket ? [secondary] : entity === TicketMessage ? [
                { senderId: 'u', content: 'private diagnosis', attachments: [], isInternal: true },
            ] : entity === TicketNote ? [{ id: 'private-note', ticketId: 's', createdById: 'u' }] : []),
            create: (_entity: any, data: any) => data,
            save: async (entity: any, data: any) => {
                if (entity === TicketMessage) savedMessages.push(...(Array.isArray(data) ? data : [data]));
                if (entity === TicketNote) savedNotes.push(...(Array.isArray(data) ? data : [data]));
                return data;
            },
        };
        const gateway: any = { server: { to: () => ({ emit: jest.fn() }) }, emitToTicketAudience: jest.fn(),
            notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
        const service = new TicketMergeService({ findOne: async () => primary } as any, {} as any, {} as any,
            { transaction: async (fn: any) => fn(manager) } as any, gateway, { log: async () => undefined } as any);
        await service.mergeTickets('p', ['s'], 'u');
        expect(savedMessages.find(message => message.content.includes('private diagnosis'))?.isInternal).toBe(true);
        expect(savedNotes).toEqual([expect.objectContaining({ id: 'private-note', ticketId: 'p', createdById: 'u' })]);
    });

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
