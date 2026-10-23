import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PushChannelService } from './channels/push-channel.service';
import { NotificationPriority } from './interfaces/notification-channel.interface';
import { Notification, NotificationType } from './entities/notification.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';

/**
 * Chat replies are pushed by TicketChatPushListener (one toast per ticket, internal notes to staff only,
 * participants included); pushing their stored notification as well would show every reply twice.
 */
const PUSHED_ELSEWHERE: ReadonlySet<string> = new Set([NotificationType.TICKET_REPLY]);

type PushableNotification = Pick<Notification, 'id' | 'userId' | 'type' | 'title' | 'message' | 'link' | 'ticketId' | 'requiresAcknowledge'>;

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
    ) {}

    dispatch(notification: PushableNotification): void {
        this.send(notification).catch((error: Error) =>
            this.logger.warn(`Push for notification ${notification.id} failed: ${error.message}`));
    }

    private async send(n: PushableNotification): Promise<void> {
        if (!this.push.isAvailable() || PUSHED_ELSEWHERE.has(n.type)) return;
        // Someone looking at the ticket already sees the change live; an OS toast on top is noise.
        if (n.ticketId && (await this.gateway.isViewingTicket(n.userId, n.ticketId))) return;
        await this.push.send({
            notificationId: n.id,
            recipient: n.userId,
            title: n.title,
            body: n.message,
            priority: n.requiresAcknowledge ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
            data: { link: n.link || '/', type: n.type, ticketId: n.ticketId, notificationId: n.id },
        });
    }
}
