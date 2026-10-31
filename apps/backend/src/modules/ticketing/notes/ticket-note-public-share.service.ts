import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { TicketNoteMessage } from './entities/ticket-note-message.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { AuditLog, AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class TicketNotePublicShareService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService,
        private readonly messaging: TicketMessagingService) {}

    async share(noteId: string, actorId: string, messageId: string, clientRequestId: string) {
        const { note, ticket } = await this.access.assertMember(noteId, actorId);
        this.access.assertWritable(ticket);
        if (note.selectedSolutionMessageId !== messageId) throw new BadRequestException('Pilih solusi sebelum mengirim balasan publik.');
        const message = await this.source.manager.findOne(TicketNoteMessage, { where: { id: messageId, noteId } });
        if (!message) throw new NotFoundException();
        if (!message.content.trim()) throw new BadRequestException('Solusi harus berisi teks untuk dipublikasikan.');
        const result = await this.messaging.replyToTicket(note.ticketId, actorId, message.content, [], [], false, [], clientRequestId, async manager => {
            const current = await this.access.assertMember(noteId, actorId, manager, true, note.ticketId);
            if (current.note.selectedSolutionMessageId !== messageId) throw new BadRequestException('Solusi telah berubah. Muat ulang catatan.');
        });
        await this.source.manager.save(AuditLog, this.source.manager.create(AuditLog, { userId: actorId,
            action: AuditAction.TICKET_NOTE_PUBLIC_SHARE, entityType: 'TICKET_NOTE', entityId: noteId,
            newValue: { messageId, publicMessageId: result.id } }));
        return result;
    }
}
