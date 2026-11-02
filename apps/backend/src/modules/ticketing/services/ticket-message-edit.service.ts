import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketMessageEdit } from '../entities/ticket-message-edit.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { NotificationService } from '../../notifications/notification.service';
import { TicketMessagePinService } from './ticket-message-pin.service';
import { resolveTicketViewerAccess } from './ticket-oracle-access';
import { isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { presentInThread, withDeletedQuote } from '../utils/message-presenter.util';

/** How long after sending the sender may still edit a message (WhatsApp-style). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

const ALREADY_DELETED = 'Pesan sudah dihapus';

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
    private readonly logger = new Logger(TicketMessageEditService.name);

    constructor(
        @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationService: NotificationService,
        @Inject(forwardRef(() => TicketMessagePinService)) private readonly pinService: TicketMessagePinService,
    ) { }

    async editMessage(ticketId: string, messageId: string, viewer: MessageEditor, content: string) {
        const { message } = await this.loadChangeable(ticketId, messageId, viewer);
        if (message.senderId !== viewer.id) throw new ForbiddenException('Anda tidak bisa mengubah pesan ini');
        if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
            throw new BadRequestException('Batas waktu edit 15 menit sudah lewat');
        }
        const next = content.trim();
        if (!next) throw new BadRequestException('Pesan tidak boleh kosong');
        if (next === message.content.trim()) return this.present(message);

        const updated = await this.dataSource.transaction(async (manager) => {
            // Written only if nobody deleted or edited it since it was read: a stale save must not
            // bring a deleted message back or lose another edit's text from the audit trail.
            const { affected } = await manager.update(
                TicketMessage,
                { id: message.id, deletedAt: IsNull(), content: message.content },
                { content: next, editedAt: new Date() },
            );
            if (!affected) throw new ConflictException('Pesan sudah berubah, muat ulang lalu coba lagi');
            await manager.save(TicketMessageEdit, manager.create(TicketMessageEdit, {
                messageId: message.id, previousContent: message.content, editedById: viewer.id,
            }));
            return manager.findOne(TicketMessage, { where: { id: message.id }, relations: ['sender', 'reactions', 'reactions.user'] });
        });
        return this.broadcast(ticketId, updated ?? message);
    }

    async deleteMessage(ticketId: string, messageId: string, viewer: MessageEditor) {
        const { message, ticket } = await this.loadChangeable(ticketId, messageId, viewer);
        if (message.senderId !== viewer.id && viewer.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Anda tidak bisa mengubah pesan ini');
        }
        const updated = await this.dataSource.transaction(async (manager) => {
            const { affected } = await manager.update(
                TicketMessage,
                { id: message.id, deletedAt: IsNull() },
                { deletedAt: new Date(), deletedById: viewer.id },
            );
            if (!affected) throw new BadRequestException(ALREADY_DELETED);
            const replies = await this.forgetQuotesOf(manager, message);
            const deleted = await manager.findOne(TicketMessage, { where: { id: message.id }, relations: ['sender'] });
            return { deleted, replies };
        });
        await this.redactNotifications(message, ticket);
        for (const reply of updated.replies) await this.redactNotifications(reply, ticket);
        if (message.pinnedAt) await this.releasePin(ticketId, message.id);
        for (const reply of updated.replies) await this.broadcast(ticketId, reply);
        return this.broadcast(ticketId, updated.deleted ?? message);
    }

    /** The message, once the viewer may see the ticket and the message is a live public chat message. */
    private async loadChangeable(ticketId: string, messageId: string, viewer: MessageEditor) {
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
        if (message.deletedAt) throw new BadRequestException(ALREADY_DELETED);
        return { message, ticket };
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

    /**
     * Replies carry the deleted text in their own quote line (`↩ Name: snippet`). Rewriting it in
     * the stored text keeps every reader that does not go through the presenter (iPop, e-mail,
     * push and webhook previews, notifications) from showing it.
     */
    private async forgetQuotesOf(manager: EntityManager, message: TicketMessage): Promise<TicketMessage[]> {
        const replies = await manager.find(TicketMessage, { where: { replyToId: message.id, deletedAt: IsNull() }, relations: ['sender'] });
        const senderName = message.sender?.fullName ?? '';
        const rewritten: TicketMessage[] = [];
        for (const reply of replies) {
            const content = withDeletedQuote(reply.content, senderName);
            if (content === reply.content) continue;
            await manager.update(TicketMessage, { id: reply.id }, { content });
            rewritten.push({ ...reply, content } as TicketMessage);
        }
        return rewritten;
    }

    /** The delete has happened; a failed pin release is logged rather than reported as a failed delete. */
    private async releasePin(ticketId: string, messageId: string): Promise<void> {
        try {
            await this.pinService.releaseDeleted(ticketId, messageId);
        } catch (error) {
            this.logger.error(`Could not release the pin of deleted message ${messageId}`, error as Error);
        }
    }

    /** The deleted text also sits in stored "new reply" notifications; replace it there too. */
    private async redactNotifications(message: TicketMessage, ticket: Ticket): Promise<void> {
        try {
            await this.notificationService.redactMessageSnippet({
                messageId: message.id,
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                senderName: message.sender?.fullName ?? '',
                sentAt: new Date(message.createdAt),
            });
        } catch (error) {
            // The delete itself stands; a missed redaction is logged for follow-up, not hidden.
            this.logger.error(`Could not redact notifications for deleted message ${message.id}`, error as Error);
        }
    }

    /** What leaves the server: blanked if deleted, linked to its original, and only public sender fields. */
    private async present(message: TicketMessage) {
        const original = message.replyToId
            ? await this.messageRepo.findOne({ where: { id: message.replyToId, ticketId: message.ticketId }, relations: ['sender'] })
            : null;
        const sender = message.sender
            ? { id: message.sender.id, fullName: message.sender.fullName, role: message.sender.role }
            : undefined;
        return { ...presentInThread(message, original), sender };
    }

    private async broadcast(ticketId: string, message: TicketMessage) {
        const presented = await this.present(message);
        this.eventsGateway.notifyMessageUpdated(ticketId, presented);
        return presented;
    }
}
