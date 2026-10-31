import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNoteNotificationService } from './ticket-note-notification.service';
import { Optional } from '@nestjs/common';
import { AuditLog, AuditAction } from '../../audit/entities/audit-log.entity';

const MAX_NOTE_MEMBERS = 50;

@Injectable()
export class TicketNoteCommandService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService,
        @Optional() private readonly notifications?: TicketNoteNotificationService) {}

    async create(ticketId: string, actorId: string, input: { title?: string; memberIds: string[] }): Promise<TicketNote> {
        return this.source.transaction(async manager => {
            await this.access.lockUsers(manager, [actorId, ...input.memberIds]);
            const { ticket } = await this.access.assertHandler(ticketId, actorId, manager, true);
            this.access.assertWritable(ticket);
            const memberIds = [...new Set([actorId, ...input.memberIds])];
            await this.validateMembers(manager, ticketId, memberIds);
            const note = manager.create(TicketNote, { ticketId, createdById: actorId,
                title: (input.title ?? '').trim(), document: { type: 'doc', content: [] },
                contentVersion: 0, eventSequence: 0, deletedAt: null });
            await manager.save(TicketNote, note);
            await this.insertMembers(manager, note, actorId, memberIds);
            await this.notifications?.enqueue(manager, note, actorId, 'INVITE', [], memberIds);
            await this.audit(manager, note.id, actorId, AuditAction.TICKET_NOTE_CREATE);
            return note;
        });
    }

    async addMembers(noteId: string, actorId: string, userIds: string[]): Promise<void> {
        await this.source.transaction(async manager => {
            await this.access.lockUsers(manager, [actorId, ...userIds]);
            const { note } = await this.access.assertMember(noteId, actorId, manager, true);
            const selected = [...new Set(userIds)];
            await this.validateMembers(manager, note.ticketId, selected);
            const existing = await manager.find(TicketNoteMember, { where: { noteId } });
            const added = selected.filter(id => !existing.some(member => member.userId === id));
            if (existing.length + added.length > MAX_NOTE_MEMBERS) throw new BadRequestException('Terlalu banyak anggota.');
            await this.insertMembers(manager, note, actorId, added);
            await this.notifications?.enqueue(manager, note, actorId, 'INVITE', [], added);
            await this.audit(manager, noteId, actorId, AuditAction.TICKET_NOTE_MEMBER_ADD, { userIds: added });
        });
    }

    async removeMember(noteId: string, actorId: string, userId: string): Promise<void> {
        await this.source.transaction(async manager => {
            const { note } = await this.access.assertMember(noteId, actorId, manager, true);
            this.assertCreator(note, actorId);
            if (userId === note.createdById) throw new BadRequestException('Pembuat tidak dapat dikeluarkan.');
            await manager.delete(TicketNoteMember, { noteId, userId });
            await this.audit(manager, noteId, actorId, AuditAction.TICKET_NOTE_MEMBER_REMOVE, { userId });
        });
    }

    async softDelete(noteId: string, actorId: string): Promise<void> {
        await this.source.transaction(async manager => {
            const { note } = await this.access.assertMember(noteId, actorId, manager, true);
            this.assertCreator(note, actorId);
            await manager.save(TicketNote, { ...note, deletedAt: new Date() });
            await this.audit(manager, noteId, actorId, AuditAction.TICKET_NOTE_DELETE);
        });
    }

    private async audit(manager: EntityManager, noteId: string, actorId: string, action: AuditAction, metadata = {}): Promise<void> {
        await manager.save(AuditLog, manager.create(AuditLog, { userId: actorId, action,
            entityType: 'TICKET_NOTE', entityId: noteId, newValue: metadata }));
    }

    private assertCreator(note: TicketNote, actorId: string): void {
        if (note.createdById !== actorId) throw new ForbiddenException('Hanya pembuat yang dapat melakukan tindakan ini.');
    }

    private async validateMembers(manager: EntityManager, ticketId: string, userIds: string[]): Promise<void> {
        if (userIds.length > MAX_NOTE_MEMBERS) throw new BadRequestException('Terlalu banyak anggota.');
        for (const id of userIds) await this.access.assertHandler(ticketId, id, manager);
    }

    private async insertMembers(manager: EntityManager, note: TicketNote, actorId: string, userIds: string[]): Promise<void> {
        for (const userId of userIds) {
            const member = manager.create(TicketNoteMember, { noteId: note.id, userId,
                addedById: actorId, lastReadSequence: note.eventSequence });
            await manager.save(TicketNoteMember, member);
        }
    }
}
