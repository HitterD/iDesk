import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationPreference, DigestFrequency } from './entities/notification-preference.entity';
import { NotificationLog, DeliveryChannel, DeliveryStatus } from './entities/notification-log.entity';
import {
    NotificationPayload,
    NotificationPriority,
    ChannelDeliveryPayload,
    DeliveryResult,
    INotificationChannel,
} from './interfaces/notification-channel.interface';
import { EmailChannelService } from './channels/email-channel.service';
import { TelegramChannelService } from './channels/telegram-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';
import { User } from '../users/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationCenterService implements OnModuleInit {
    private readonly logger = new Logger(NotificationCenterService.name);
    private channels: Map<DeliveryChannel, INotificationChannel> = new Map();

    // In-memory queue for notifications (use Bull/Redis in production)
    private notificationQueue: Array<{
        payload: NotificationPayload;
        channels: DeliveryChannel[];
        createdAt: Date;
    }> = [];

    // Digest buffer - collects notifications for digest delivery
    private digestBuffer: Map<string, Notification[]> = new Map();

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(NotificationPreference)
        private readonly preferenceRepo: Repository<NotificationPreference>,
        @InjectRepository(NotificationLog)
        private readonly logRepo: Repository<NotificationLog>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly emailChannel: EmailChannelService,
        private readonly telegramChannel: TelegramChannelService,
        private readonly inAppChannel: InAppChannelService,
    ) {}

    onModuleInit() {
        // Register available channels
        this.channels.set(DeliveryChannel.EMAIL, this.emailChannel);
        this.channels.set(DeliveryChannel.TELEGRAM, this.telegramChannel);
        this.channels.set(DeliveryChannel.IN_APP, this.inAppChannel);

        this.logger.log('NotificationCenterService initialized with channels: ' +
            Array.from(this.channels.keys()).join(', '));
    }

    // =====================
    // Main API
    // =====================

    /**
     * Send a notification through configured channels
     * Respects user preferences and handles routing
     */
    async send(payload: NotificationPayload): Promise<Notification> {
        // Get user preferences
        const preferences = await this.getOrCreatePreferences(payload.userId);
        
        // Check quiet hours
        if (this.isInQuietHours(preferences)) {
            this.logger.debug(`User ${payload.userId} is in quiet hours, buffering notification`);
            // Still create notification but mark for later delivery
        }

        // Create notification record
        const notification = await this.createNotification(payload);

        // Determine channels based on payload and preferences
        const channels = this.resolveChannels(payload, preferences);

        if (channels.length === 0) {
            this.logger.warn(`No channels available for user ${payload.userId}`);
            return notification;
        }

        // Check if digest mode is enabled
        if (preferences.digestEnabled && preferences.digestFrequency !== DigestFrequency.REALTIME) {
            await this.addToDigestBuffer(payload.userId, notification);
            // In-app notifications are always sent immediately
            if (channels.includes(DeliveryChannel.IN_APP)) {
                await this.deliverToChannel(notification, DeliveryChannel.IN_APP, payload.userId, preferences);
            }
        } else {
            // Deliver immediately to all channels
            await this.deliverToChannels(notification, channels, preferences);
        }

        return notification;
    }

    /**
     * Send notification to multiple users
     */
    async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        const promises = userIds.map(userId =>
            this.send({ ...payload, userId }).catch(err => {
                this.logger.error(`Failed to send notification to user ${userId}:`, err);
            })
        );
        await Promise.all(promises);
    }

    /**
     * Send notification to all users with a specific role
     */
    async sendToRole(role: string, payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        const users = await this.userRepo.find({ where: { role: role as any } });
        const userIds = users.map(u => u.id);
        await this.sendBulk(userIds, payload);
    }

    // =====================
    // Preferences Management
    // =====================

    async getPreferences(userId: string): Promise<NotificationPreference | null> {
        return this.preferenceRepo.findOne({ where: { userId } });
    }

    async getOrCreatePreferences(userId: string): Promise<NotificationPreference> {
        let prefs = await this.preferenceRepo.findOne({ where: { userId } });
        
        if (!prefs) {
            // Get user to populate defaults
            const user = await this.userRepo.findOne({ where: { id: userId } });
            
            prefs = this.preferenceRepo.create({
                userId,
                inAppEnabled: true,
                emailEnabled: true,
                emailAddress: user?.email,
                telegramEnabled: !!user?.telegramChatId,
                telegramChatId: user?.telegramChatId,
                pushEnabled: false,
                digestEnabled: false,
                digestFrequency: DigestFrequency.REALTIME,
                quietHoursEnabled: false,
                timezone: 'Asia/Jakarta',
            });
            
            await this.preferenceRepo.save(prefs);
        }

        return prefs;
    }

    async updatePreferences(
        userId: string,
        updates: Partial<NotificationPreference>
    ): Promise<NotificationPreference> {
        const prefs = await this.getOrCreatePreferences(userId);
        Object.assign(prefs, updates);
        return this.preferenceRepo.save(prefs);
    }

    async updateTypePreference(
        userId: string,
        notificationType: NotificationType,
        channelSettings: Record<string, boolean>
    ): Promise<NotificationPreference> {
        const prefs = await this.getOrCreatePreferences(userId);
        prefs.typeSettings = {
            ...prefs.typeSettings,
            [notificationType]: channelSettings,
        };
        return this.preferenceRepo.save(prefs);
    }

    // =====================
    // Channel Delivery
    // =====================

    private async deliverToChannels(
        notification: Notification,
        channels: DeliveryChannel[],
        preferences: NotificationPreference
    ): Promise<void> {
        const deliveryPromises = channels.map(channel =>
            this.deliverToChannel(notification, channel, notification.userId, preferences)
        );
        await Promise.all(deliveryPromises);
    }

    private async deliverToChannel(
        notification: Notification,
        channel: DeliveryChannel,
        userId: string,
        preferences: NotificationPreference
    ): Promise<DeliveryResult | null> {
        const channelService = this.channels.get(channel);
        
        if (!channelService || !channelService.isAvailable()) {
            this.logger.warn(`Channel ${channel} is not available`);
            return null;
        }

        const recipient = this.getRecipientForChannel(channel, preferences, userId);
        if (!recipient) {
            this.logger.warn(`No recipient for channel ${channel} for user ${userId}`);
            return null;
        }

        // Create log entry
        const log = await this.logRepo.save({
            notificationId: notification.id,
            channel,
            status: DeliveryStatus.PENDING,
            recipient,
        });

        // Prepare payload
        const deliveryPayload: ChannelDeliveryPayload = {
            notificationId: notification.id,
            recipient,
            title: notification.title,
            body: notification.message,
            data: {
                ticketId: notification.ticketId,
                link: notification.link,
                type: notification.type,
            },
        };

        // Send
        const result = await channelService.send(deliveryPayload);

        // Update log
        await this.logRepo.update(log.id, {
            status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
            externalMessageId: result.messageId,
            errorMessage: result.error,
            sentAt: result.success ? result.timestamp : undefined,
        });

        return result;
    }

    private getRecipientForChannel(
        channel: DeliveryChannel,
        preferences: NotificationPreference,
        userId: string
    ): string | null {
        switch (channel) {
            case DeliveryChannel.IN_APP:
                return userId;
            case DeliveryChannel.EMAIL:
                return preferences.emailAddress || null;
            case DeliveryChannel.TELEGRAM:
                return preferences.telegramChatId || null;
            case DeliveryChannel.PUSH:
                return preferences.pushTokens?.[0] || null;
            default:
                return null;
        }
    }

    // =====================
    // Channel Resolution
    // =====================

    private resolveChannels(
        payload: NotificationPayload,
        preferences: NotificationPreference
    ): DeliveryChannel[] {
        // Start with requested channels or default set
        const requestedChannels = payload.channels || [
            DeliveryChannel.IN_APP,
            DeliveryChannel.EMAIL,
        ];

        // Filter based on preferences
        return requestedChannels.filter(channel => {
            // Check global channel toggle
            if (!this.isChannelEnabled(channel, preferences)) {
                return false;
            }

            // Check type-specific settings
            const typeSettings = preferences.typeSettings?.[payload.type];
            if (typeSettings) {
                const channelKey = channel.toLowerCase();
                if (typeSettings[channelKey] === false) {
                    return false;
                }
            }

            // Check if recipient exists for this channel
            const recipient = this.getRecipientForChannel(channel, preferences, payload.userId);
            if (!recipient) {
                return false;
            }

            return true;
        });
    }

    private isChannelEnabled(channel: DeliveryChannel, preferences: NotificationPreference): boolean {
        switch (channel) {
            case DeliveryChannel.IN_APP:
                return preferences.inAppEnabled;
            case DeliveryChannel.EMAIL:
                return preferences.emailEnabled;
            case DeliveryChannel.TELEGRAM:
                return preferences.telegramEnabled;
            case DeliveryChannel.PUSH:
                return preferences.pushEnabled;
            default:
                return false;
        }
    }

    // =====================
    // Quiet Hours
    // =====================

    private isInQuietHours(preferences: NotificationPreference): boolean {
        if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return false;
        }

        const now = new Date();
        const timezone = preferences.timezone || 'UTC';
        
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            
            const currentTime = formatter.format(now);
            const [currentHour, currentMinute] = currentTime.split(':').map(Number);
            const currentMinutes = currentHour * 60 + currentMinute;

            const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
            const startMinutes = startHour * 60 + startMinute;

            const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
            const endMinutes = endHour * 60 + endMinute;

            // Handle overnight quiet hours (e.g., 22:00 - 07:00)
            if (startMinutes > endMinutes) {
                return currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }

            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        } catch (error) {
            this.logger.error('Error checking quiet hours:', error);
            return false;
        }
    }

    // =====================
    // Digest System
    // =====================

    private async addToDigestBuffer(userId: string, notification: Notification): Promise<void> {
        const buffer = this.digestBuffer.get(userId) || [];
        buffer.push(notification);
        this.digestBuffer.set(userId, buffer);
    }

    @Cron(CronExpression.EVERY_HOUR)
    async processHourlyDigests(): Promise<void> {
        await this.processDigests(DigestFrequency.HOURLY);
    }

    @Cron('0 9 * * *') // Every day at 9 AM
    async processDailyDigests(): Promise<void> {
        await this.processDigests(DigestFrequency.DAILY);
    }

    @Cron('0 9 * * 1') // Every Monday at 9 AM
    async processWeeklyDigests(): Promise<void> {
        await this.processDigests(DigestFrequency.WEEKLY);
    }

    private async processDigests(frequency: DigestFrequency): Promise<void> {
        this.logger.log(`Processing ${frequency} digests...`);

        // Get users with this digest frequency
        const preferences = await this.preferenceRepo.find({
            where: {
                digestEnabled: true,
                digestFrequency: frequency,
            },
        });

        for (const pref of preferences) {
            const buffer = this.digestBuffer.get(pref.userId);
            if (!buffer || buffer.length === 0) continue;

            try {
                await this.sendDigest(pref, buffer);
                this.digestBuffer.delete(pref.userId);
            } catch (error) {
                this.logger.error(`Failed to send digest to user ${pref.userId}:`, error);
            }
        }
    }

    private async sendDigest(
        preferences: NotificationPreference,
        notifications: Notification[]
    ): Promise<void> {
        const digestTitle = `You have ${notifications.length} notifications`;
        const digestBody = notifications
            .map(n => `• ${n.title}: ${n.message}`)
            .join('\n');

        // Send via email if enabled
        if (preferences.emailEnabled && preferences.emailAddress) {
            const emailChannel = this.channels.get(DeliveryChannel.EMAIL);
            if (emailChannel) {
                await emailChannel.send({
                    notificationId: `digest-${Date.now()}`,
                    recipient: preferences.emailAddress,
                    title: digestTitle,
                    body: digestBody,
                    data: { isDigest: true, count: notifications.length },
                });
            }
        }

        // Send via Telegram if enabled
        if (preferences.telegramEnabled && preferences.telegramChatId) {
            const telegramChannel = this.channels.get(DeliveryChannel.TELEGRAM);
            if (telegramChannel) {
                await telegramChannel.send({
                    notificationId: `digest-${Date.now()}`,
                    recipient: preferences.telegramChatId,
                    title: `📬 ${digestTitle}`,
                    body: digestBody,
                    data: { isDigest: true, count: notifications.length },
                });
            }
        }
    }

    // =====================
    // Notification CRUD
    // =====================

    private async createNotification(payload: NotificationPayload): Promise<Notification> {
        const notification = this.notificationRepo.create({
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            ticketId: payload.ticketId,
            link: payload.link,
            isRead: false,
        });
        return this.notificationRepo.save(notification);
    }

    async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
        const notification = await this.notificationRepo.findOne({
            where: { id: notificationId, userId },
        });
        if (!notification) return null;

        notification.isRead = true;
        return this.notificationRepo.save(notification);
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.notificationRepo.update(
            { userId, isRead: false },
            { isRead: true }
        );
    }

    async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
        return this.notificationRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    async getUnreadCount(userId: string): Promise<number> {
        return this.notificationRepo.count({
            where: { userId, isRead: false },
        });
    }

    async getDeliveryLogs(notificationId: string): Promise<NotificationLog[]> {
        return this.logRepo.find({
            where: { notificationId },
            order: { createdAt: 'DESC' },
        });
    }

    // =====================
    // Retry Failed Deliveries
    // =====================

    @Cron(CronExpression.EVERY_5_MINUTES)
    async retryFailedDeliveries(): Promise<void> {
        const failedLogs = await this.logRepo.find({
            where: {
                status: DeliveryStatus.FAILED,
                retryCount: LessThan(3),
            },
            relations: ['notification'],
            take: 50,
        });

        for (const log of failedLogs) {
            try {
                const channelService = this.channels.get(log.channel);
                if (!channelService) continue;

                const result = await channelService.send({
                    notificationId: log.notificationId,
                    recipient: log.recipient,
                    title: log.notification.title,
                    body: log.notification.message,
                    data: {
                        ticketId: log.notification.ticketId,
                        link: log.notification.link,
                    },
                });

                await this.logRepo.update(log.id, {
                    status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
                    retryCount: log.retryCount + 1,
                    externalMessageId: result.messageId,
                    errorMessage: result.error,
                    sentAt: result.success ? result.timestamp : undefined,
                });
            } catch (error) {
                await this.logRepo.update(log.id, {
                    retryCount: log.retryCount + 1,
                    errorMessage: error instanceof Error ? error.message : 'Retry failed',
                });
            }
        }
    }
}
