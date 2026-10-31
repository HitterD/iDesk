import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMessage } from './entities/ticket-note-message.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteAttachment } from './entities/ticket-note-attachment.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNoteNotificationService } from './ticket-note-notification.service';
import { Optional } from '@nestjs/common';
import { AuditLog, AuditAction } from '../../audit/entities/audit-log.entity';

export interface PostNoteMessage {
    content: string;
    clientRequestId: string;
    mentionedUserIds: string[];
    attachmentIds: string[];
}

@Injectable()
export class TicketNoteDiscussionService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService,
        @Optional() private readonly notifications?: TicketNoteNotificationService) {}

    async post(noteId: string, actorId: string, input: PostNoteMessage): Promise<TicketNoteMessage> {
        return this.source.transaction(async manager => {
            await this.access.lockUsers(manager, [actorId, ...input.mentionedUserIds]);
            const { note } = await this.access.assertMember(noteId, actorId, manager, true);
            const existing = await manager.findOne(TicketNoteMessage, {
                where: { noteId, authorId: actorId, clientRequestId: input.clientRequestId },
            });
            if (existing) return existing;
            if (!input.content.trim() && !input.attachmentIds.length) throw new BadRequestException('Pesan tidak boleh kosong.');
            await this.validateReferences(manager, note, actorId, input);
            const sequence = note.eventSequence + 1;
            const message = manager.create(TicketNoteMessage, { ...input, content: input.content.trim(),
                mentionedUserIds: [...new Set(input.mentionedUserIds)], noteId, authorId: actorId, sequence });
            const updated = { ...note, eventSequence: sequence };
            await manager.save(TicketNote, updated);
            const saved = await manager.save(TicketNoteMessage, message);
            await this.notifications?.enqueue(manager, updated, actorId, 'MESSAGE', input.mentionedUserIds);
            return saved;
        });
    }

    async messages(noteId: string, actorId: string, before?: number) {
        await this.access.assertMember(noteId, actorId);
        const query = this.source.manager.getRepository(TicketNoteMessage).createQueryBuilder('message')
            .where('message."noteId" = :noteId', { noteId });
        if (before) query.andWhere('message.sequence < :before', { before });
        const messages = await query.orderBy('message.sequence', 'DESC').take(50).getMany();
        return { messages: messages.reverse(), throughSequence: messages.length ? Math.max(...messages.map(row => row.sequence)) : 0 };
    }

    async markRead(noteId: string, actorId: string, throughSequence: number): Promise<void> {
        await this.source.transaction(async manager => {
            const { note, member } = await this.access.assertMember(noteId, actorId, manager);
            if (!Number.isSafeInteger(throughSequence) || throughSequence < 0 || throughSequence > note.eventSequence) {
                throw new BadRequestException('Penanda baca tidak valid.');
            }
            await manager.save(TicketNoteMember, { ...member,
                lastReadSequence: Math.max(member.lastReadSequence, throughSequence) });
            await manager.query(`UPDATE notifications SET "isRead" = true WHERE "userId" = $1
                AND type = 'TICKET_NOTE' AND "referenceId" = $2::text AND id IN
                (SELECT "notificationId" FROM ticket_note_deliveries WHERE "noteId" = $2::uuid AND "recipientId" = $1::uuid AND sequence <= $3)`,
                [actorId, noteId, throughSequence]);
        });
    }

    async solution(noteId: string, actorId: string, messageId: string | null): Promise<void> {
        await this.source.transaction(async manager => {
            const { note } = await this.access.assertMember(noteId, actorId, manager, true);
            if (messageId && !await manager.findOne(TicketNoteMessage, { where: { id: messageId, noteId } })) {
                throw new NotFoundException();
            }
            await manager.save(TicketNote, { ...note, selectedSolutionMessageId: messageId,
                selectedById: actorId, selectedAt: new Date() });
            await manager.save(AuditLog, manager.create(AuditLog, { userId: actorId,
                action: AuditAction.TICKET_NOTE_SOLUTION, entityType: 'TICKET_NOTE', entityId: noteId,
                newValue: { messageId, selectedAt: new Date().toISOString() } }));
            if (messageId) await this.notifications?.enqueue(manager, note, actorId, 'SOLUTION');
        });
    }

    private async validateReferences(manager: EntityManager, note: TicketNote, actorId: string, input: PostNoteMessage): Promise<void> {
        const members = await manager.find(TicketNoteMember, { where: { noteId: note.id } });
        for (const id of input.mentionedUserIds) {
            if (!members.some(member => member.userId === id)) throw new BadRequestException('Mention harus anggota catatan.');
            await this.access.assertHandler(note.ticketId, id, manager);
        }
        const files = await manager.find(TicketNoteAttachment, { where: { noteId: note.id } });
        if (input.attachmentIds.some(id => !files.some(file => file.id === id))) {
            throw new BadRequestException('Lampiran bukan milik catatan ini.');
        }
    }
}
