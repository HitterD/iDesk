import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketMessageEdit } from '../entities/ticket-message-edit.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { resolveTicketViewerAccess } from './ticket-oracle-access';
import { isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { presentMessage } from '../utils/message-presenter.util';

/** How long after sending the sender may still edit a message (WhatsApp-style). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export interface MessageEditor {
    id: string;
    role: UserRole | string;
    siteId: string | null;
}

/**
 * Edit and delete of ticket chat messages. Deletes are soft and for everyone; the old text of an
 * edit is kept for audit. Neither is a new reply: no push, no mention notifications, no unread marker.
 */
@Injectable()
export class TicketMessageEditService {
    constructor(
        @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
    ) { }

    async editMessage(ticketId: string, messageId: string, viewer: MessageEditor, content: string) {
        const message = await this.loadChangeable(ticketId, messageId, viewer);
        if (message.senderId !== viewer.id) throw new ForbiddenException('Anda tidak bisa mengubah pesan ini');
        if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
            throw new BadRequestException('Batas waktu edit 15 menit sudah lewat');
        }
        const next = content.trim();
        if (next === message.content.trim()) return presentMessage(message);

        const updated = await this.dataSource.transaction(async (manager) => {
            await manager.save(TicketMessageEdit, manager.create(TicketMessageEdit, {
                messageId: message.id, previousContent: message.content, editedById: viewer.id,
            }));
            return manager.save(TicketMessage, { ...message, content: next, editedAt: new Date() });
        });
        return this.broadcast(ticketId, updated);
    }

    async deleteMessage(ticketId: string, messageId: string, viewer: MessageEditor) {
        const message = await this.loadChangeable(ticketId, messageId, viewer);
        if (message.senderId !== viewer.id && viewer.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Anda tidak bisa mengubah pesan ini');
        }
        const updated = await this.dataSource.transaction((manager) =>
            manager.save(TicketMessage, { ...message, deletedAt: new Date(), deletedById: viewer.id }));
        return this.broadcast(ticketId, updated);
    }

    /** The message, once the viewer may see the ticket and the message is a live public chat message. */
    private async loadChangeable(ticketId: string, messageId: string, viewer: MessageEditor): Promise<TicketMessage> {
        const message = await this.messageRepo.findOne({ where: { id: messageId }, relations: ['sender'] });
        if (!message || message.ticketId !== ticketId) throw new NotFoundException('Pesan tidak ditemukan');
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!ticket) throw new NotFoundException('Pesan tidak ditemukan');
        if (!this.canView(ticket, viewer)) throw new ForbiddenException('Anda tidak bisa mengubah pesan ini');

        if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException(TICKET_CLOSED_MESSAGE);
        // Internal notes moved to the private notes drawer; the old ones in chat are a read-only archive.
        if (message.isSystemMessage || message.source === 'EMAIL' || message.isInternal) {
            throw new BadRequestException('Pesan ini tidak bisa diubah');
        }
        if (message.deletedAt) throw new BadRequestException('Pesan sudah dihapus');
        return message;
    }

    private canView(ticket: Ticket, viewer: MessageEditor): boolean {
        // A USER must be on the ticket: the shared resolver lets any same-site USER through as 'requester'.
        if (viewer.role === UserRole.USER) return isTicketRequesterSide(viewer.id, ticket);
        try {
            return Boolean(resolveTicketViewerAccess(ticket, viewer));
        } catch {
            return false;
        }
    }

    private broadcast(ticketId: string, message: TicketMessage) {
        const sender = message.sender
            ? { id: message.sender.id, fullName: message.sender.fullName, role: message.sender.role }
            : undefined;
        const presented = { ...presentMessage(message), sender };
        this.eventsGateway.notifyMessageUpdated(ticketId, presented);
        return presented;
    }
}
