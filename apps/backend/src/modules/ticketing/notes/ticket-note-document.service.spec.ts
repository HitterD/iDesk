import { ConflictException } from '@nestjs/common';
import { TicketNoteDocumentService } from './ticket-note-document.service';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteEditSession } from './entities/ticket-note-edit-session.entity';
import { TicketNoteRevision } from './entities/ticket-note-revision.entity';

describe('TicketNoteDocumentService', () => {
    let now: Date;
    let note: any;
    let sessions: any[];
    let revisions: any[];
    let manager: any;
    let service: TicketNoteDocumentService;
    beforeEach(() => {
        now = new Date('2026-10-30T10:00:00Z');
        note = { id: 'n', ticketId: 't', contentVersion: 0, document: { type: 'doc', content: [] } };
        sessions = []; revisions = [];
        manager = {
            query: async () => [{ now }],
            findOne: async (entity: any, options: any) => entity === TicketNote ? note :
                sessions.find(row => row.noteId === options.where.noteId && !row.closedAt) || null,
            find: async () => [],
            create: (_: any, data: any) => ({ ...data }),
            save: async (entity: any, row: any) => {
                if (entity === TicketNote) note = row;
                if (entity === TicketNoteEditSession) {
                    const index = sessions.findIndex(value => value.id === row.id);
                    if (index < 0) sessions.push(row); else sessions[index] = row;
                }
                if (entity === TicketNoteRevision) revisions.push(row);
                return row;
            },
        };
        const access: any = { assertMember: async () => ({ note, ticket: { id: 't' }, user: { id: 'a' } }) };
        service = new TicketNoteDocumentService({ transaction: async (fn: any) => fn(manager), manager } as any, access);
    });
    it('grants a 60 second lease and rejects a competing tab', async () => {
        const session = await service.acquire('n', 'a');
        expect(new Date(session.leaseUntil).toISOString()).toBe('2026-10-30T10:01:00.000Z');
        await expect(service.acquire('n', 'a')).rejects.toBeInstanceOf(ConflictException);
    });
    it('rejects stale session tokens and expired heartbeats', async () => {
        const session = await service.acquire('n', 'a');
        await expect(service.heartbeat('n', 'a', 'other')).rejects.toBeInstanceOf(ConflictException);
        now = new Date('2026-10-30T10:01:01Z');
        await expect(service.heartbeat('n', 'a', session.sessionId)).rejects.toBeInstanceOf(ConflictException);
    });
    it('persists autosaves with version checking and makes one revision when released', async () => {
        const session = await service.acquire('n', 'a');
        const document = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'solution' }] }] };
        await service.save('n', 'a', { sessionId: session.sessionId, expectedVersion: 0, document });
        await expect(service.save('n', 'a', { sessionId: session.sessionId, expectedVersion: 0, document }))
            .rejects.toBeInstanceOf(ConflictException);
        expect(note.contentVersion).toBe(1);
        expect(note.document).toEqual(document);
        expect(revisions).toHaveLength(0);
        await service.release('n', 'a', session.sessionId);
        expect(revisions).toHaveLength(1);
        expect(revisions[0].document).toEqual(document);
    });
    it('recovers one revision from expired autosaves before a new lease', async () => {
        const session = await service.acquire('n', 'a');
        await service.save('n', 'a', { sessionId: session.sessionId, expectedVersion: 0, document: { type: 'doc', content: [] } });
        now = new Date('2026-10-30T10:01:01Z');
        const next = await service.acquire('n', 'a');
        expect(next.sessionId).not.toBe(session.sessionId);
        expect(revisions).toHaveLength(1);
        await expect(service.release('n', 'a', session.sessionId)).rejects.toBeInstanceOf(ConflictException);
    });
});
