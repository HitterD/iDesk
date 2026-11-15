import { Inject, Injectable, Logger, forwardRef, Optional } from '@nestjs/common';
import { PushChannelService } from './channels/push-channel.service';
import { NotificationPriority } from './interfaces/notification-channel.interface';
import { Notification, NotificationType } from './entities/notification.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { TicketNoteVisibilityService } from '../ticketing/notes/ticket-note-visibility.service';
import { CacheService } from '../../shared/core/cache/cache.service';

/**
 * Chat replies are pushed by TicketChatPushListener (one toast per ticket, internal notes to staff only,
 * participants included); pushing their stored notification as well would show every reply twice.
 */
const PUSHED_ELSEWHERE: ReadonlySet<string> = new Set([NotificationType.TICKET_REPLY]);
const NOTE_PUSH_COOLDOWN_SECONDS = 120;
const TICKET_LINK_RE = /\/tickets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export interface PushDispatchOptions {
    viewingTicketId?: string;
    pushTag?: string;
    bypassCooldown?: boolean;
}

type PushableNotification = Pick<Notification, 'id' | 'userId' | 'type' | 'title' | 'message' | 'link' | 'ticketId' | 'requiresAcknowledge'> & { referenceId?: string };

/**
 * Browser (Web Push) delivery for every stored notification, so users get an OS-level toast without the
 * desktop notifier app. Fire-and-forget: a push failure never fails the notification itself.
 */
@Injectable()
export class NotificationPushService {
    private readonly logger = new Logger(NotificationPushService.name);

    constructor(
        private readonly push: PushChannelService,
        @Inject(forwardRef(() => EventsGateway))
        private readonly gateway: EventsGateway,
        @Optional() private readonly noteVisibility?: TicketNoteVisibilityService,
        @Optional() private readonly cache?: CacheService,
    ) {}

    dispatch(notification: PushableNotification, options?: PushDispatchOptions): void {
        this.send(notification, options).catch((error: Error) =>
            this.logger.warn(`Push for notification ${notification.id} failed: ${error.message}`));
    }

    private resolveTicketId(n: PushableNotification, viewingTicketId?: string): string | undefined {
        if (viewingTicketId) return viewingTicketId;
        if (n.ticketId) return n.ticketId;
        return n.link ? TICKET_LINK_RE.exec(n.link)?.[1] : undefined;
    }

    private async send(n: PushableNotification, options?: PushDispatchOptions): Promise<void> {
        if (!this.push.isAvailable() || PUSHED_ELSEWHERE.has(n.type)) return;
        if (n.type === NotificationType.TICKET_NOTE) {
            if (!this.noteVisibility || !(await this.noteVisibility.filter(n.userId, [n])).length) return;
            if (n.referenceId && (await this.gateway.isViewingNote?.(n.userId, n.referenceId))) return;
        }
        const ticketId = this.resolveTicketId(n, options?.viewingTicketId);
        // Someone looking at the ticket already sees the change live; an OS toast on top is noise.
        if (ticketId && (await this.gateway.isViewingTicket(n.userId, ticketId))) return;
        if (n.type === NotificationType.TICKET_NOTE && n.referenceId && typeof this.cache?.getAsync === 'function') {
            const cooldownKey = `push:note:${n.userId}:${n.referenceId}`;
            if (!options?.bypassCooldown && (await this.cache.getAsync(cooldownKey))) return;
            await this.cache.setAsync?.(cooldownKey, 1, NOTE_PUSH_COOLDOWN_SECONDS);
        }
        const tag = options?.pushTag || (n.type === NotificationType.TICKET_NOTE && n.referenceId ? `ticket-note:${n.referenceId}` : undefined);
        await this.push.send({
            notificationId: n.id,
            recipient: n.userId,
            title: n.title,
            body: n.message,
            priority: n.requiresAcknowledge ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
            data: { link: n.link || '/', type: n.type, ticketId: n.ticketId, notificationId: n.id, ...(tag ? { tag } : {}) },
        });
    }
}
