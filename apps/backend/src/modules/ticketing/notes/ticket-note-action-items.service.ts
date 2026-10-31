import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActionItemDto, ActionItemEntityType, ActionItemUrgency } from '../../notifications/dto/action-item.dto';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNoteQueryService } from './ticket-note-query.service';

@Injectable()
export class TicketNoteActionItemsService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService,
        private readonly queries: TicketNoteQueryService) {}

    async items(userId: string): Promise<ActionItemDto[]> {
        const memberships = await this.source.manager.find(TicketNoteMember, { where: { userId } });
        const result: ActionItemDto[] = [];
        for (const member of memberships) {
            try {
                const { note } = await this.access.assertMember(member.noteId, userId);
                const unread = await this.queries.unread(note.id, userId, member.lastReadSequence);
                if (!unread.hasUnread) continue;
                result.push({ id: `note:${note.id}`, entityType: ActionItemEntityType.TICKET_NOTE,
                    title: 'Diskusi catatan internal', description: unread.hasMention ? 'Anda disebut dalam diskusi.' : 'Ada diskusi yang belum dibaca.',
                    urgency: unread.hasMention ? ActionItemUrgency.HIGH : ActionItemUrgency.NORMAL,
                    entityId: note.id, link: `/tickets/${note.ticketId}?noteId=${note.id}`,
                    createdAt: note.updatedAt, isSnoozed: false });
            } catch (error) {
                if (!(error instanceof NotFoundException)) throw error;
            }
        }
        return result;
    }
}
