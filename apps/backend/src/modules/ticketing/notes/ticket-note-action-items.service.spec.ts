import { TicketNoteActionItemsService } from './ticket-note-action-items.service';
import { NotFoundException } from '@nestjs/common';

describe('TicketNoteActionItemsService', () => {
    it('returns HIGH for unread mentions only when member remains a handler', async () => {
        const manager: any = { find: async () => [{ noteId: 'n', lastReadSequence: 1 }] };
        const access: any = { assertMember: async () => ({ note: { id: 'n', ticketId: 't', updatedAt: new Date() } }) };
        const query: any = { unread: async () => ({ hasUnread: true, hasMention: true }) };
        const service = new TicketNoteActionItemsService({ manager } as any, access, query);
        const items = await service.items('a');
        expect(items[0].urgency).toBe('HIGH');
        expect(items[0].entityType).toBe('TICKET_NOTE');
        expect(items[0].link).toBe('/tickets/t?noteId=n');
        access.assertMember = async () => { throw new NotFoundException(); };
        expect(await service.items('a')).toEqual([]);
    });
    it('omits a note whose unread discussion was acknowledged', async () => {
        const source: any = { manager: { find: async () => [{ noteId: 'n', lastReadSequence: 3 }] } };
        const access: any = { assertMember: async () => ({ note: { id: 'n', ticketId: 't' } }) };
        const query: any = { unread: async () => ({ hasUnread: false, hasMention: false }) };
        expect(await new TicketNoteActionItemsService(source, access, query).items('a')).toEqual([]);
    });
});
