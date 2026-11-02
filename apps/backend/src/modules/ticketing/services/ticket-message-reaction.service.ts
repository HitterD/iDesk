import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketMessageReaction } from '../entities/ticket-message-reaction.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { resolveTicketViewerAccess } from './ticket-oracle-access';
import { isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { ReactionSummary, summarizeReactions } from '../utils/message-presenter.util';
import type { MessageEditor } from './ticket-message-edit.service';

/** The reactions the chat offers (same set and order as the picker). */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '✅', '👀'] as const;

/**
 * Emoji reactions on ticket chat messages: one per person per message (reacting again replaces it),
 * visible to everyone who can see the message and sent live to the ticket room.
 */
@Injectable()
export class TicketMessageReactionService {
    constructor(
        @InjectRepository(TicketMessageReaction) private readonly reactionRepo: Repository<TicketMessageReaction>,
        @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
    ) { }

    async react(ticketId: string, messageId: string, viewer: MessageEditor, emoji: string): Promise<ReactionSummary[]> {
        if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) throw new BadRequestException('Reaksi tidak dikenal');
        const message = await this.loadReactable(ticketId, messageId, viewer);
        // One statement on the (messageId, userId) unique key: reacting again replaces the emoji, and a
        // double click cannot collide with itself.
        await this.dataSource.transaction((manager) =>
            manager.upsert(TicketMessageReaction, { messageId, userId: viewer.id, emoji }, ['messageId', 'userId']));
        return this.broadcast(ticketId, message);
    }

    async unreact(ticketId: string, messageId: string, viewer: MessageEditor): Promise<ReactionSummary[]> {
        const message = await this.loadReactable(ticketId, messageId, viewer);
        await this.dataSource.transaction((manager) => manager.delete(TicketMessageReaction, { messageId, userId: viewer.id }));
        return this.broadcast(ticketId, message);
    }

    private async broadcast(ticketId: string, message: TicketMessage): Promise<ReactionSummary[]> {
        const rows = await this.reactionRepo.find({ where: { messageId: message.id }, relations: ['user'], order: { createdAt: 'ASC' } });
        const reactions = summarizeReactions(rows);
        this.eventsGateway.notifyReactionsChanged(ticketId, message.id, Boolean(message.isInternal), reactions);
        return reactions;
    }

    private async loadReactable(ticketId: string, messageId: string, viewer: MessageEditor): Promise<TicketMessage> {
        const message = await this.messageRepo.findOne({ where: { id: messageId } });
        if (!message || message.ticketId !== ticketId) throw new NotFoundException('Pesan tidak ditemukan');
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!ticket) throw new NotFoundException('Pesan tidak ditemukan');
        if (!this.canView(ticket, viewer)) throw new ForbiddenException('Anda tidak bisa memberi reaksi pada pesan ini');
        if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException(TICKET_CLOSED_MESSAGE);
        // Archived internal notes are read-only (Q19); system lines and deleted messages take no reactions.
        if (message.isSystemMessage || message.deletedAt || message.isInternal) {
            throw new BadRequestException('Pesan ini tidak bisa diberi reaksi');
        }
        return message;
    }

    private canView(ticket: Ticket, viewer: MessageEditor): boolean {
        if (viewer.role === UserRole.USER) return isTicketRequesterSide(viewer.id, ticket);
        try {
            return Boolean(resolveTicketViewerAccess(ticket, viewer));
        } catch {
            return false;
        }
    }
}
