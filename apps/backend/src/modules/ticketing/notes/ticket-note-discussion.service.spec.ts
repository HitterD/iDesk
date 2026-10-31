import { BadRequestException } from '@nestjs/common';
import { TicketNoteDiscussionService } from './ticket-note-discussion.service';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMessage } from './entities/ticket-note-message.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';

describe('TicketNoteDiscussionService', () => {
    let note: any;
    let member: any;
    let messages: any[];
    let service: TicketNoteDiscussionService;
    beforeEach(() => {
        note = { id: 'n', ticketId: 't', eventSequence: 0 };
        member = { noteId: 'n', userId: 'a', lastReadSequence: 0 };
        messages = [];
        const manager: any = {
            query: async () => [],
            findOne: async (entity: any, options: any) => entity === TicketNoteMessage ?
                messages.find(row => Object.entries(options.where).every(([key, value]) => row[key] === value)) || null : note,
            find: async (entity: any) => entity === TicketNoteMember ? [member, { userId: 'b' }] : [],
            create: (_: any, data: any) => ({ id: 'm' + (messages.length + 1), ...data }),
            save: async (entity: any, data: any) => {
                if (entity === TicketNoteMessage) messages.push(data);
                if (entity === TicketNote) note = data;
                if (entity === TicketNoteMember) member = data;
                return data;
            },
        };
        const access: any = {
            lockUsers: async () => undefined,
            assertMember: async () => ({ note, member, ticket: { id: 't' } }),
            assertHandler: async (_: any, id: string) => { if (id === 'ineligible') throw new Error('denied'); },
        };
        service = new TicketNoteDiscussionService({ manager, transaction: async (fn: any) => fn(manager) } as any, access);
    });
    it('stores discussion and allocates a monotonically increasing sequence', async () => {
        const message = await service.post('n', 'a', { content: 'Investigate', clientRequestId: 'request-1', mentionedUserIds: ['b'], attachmentIds: [] });
        expect(message.sequence).toBe(1);
        expect(message.mentionedUserIds).toEqual(['b']);
        expect(note.eventSequence).toBe(1);
    });
    it('does not duplicate a retried message', async () => {
        const input = { content: 'Once', clientRequestId: 'request-1', mentionedUserIds: [], attachmentIds: [] };
        await service.post('n', 'a', input);
        await service.post('n', 'a', input);
        expect(messages).toHaveLength(1);
    });
    it('rejects mentions outside the note members', async () => {
        await expect(service.post('n', 'a', { content: 'Hi', clientRequestId: 'r', mentionedUserIds: ['outsider'], attachmentIds: [] }))
            .rejects.toBeInstanceOf(BadRequestException);
    });
    it('does not mark messages beyond the acknowledged watermark read', async () => {
        note.eventSequence = 3;
        await service.markRead('n', 'a', 2);
        expect(member.lastReadSequence).toBe(2);
        await service.markRead('n', 'a', 1);
        expect(member.lastReadSequence).toBe(2);
    });
    it('rejects a forged future read watermark', async () => {
        await expect(service.markRead('n', 'a', 9)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('selects only a discussion belonging to this note', async () => {
        messages.push({ id: 'm1', noteId: 'n' });
        await service.solution('n', 'a', 'm1');
        expect(note.selectedSolutionMessageId).toBe('m1');
        expect(note.selectedById).toBe('a');
        await expect(service.solution('n', 'a', 'foreign')).rejects.toBeDefined();
        await service.solution('n', 'a', null);
        expect(note.selectedSolutionMessageId).toBeNull();
    });
});
