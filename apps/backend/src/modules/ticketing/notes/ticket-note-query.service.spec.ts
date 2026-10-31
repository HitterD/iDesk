import { TicketNoteQueryService } from './ticket-note-query.service';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteMessage } from './entities/ticket-note-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { HandlingTeam, TicketStatus } from '../entities/ticket.entity';

describe('TicketNoteQueryService', () => {
    const actor = { id: 'a', role: UserRole.AGENT, siteId: 's', isActive: true };
    const ticket = { id: 't', handlingTeam: HandlingTeam.OPS_SUPPORT, siteId: 's', status: TicketStatus.IN_PROGRESS };
    it('returns only member notes and unread mentions without exposing other notes', async () => {
        const notes = [{ id: 'n', ticketId: 't', deletedAt: null }, { id: 'secret', ticketId: 't', deletedAt: null }];
        const member = { noteId: 'n', userId: 'a', lastReadSequence: 1 };
        const manager: any = {
            find: async (entity: any) => entity === TicketNoteMember ? [member]
                : entity === TicketNote ? notes : entity === TicketNoteMessage ? [
                    { noteId: 'n', authorId: 'b', sequence: 2, mentionedUserIds: ['a'] },
                ] : [],
            findOne: async (entity: any, options: any) => entity === User ? actor
                : entity === TicketNote ? notes.find(note => note.id === options.where.id)
                : entity === TicketNoteMember ? member : ticket,
        };
        const source: any = { manager };
        const service = new TicketNoteQueryService(source, new TicketNoteAccessService(source));
        const result = await service.list('t', 'a');
        expect(result.map(note => note.id)).toEqual(['n']);
        expect(result[0].hasUnread).toBe(true);
        expect(result[0].hasMention).toBe(true);
    });
});
