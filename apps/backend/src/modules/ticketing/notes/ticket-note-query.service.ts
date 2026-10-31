import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteMessage } from './entities/ticket-note-message.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { resolveTicketViewerAccess } from '../services/ticket-oracle-access';

export interface NoteMemberView { id: string; fullName: string; avatarUrl: string }

@Injectable()
export class TicketNoteQueryService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService) {}

    async list(ticketId: string, actorId: string) {
        await this.access.assertHandler(ticketId, actorId);
        const members = await this.source.manager.find(TicketNoteMember, { where: { userId: actorId } });
        if (!members.length) return [];
        const notes = await this.source.manager.find(TicketNote, {
            where: { id: In(members.map(member => member.noteId)), ticketId, deletedAt: IsNull() },
            order: { updatedAt: 'DESC' }, take: 100,
        });
        const result: (Omit<TicketNote, 'document'> & { hasUnread: boolean; hasMention: boolean; members: NoteMemberView[] })[] = [];
        for (const note of notes) {
            const membership = members.find(member => member.noteId === note.id);
            if (!membership || note.ticketId !== ticketId || note.deletedAt) continue;
            try {
                await this.access.assertMember(note.id, actorId, undefined, false, ticketId);
                const flags = await this.unread(note.id, actorId, membership.lastReadSequence);
                const { document: _document, ...summary } = note;
                result.push({ ...summary, ...flags, members: await this.members(note.id) });
            } catch (error) {
                if (!(error instanceof NotFoundException)) throw error;
            }
        }
        return result;
    }

    async detail(noteId: string, actorId: string, ticketId?: string) {
        const { note, ticket, member } = await this.access.assertMember(noteId, actorId, undefined, false, ticketId);
        return { ...note, ticketStatus: ticket.status, lastReadSequence: member.lastReadSequence,
            members: await this.members(noteId),
            ...await this.unread(noteId, actorId, member.lastReadSequence) };
    }

    private async members(noteId: string): Promise<NoteMemberView[]> {
        const memberships = await this.source.manager.find(TicketNoteMember, { where: { noteId } });
        const users = await this.source.manager.find(User, { where: { id: In(memberships.map(row => row.userId)) } });
        return users.map(user => ({ id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }));
    }

    async candidates(ticketId: string, actorId: string, search = '') {
        const { ticket } = await this.access.assertHandler(ticketId, actorId);
        const users = await this.source.manager.find(User, { where: { isActive: true }, order: { fullName: 'ASC' } });
        const result: { id: string; fullName: string; role: string; avatarUrl: string }[] = [];
        for (const user of users) {
            if (search && !user.fullName.toLowerCase().includes(search.toLowerCase())) continue;
            try {
                if (resolveTicketViewerAccess(ticket, user) !== 'handler') continue;
                result.push({ id: user.id, fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl });
            } catch (error) {
                if (!(error instanceof NotFoundException) && !(error instanceof ForbiddenException)) throw error;
            }
        }
        return result;
    }

    async unread(noteId: string, actorId: string, through: number) {
        const messages = await this.source.manager.find(TicketNoteMessage, {
            where: { noteId, sequence: MoreThan(through) }, select: ['authorId', 'mentionedUserIds'],
        });
        const others = messages.filter(message => message.authorId !== actorId);
        return { hasUnread: others.length > 0, hasMention: others.some(message => message.mentionedUserIds.includes(actorId)) };
    }
}
