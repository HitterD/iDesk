import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { resolveTicketViewerAccess } from './ticket-oracle-access';
import { isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { summarizeReply } from '../utils/message-presenter.util';
import type { MessageEditor } from './ticket-message-edit.service';

/** At most this many messages are pinned per ticket; pinning one more releases the oldest. */
export const MAX_PINS = 3;

/** One entry of the pinned bar. Never carries who pinned it by id (only the name). */
export interface PinnedMessageSummary {
    id: string;
    senderName: string;
    snippet: string;
    pinnedAt: Date;
    isInternal: boolean;
}

/**
 * Pinning chat messages to the bar above a ticket's conversation. Any participant may pin a live
 * public message; the pinner, an admin or the assigned agent may release it. Each change leaves a
 * short system message (without the pinned text) and refreshes everyone's bar.
 */
@Injectable()
export class TicketMessagePinService {
    constructor(
        @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
    ) { }

    async pin(ticketId: string, messageId: string, viewer: MessageEditor): Promise<PinnedMessageSummary[]> {
        const { message } = await this.loadPinnable(ticketId, messageId, viewer);
        if (message.pinnedAt) return this.listPins(ticketId);

        await this.dataSource.transaction(async (manager) => {
            const current = await this.pinnedIn(manager, ticketId);
            // Make room first: the oldest pins give way so at most MAX_PINS stay.
            for (const old of current.slice(0, Math.max(0, current.length - MAX_PINS + 1))) {
                await manager.update(TicketMessage, { id: old.id }, { pinnedAt: null, pinnedById: null });
            }
            await manager.update(TicketMessage, { id: message.id }, { pinnedAt: new Date(), pinnedById: viewer.id });
            await this.announce(manager, ticketId, viewer, 'menyematkan pesan');
        });
        return this.broadcast(ticketId);
    }

    async unpin(ticketId: string, messageId: string, viewer: MessageEditor): Promise<PinnedMessageSummary[]> {
        const { message, ticket } = await this.loadPinnable(ticketId, messageId, viewer, { allowUnpinnable: true });
        if (!message.pinnedAt) return this.listPins(ticketId);
        const mayRelease = message.pinnedById === viewer.id || viewer.role === UserRole.ADMIN || ticket.assignedToId === viewer.id;
        if (!mayRelease) throw new ForbiddenException('Hanya yang menyematkan, admin, atau agent yang ditugaskan yang bisa melepasnya');

        await this.dataSource.transaction(async (manager) => {
            await manager.update(TicketMessage, { id: message.id }, { pinnedAt: null, pinnedById: null });
            await this.announce(manager, ticketId, viewer, 'melepas sematan pesan');
        });
        return this.broadcast(ticketId);
    }

    /** Releases the pin of a message that was just deleted (no system message: the delete speaks for itself). */
    async releaseDeleted(ticketId: string, messageId: string): Promise<void> {
        await this.messageRepo.update({ id: messageId, pinnedAt: Not(IsNull()) }, { pinnedAt: null, pinnedById: null });
        await this.broadcast(ticketId);
    }

    /** The ticket's pins, oldest first. Internal ones are included; the gateway filters them per room. */
    async listPins(ticketId: string): Promise<PinnedMessageSummary[]> {
        const pinned = await this.messageRepo.find({
            where: { ticketId, pinnedAt: Not(IsNull()), deletedAt: IsNull() },
            relations: ['sender'],
            order: { pinnedAt: 'ASC' },
        });
        return pinned.map((m) => {
            const { senderName, snippet } = summarizeReply(m);
            return { id: m.id, senderName, snippet, pinnedAt: m.pinnedAt as Date, isInternal: Boolean(m.isInternal) };
        });
    }

    private async broadcast(ticketId: string): Promise<PinnedMessageSummary[]> {
        const pins = await this.listPins(ticketId);
        this.eventsGateway.notifyPinsChanged(ticketId, pins);
        return pins;
    }

    private pinnedIn(manager: EntityManager, ticketId: string): Promise<TicketMessage[]> {
        return manager.find(TicketMessage, {
            where: { ticketId, pinnedAt: Not(IsNull()) },
            order: { pinnedAt: 'ASC' },
        });
    }

    /** "Budi menyematkan pesan": a short system line, never the pinned text. */
    private async announce(manager: EntityManager, ticketId: string, viewer: MessageEditor, action: string): Promise<void> {
        const actor = await this.userRepo.findOne({ where: { id: viewer.id } });
        const name = actor?.fullName ?? 'Seseorang';
        const saved = await manager.save(TicketMessage, manager.create(TicketMessage, {
            ticketId, senderId: viewer.id, content: `${name} ${action}`, isSystemMessage: true, isInternal: false, source: 'WEB',
        }));
        this.eventsGateway.notifyNewMessage(ticketId, {
            ...saved, sender: { id: viewer.id, fullName: name, role: viewer.role },
        });
    }

    private async loadPinnable(ticketId: string, messageId: string, viewer: MessageEditor, opts: { allowUnpinnable?: boolean } = {}) {
        const message = await this.messageRepo.findOne({ where: { id: messageId }, relations: ['sender'] });
        if (!message || message.ticketId !== ticketId) throw new NotFoundException('Pesan tidak ditemukan');
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!ticket) throw new NotFoundException('Pesan tidak ditemukan');
        if (!this.canView(ticket, viewer)) throw new ForbiddenException('Anda tidak bisa menyematkan pesan ini');
        if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException(TICKET_CLOSED_MESSAGE);
        // Archived internal notes are read-only (Q19); a pin left on one before can still be released.
        const locked = message.isSystemMessage || message.deletedAt || message.isInternal;
        if (locked && !(opts.allowUnpinnable && message.pinnedAt)) {
            throw new BadRequestException('Pesan ini tidak bisa disematkan');
        }
        return { message, ticket };
    }

    private canView(ticket: Ticket, viewer: MessageEditor): boolean {
        // A USER must be on the ticket: the shared resolver checks it too, this keeps the intent explicit.
        if (viewer.role === UserRole.USER) return isTicketRequesterSide(viewer.id, ticket);
        try {
            return Boolean(resolveTicketViewerAccess(ticket, viewer));
        } catch {
            return false;
        }
    }
}
