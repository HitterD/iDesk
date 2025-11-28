import { NotificationType } from '../entities/notification.entity';
import { DeliveryChannel } from '../entities/notification-log.entity';

/**
 * Payload for creating a notification
 */
export interface NotificationPayload {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    ticketId?: string;
    link?: string;
    data?: Record<string, unknown>;
    channels?: DeliveryChannel[];
    priority?: NotificationPriority;
}

export enum NotificationPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
}

/**
 * Payload for channel-specific delivery
 */
export interface ChannelDeliveryPayload {
    notificationId: string;
    recipient: string;
    title: string;
    body: string;
    htmlBody?: string;
    data?: Record<string, unknown>;
    priority?: NotificationPriority;
}

/**
 * Result from channel delivery attempt
 */
export interface DeliveryResult {
    success: boolean;
    channel: DeliveryChannel;
    messageId?: string;
    error?: string;
    timestamp: Date;
}

/**
 * Interface that all notification channels must implement
 */
export interface INotificationChannel {
    readonly channelType: DeliveryChannel;

    /**
     * Send a notification through this channel
     */
    send(payload: ChannelDeliveryPayload): Promise<DeliveryResult>;

    /**
     * Check if a recipient can receive notifications through this channel
     */
    validateRecipient(recipient: string): Promise<boolean>;

    /**
     * Check if the channel is currently available/configured
     */
    isAvailable(): boolean;
}

/**
 * Notification with resolved preferences for routing
 */
export interface NotificationWithRouting {
    notification: {
        id: string;
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        ticketId?: string;
        link?: string;
    };
    channels: DeliveryChannel[];
    recipients: Record<DeliveryChannel, string>;
    priority: NotificationPriority;
}

/**
 * Digest item for batched notifications
 */
export interface DigestItem {
    notificationId: string;
    type: NotificationType;
    title: string;
    message: string;
    ticketId?: string;
    createdAt: Date;
}

/**
 * Digest payload for sending batched notifications
 */
export interface DigestPayload {
    userId: string;
    recipient: string;
    channel: DeliveryChannel;
    items: DigestItem[];
    periodStart: Date;
    periodEnd: Date;
}
