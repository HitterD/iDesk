import { Injectable, Logger } from '@nestjs/common';
import {
    INotificationChannel,
    ChannelDeliveryPayload,
    DeliveryResult,
} from '../interfaces/notification-channel.interface';
import { DeliveryChannel } from '../entities/notification-log.entity';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';

@Injectable()
export class InAppChannelService implements INotificationChannel {
    private readonly logger = new Logger(InAppChannelService.name);
    readonly channelType = DeliveryChannel.IN_APP;

    constructor(private readonly eventsGateway: EventsGateway) {}

    async send(payload: ChannelDeliveryPayload): Promise<DeliveryResult> {
        const timestamp = new Date();

        try {
            // Emit to user-specific channel
            this.eventsGateway.server.emit(`notification:${payload.recipient}`, {
                id: payload.notificationId,
                title: payload.title,
                message: payload.body,
                ticketId: payload.data?.ticketId,
                link: payload.data?.link,
                type: payload.data?.type,
                priority: payload.priority,
                createdAt: timestamp,
            });

            // Also emit to general notification channel
            this.eventsGateway.server.emit('notification:new', {
                userId: payload.recipient,
                notificationId: payload.notificationId,
            });

            this.logger.debug(`In-app notification sent to user ${payload.recipient}`);

            return {
                success: true,
                channel: this.channelType,
                messageId: payload.notificationId,
                timestamp,
            };
        } catch (error) {
            this.logger.error(`Failed to send in-app notification to ${payload.recipient}:`, error);

            return {
                success: false,
                channel: this.channelType,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp,
            };
        }
    }

    async validateRecipient(recipient: string): Promise<boolean> {
        // In-app notifications are always valid if user ID exists
        return recipient !== undefined && recipient !== null && recipient.length > 0;
    }

    isAvailable(): boolean {
        return this.eventsGateway !== null;
    }
}
