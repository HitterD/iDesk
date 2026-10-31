import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, LessThan } from 'typeorm';
import { TicketNote, NoteDocumentNode } from './entities/ticket-note.entity';
import { TicketNoteEditSession } from './entities/ticket-note-edit-session.entity';
import { TicketNoteRevision } from './entities/ticket-note-revision.entity';
import { TicketNoteAttachment } from './entities/ticket-note-attachment.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { Cron } from '@nestjs/schedule';
import { validateNoteDocument } from './ticket-note-document.validation';

const LEASE_TTL_MS = 60_000;

@Injectable()
export class TicketNoteDocumentService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService) {}

    @Cron('17 * * * * *')
    async recoverExpired(): Promise<void> {
        await this.source.transaction(async manager => {
            const now = await this.now(manager);
            const sessions = await manager.find(TicketNoteEditSession, {
                where: { closedAt: IsNull(), leaseUntil: LessThan(now) }, take: 50,
            });
            for (const session of sessions) {
                const note = await manager.findOne(TicketNote, { where: { id: session.noteId }, lock: { mode: 'pessimistic_write' } });
                const current = await this.active(manager, session.noteId);
                if (note && current?.id === session.id && current.leaseUntil <= now) await this.finalize(manager, note, current, now);
            }
        });
    }

    async acquire(noteId: string, actorId: string) {
        return this.source.transaction(async manager => {
            const note = await this.lock(manager, noteId, actorId);
            const now = await this.now(manager);
            const active = await this.active(manager, noteId);
            if (active && active.leaseUntil > now) throw new ConflictException('Catatan sedang diedit.');
            if (active) await this.finalize(manager, note, active, now);
            const session = manager.create(TicketNoteEditSession, { id: randomUUID(), noteId, userId: actorId,
                leaseUntil: new Date(now.getTime() + LEASE_TTL_MS), baseVersion: note.contentVersion, closedAt: null });
            await manager.save(TicketNoteEditSession, session);
            return { sessionId: session.id, leaseUntil: session.leaseUntil,
                contentVersion: note.contentVersion, document: note.document };
        });
    }

    async heartbeat(noteId: string, actorId: string, sessionId: string) {
        return this.source.transaction(async manager => {
            await this.lock(manager, noteId, actorId);
            const now = await this.now(manager);
            const session = await this.requireSession(manager, noteId, actorId, sessionId, now);
            const updated = { ...session, leaseUntil: new Date(now.getTime() + LEASE_TTL_MS) };
            await manager.save(TicketNoteEditSession, updated);
            return { leaseUntil: updated.leaseUntil };
        });
    }

    async save(noteId: string, actorId: string, input: { sessionId: string; expectedVersion: number; document: NoteDocumentNode }) {
        return this.source.transaction(async manager => {
            const note = await this.lock(manager, noteId, actorId);
            const now = await this.now(manager);
            await this.requireSession(manager, noteId, actorId, input.sessionId, now);
            if (note.contentVersion !== input.expectedVersion) throw new ConflictException('Versi catatan berubah.');
            const attachments = await manager.find(TicketNoteAttachment, { where: { noteId } });
            validateNoteDocument(input.document, attachments.map(file => file.id));
            const updated = { ...note, document: input.document, contentVersion: note.contentVersion + 1 };
            await manager.save(TicketNote, updated);
            return { contentVersion: updated.contentVersion };
        });
    }

    async release(noteId: string, actorId: string, sessionId: string): Promise<void> {
        await this.source.transaction(async manager => {
            const note = await this.lock(manager, noteId, actorId);
            const now = await this.now(manager);
            const session = await this.requireSession(manager, noteId, actorId, sessionId, now);
            await this.finalize(manager, note, session, now);
        });
    }

    async revisions(noteId: string, actorId: string) {
        await this.access.assertMember(noteId, actorId);
        return this.source.manager.find(TicketNoteRevision, { where: { noteId }, order: { closedAt: 'DESC' }, take: 50 });
    }

    async finalize(manager: EntityManager, note: TicketNote, session: TicketNoteEditSession, now: Date): Promise<void> {
        if (note.contentVersion > session.baseVersion) {
            await manager.save(TicketNoteRevision, manager.create(TicketNoteRevision, {
                noteId: note.id, sessionId: session.id, actorId: session.userId,
                document: note.document, contentVersion: note.contentVersion, closedAt: now,
            }));
        }
        await manager.save(TicketNoteEditSession, { ...session, closedAt: now, finalVersion: note.contentVersion });
    }

    private async lock(manager: EntityManager, noteId: string, actorId: string): Promise<TicketNote> {
        const { note } = await this.access.assertMember(noteId, actorId, manager, true);
        return note;
    }

    private active(manager: EntityManager, noteId: string) {
        return manager.findOne(TicketNoteEditSession, { where: { noteId, closedAt: IsNull() } });
    }

    private async requireSession(manager: EntityManager, noteId: string, actorId: string, id: string, now: Date) {
        const session = await this.active(manager, noteId);
        if (!session || session.id !== id || session.userId !== actorId || session.leaseUntil <= now) {
            throw new ConflictException('Sesi edit sudah berakhir. Muat ulang catatan sebelum mengedit.');
        }
        return session;
    }

    private async now(manager: EntityManager): Promise<Date> {
        const [row] = await manager.query('SELECT clock_timestamp() AS now');
        return new Date(row.now);
    }
}
