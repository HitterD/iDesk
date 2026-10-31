import { validate } from 'class-validator';
import { CreateTicketNoteDto, SaveTicketNoteDto, PostTicketNoteMessageDto } from './ticket-note.dto';

describe('private note request validation', () => {
    it('rejects non UUID membership IDs and excessively long titles', async () => {
        const value = Object.assign(new CreateTicketNoteDto(), { title: 'x'.repeat(201), memberIds: ['invalid'] });
        expect((await validate(value)).map(error => error.property)).toEqual(expect.arrayContaining(['title', 'memberIds']));
    });
    it('rejects negative document versions', async () => {
        const value = Object.assign(new SaveTicketNoteDto(), { sessionId: 'invalid', expectedVersion: -1, document: {} });
        expect((await validate(value)).map(error => error.property)).toContain('expectedVersion');
    });
    it('rejects discussion requests without an idempotency ID', async () => {
        const value = Object.assign(new PostTicketNoteMessageDto(), { content: 'hi', mentionedUserIds: [], attachmentIds: [] });
        expect((await validate(value)).map(error => error.property)).toContain('clientRequestId');
    });
});
