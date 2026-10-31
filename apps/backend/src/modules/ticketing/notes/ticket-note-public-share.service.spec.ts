import { TicketNotePublicShareService } from './ticket-note-public-share.service';

describe('TicketNotePublicShareService', () => {
    it('requires the selected solution rather than any private message', async () => {
        const access: any = { assertMember: async () => ({ note: { selectedSolutionMessageId: 'chosen' }, ticket: {} }), assertWritable: () => {} };
        const service = new TicketNotePublicShareService({} as any, access, {} as any);
        await expect(service.share('n', 'a', 'other', 'request')).rejects.toThrow('Pilih solusi');
    });
    it('publishes only text through public reply and never private attachments', async () => {
        const replies: any[] = [];
        const source: any = { manager: { save: async (_: any, value: any) => value, create: (_: any, value: any) => value, findOne: async () => ({ id: 'm', noteId: 'n', content: 'Restart service', attachmentIds: ['private-image'] }) } };
        const access: any = { assertMember: async () => ({ note: { ticketId: 't', selectedSolutionMessageId: 'm' } }), assertWritable: () => {} };
        const messaging: any = { replyToTicket: async (...args: any[]) => { replies.push(args); return { id: 'public' }; } };
        const service = new TicketNotePublicShareService(source, access, messaging);
        await service.share('n', 'a', 'm', 'request');
        expect(replies[0]).toEqual(['t', 'a', 'Restart service', [], [], false, [], 'request', expect.any(Function)]);
        expect(JSON.stringify(replies)).not.toContain('private-image');
    });
});
