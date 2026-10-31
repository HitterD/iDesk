import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { resolveTicketViewerAccess } from '../services/ticket-oracle-access';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';

export interface NoteAccess {
    user: User;
    ticket: Ticket;
    note: TicketNote;
    member: TicketNoteMember;
}

@Injectable()
export class TicketNoteAccessService {
    constructor(private readonly dataSource: DataSource) {}

    async assertHandler(ticketId: string, actorId: string, manager = this.dataSource.manager, writable = false) {
        const user = await manager.findOne(User, { where: { id: actorId },
            ...(writable ? { lock: { mode: 'pessimistic_read' as const } } : {}) });
        const ticket = await manager.findOne(Ticket, { where: { id: ticketId },
            ...(writable ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
        if (!user?.isActive || !ticket) throw new NotFoundException();
        try {
            if (resolveTicketViewerAccess(ticket, user) !== 'handler') throw new NotFoundException();
        } catch {
            throw new NotFoundException();
        }
        return { user, ticket };
    }

    async lockUsers(manager: EntityManager, userIds: string[]): Promise<void> {
        for (const id of [...new Set(userIds)].sort()) {
            await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_read' } });
        }
    }

    async assertMember(
        noteId: string,
        actorId: string,
        manager: EntityManager = this.dataSource.manager,
        writable = false,
        ticketId?: string,
    ): Promise<NoteAccess> {
        let note = await manager.findOne(TicketNote, { where: { id: noteId } });
        if (!note || note.deletedAt || (ticketId && note.ticketId !== ticketId)) throw new NotFoundException();
        const { user, ticket } = await this.assertHandler(note.ticketId, actorId, manager, writable || Boolean(manager.queryRunner?.isTransactionActive));
        if (writable || manager.queryRunner?.isTransactionActive) {
            const locked = await manager.findOne(TicketNote, { where: { id: noteId }, lock: { mode: 'pessimistic_write' } });
            if (!locked || locked.deletedAt || locked.ticketId !== ticket.id) throw new NotFoundException();
            note = locked;
        }
        const member = await manager.findOne(TicketNoteMember, { where: { noteId, userId: actorId } });
        if (!member) throw new NotFoundException();
        if (writable) this.assertWritable(ticket);
        return { user, ticket, note, member };
    }

    assertWritable(ticket: Ticket): void {
        if ([TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
            throw new ConflictException('Catatan hanya dapat dibaca pada tiket yang ditutup atau dibatalkan.');
        }
    }
}
