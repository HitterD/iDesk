import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { TicketParticipant } from '../entities/ticket-participant.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { PushChannelService } from '../../notifications/channels/push-channel.service';
import { NotificationPriority } from '../../notifications/interfaces/notification-channel.interface';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { forEachWithConcurrency } from '../../../shared/core/utils/concurrency.util';

/** Longest message excerpt shown in the toast body. */
const PREVIEW_LENGTH = 140;
const HTML_ENTITIES: Readonly<Record<string, string>> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** Toast body: the message as plain text, or a note when it only carries files. */
export function chatPushBody(content: string | null | undefined, attachmentCount: number): string {
    const text = (content ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_m, name: string) => HTML_ENTITIES[name])
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return attachmentCount > 1 ? `📎 Mengirim ${attachmentCount} lampiran` : '📎 Mengirim lampiran';
    return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
}

/** Where a click on the toast lands, per the recipient's portal (mirrors the frontend notificationRouter). */
export function ticketLinkFor(role: UserRole, ticketId: string): string {
    if (role === UserRole.USER) return `/client/tickets/${ticketId}`;
    if (role === UserRole.MANAGER) return '/manager/tickets';
    return `/tickets/${ticketId}`;
}

/** How many recipients of one reply are pushed at the same time; a busy ticket no longer opens them all at once. */
export const CHAT_PUSH_CONCURRENCY = 5;

/**
 * Web Push (OS toast) for every chat message, iPop-style: one toast per ticket that
 * the next message replaces. Goes to the requester side, the assigned agent and the
 * participants, never to the sender or to someone who has the ticket open. Internal
 * notes reach staff only; unassigned tickets notify no agent.
 */
@Injectable()
export class TicketChatPushListener {
    private readonly logger = new Logger(TicketChatPushListener.name);

    constructor(
        private readonly push: PushChannelService,
        private readonly gateway: EventsGateway,
        @InjectRepository(TicketParticipant)
        private readonly participants: Repository<TicketParticipant>,
        @InjectRepository(User)
        private readonly users: Repository<User>,
    ) { }

    @OnEvent('ticket.replied', { async: true })
    async onReplied(event: TicketRepliedEvent): Promise<void> {
        if (!this.push.isAvailable() || event.message?.isSystemMessage) return;
        try {
            const recipients = await this.resolveRecipients(event);
            const body = chatPushBody(event.message.content, event.message.attachments?.length ?? 0);
            await forEachWithConcurrency(recipients, CHAT_PUSH_CONCURRENCY, (user) =>
                this.notify(user, event, body).catch((error: Error) =>
                    this.logger.warn(`Chat push to ${user.id} failed: ${error.message}`)));
        } catch (error) {
            this.logger.error(`Chat push failed for ticket ${event.ticketId}: ${(error as Error).message}`);
        }
    }

    private async resolveRecipients(event: TicketRepliedEvent): Promise<Pick<User, 'id' | 'role'>[]> {
        const participantRows = await this.participants.find({ where: { ticketId: event.ticketId }, select: ['userId'] });
        const candidates = new Set<string>([
            event.ticketOwnerId,
            event.ticketCreatorId,
            event.ticketAssignedToId,
            ...participantRows.map((row) => row.userId),
        ].filter((id): id is string => Boolean(id) && id !== event.senderId));
        if (candidates.size === 0) return [];

        const users = await this.users.find({ where: { id: In([...candidates]) }, select: ['id', 'role'] });
        return event.message.isInternal ? users.filter((user) => user.role !== UserRole.USER) : users;
    }

    private async notify(user: Pick<User, 'id' | 'role'>, event: TicketRepliedEvent, body: string): Promise<void> {
        if (await this.gateway.isViewingTicket(user.id, event.ticketId)) return;
        const result = await this.push.send({
            notificationId: `${event.message.id}:${user.id}`,
            recipient: user.id,
            title: `[#${event.ticketNumber}] Pesan baru dari ${event.senderName}`,
            body,
            priority: NotificationPriority.HIGH,
            data: {
                link: ticketLinkFor(user.role, event.ticketId),
                ticketId: event.ticketId,
                type: 'TICKET_CHAT',
                tag: `ticket-chat:${event.ticketId}`,
            },
        });
        if (!result.success) this.logger.debug(`Chat push to ${user.id} not delivered: ${result.error}`);
    }
}
