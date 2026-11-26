import { Injectable, Logger, OnModuleInit, forwardRef, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, LessThan, MoreThan, EntityManager } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { NotificationPreference, DigestFrequency } from './entities/notification-preference.entity';
import { NotificationLog, DeliveryChannel, DeliveryStatus } from './entities/notification-log.entity';
import {
    NotificationPayload,
    ChannelDeliveryPayload,
    DeliveryResult,
    INotificationChannel,
} from './interfaces/notification-channel.interface';
import { EmailChannelService } from './channels/email-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';
import { PushChannelService } from './channels/push-channel.service';
import { NotificationPushService } from './notification-push.service';
import { getCategoryFromType } from './utils/category-mapper';
import { PermissionPreset } from '../permissions/entities/permission-preset.entity';
import { NotificationPreferenceGate, isInQuietHours } from './notification-preference-gate.service';
import { PageKey, getRoleDefaultPageAccess } from '../../shared/core/types/page-access.types';
import { User } from '../users/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../shared/core/cache/cache.service';
import { TicketNoteActionItemsService } from '../ticketing/notes/ticket-note-action-items.service';
import { TicketNoteVisibilityService } from '../ticketing/notes/ticket-note-visibility.service';
import { NOTIFICATIONS_READ_EVENT } from './notification-events';
import {
    DEFAULT_CATEGORY_SETTINGS,
    fetchActionItemData,
    mapQueriesToActionItems,
    processAndFilterActionItems,
    resolveSnoozedUntil,
} from './action-center-items.helper';

const GROUPED_INAPP_COOLDOWN_SECONDS = 120;

/** Channels used when a caller does not name any. */
const DEFAULT_CHANNELS: DeliveryChannel[] = [DeliveryChannel.IN_APP];

@Injectable()
export class NotificationCenterService implements OnModuleInit {
    private readonly logger = new Logger(NotificationCenterService.name);
    private channels: Map<DeliveryChannel, INotificationChannel> = new Map();

    // Digest buffer - collects notifications for digest delivery
    private digestBuffer: Map<string, Notification[]> = new Map();

    constructor(
        @InjectRepository(ActionItemSnooze)
        private readonly snoozeRepo: Repository<ActionItemSnooze>,
        @Inject(forwardRef(() => EventsGateway))
        private readonly eventsGateway: EventsGateway,
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(NotificationPreference)
        private readonly preferenceRepo: Repository<NotificationPreference>,
        @InjectRepository(NotificationLog)
        private readonly logRepo: Repository<NotificationLog>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly emailChannel: EmailChannelService,
        private readonly inAppChannel: InAppChannelService,
        private readonly pushChannel: PushChannelService,
        private readonly entityManager: EntityManager,
        private readonly cacheService: CacheService,
        @Optional() private readonly webPush?: NotificationPushService,
        @Optional() private readonly noteActions?: TicketNoteActionItemsService,
        @Optional() private readonly noteVisibility?: TicketNoteVisibilityService,
        @Optional() private readonly gate?: NotificationPreferenceGate,
    ) { }

    onModuleInit() {
        // Register available channels
        this.channels.set(DeliveryChannel.EMAIL, this.emailChannel);
        this.channels.set(DeliveryChannel.IN_APP, this.inAppChannel);
        this.channels.set(DeliveryChannel.PUSH, this.pushChannel);

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
    async send(payload: NotificationPayload): Promise<Notification | null> {
        if (payload.id) {
            const existing = await this.notificationRepo.findOne({ where: { id: payload.id, userId: payload.userId } });
            if (existing) return existing;
        }
        // Get user preferences
        const preferences = await this.getOrCreatePreferences(payload.userId);

        // Turned off in-app for this type: nothing is stored or shown.
        if (!this.allowsChannel(DeliveryChannel.IN_APP, payload.type, preferences)) return null;
        const quiet = isInQuietHours(preferences, new Date());

        // Create or group notification record
        const { notification, groupedExisting } = await this.resolveOrCreateNotification(payload);
        const suppressLiveAlert = await this.shouldThrottleGroupedAlert(payload, groupedExisting);

        // Browser push: the user's push switch (global and per type), held back during quiet hours or grouped cooldown.
        if (!quiet && !suppressLiveAlert && this.allowsChannel(DeliveryChannel.PUSH, payload.type, preferences)) {
            this.webPush?.dispatch(notification, {
                viewingTicketId: payload.viewingTicketId,
                pushTag: payload.pushTag,
                bypassCooldown: payload.bypassPushCooldown,
            });
        }

        // Determine channels based on payload and preferences; email waits out quiet hours (it is not re-sent later,
        // the in-app notice is still there).
        const resolvedChannels = this.resolveChannels(payload, preferences)
            .filter(channel => !(quiet && channel === DeliveryChannel.EMAIL));

        if (suppressLiveAlert && resolvedChannels.includes(DeliveryChannel.IN_APP)) {
            // Bell row was updated in-place; refresh bell counts quietly without triggering another toast/sound.
            this.eventsGateway?.server?.to(`user:${payload.userId}`)?.emit(NOTIFICATIONS_READ_EVENT, { userId: payload.userId });
        }

        const channels = suppressLiveAlert
            ? resolvedChannels.filter(channel => channel !== DeliveryChannel.IN_APP)
            : resolvedChannels;

        if (channels.length === 0) {
            if (!suppressLiveAlert) {
                this.logger.warn(`No channels available for user ${payload.userId}`);
            }
            return notification;
        }

        // Check if digest mode is enabled
        if (payload.type !== NotificationType.TICKET_NOTE && preferences.digestEnabled && preferences.digestFrequency !== DigestFrequency.REALTIME) {
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

    private async resolveOrCreateNotification(payload: NotificationPayload): Promise<{ notification: Notification; groupedExisting: boolean }> {
        if (payload.groupUnread && payload.referenceId) {
            const existingUnread = await this.notificationRepo.findOne({
                where: {
                    userId: payload.userId,
                    type: payload.type,
                    referenceId: payload.referenceId,
                    isRead: false,
                },
                order: { createdAt: 'DESC' },
            });
            if (existingUnread) {
                existingUnread.title = payload.title;
                existingUnread.message = payload.message;
                existingUnread.link = payload.link;
                existingUnread.createdAt = new Date();
                const saved = await this.notificationRepo.save(existingUnread);
                return { notification: saved, groupedExisting: true };
            }
        }
        return { notification: await this.createNotification(payload), groupedExisting: false };
    }

    private async shouldThrottleGroupedAlert(payload: NotificationPayload, groupedExisting: boolean): Promise<boolean> {
        if (!payload.groupUnread || !payload.referenceId || typeof this.cacheService?.getAsync !== 'function') {
            return false;
        }
        const key = `inapp:group:${payload.type}:${payload.userId}:${payload.referenceId}`;
        const active = Boolean(await this.cacheService.getAsync(key));
        if (groupedExisting && active && !payload.bypassPushCooldown) {
            return true;
        }
        await this.cacheService.setAsync?.(key, 1, GROUPED_INAPP_COOLDOWN_SECONDS);
        return false;
    }

    /**
     * Send notification to multiple users
     */
    async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        // P1 perf: original used Promise.all over every recipient — for a
        // 500-recipient bulk send this fired 500 concurrent mailer/DB/push
        // calls and overwhelmed the connection pool. Chunk to 20 at a time
        // for predictable load.
        const CONCURRENCY = 20;
        for (let i = 0; i < userIds.length; i += CONCURRENCY) {
            const chunk = userIds.slice(i, i + CONCURRENCY);
            await Promise.all(
                chunk.map(userId =>
                    this.send({ ...payload, userId }).catch(err => {
                        this.logger.error(`Failed to send notification to user ${userId}:`, err);
                    }),
                ),
            );
        }
    }

    /**
     * Send notification to all users with a specific role at a site.
     * Fail-closed: never falls back to global sendToRole.
     * If no siteId provided, log and return sent:0 (no global fan-out).
     */
    async sendToRoleAtSite(role: string, siteId: string | null | undefined, payload: Omit<NotificationPayload, 'userId'>): Promise<{ sent: number }> {
        const users = await this.findStaffAtSite([role], siteId);
        await this.sendBulk(users.map(u => u.id), payload);
        return { sent: users.length };
    }

    /**
     * Active users with one of `roles` who serve `siteId`: those at that site plus cross-site staff (no site).
     * Fail-closed: an item without a site reaches nobody, never every site.
     */
    async findStaffAtSite(roles: string[], siteId: string | null | undefined, excludeUserIds: string[] = []): Promise<User[]> {
        if (!siteId) {
            this.logger.warn(`No site for a ${roles.join('/')} notification; nobody notified (fail-closed, no global fanout)`);
            return [];
        }
        const users = await this.userRepo.find({
            where: [
                { role: In(roles as any), siteId, isActive: true } as any,
                { role: In(roles as any), siteId: IsNull(), isActive: true } as any,
            ],
            select: ['id', 'email', 'fullName', 'role', 'siteId'],
        });
        return users.filter(u => !excludeUserIds.includes(u.id));
    }

    /**
     * Active users who can open `pageKey` (their preset's page access, else their role's default), optionally only
     * among `roles`. For notices about records without a site, such as renewal contracts and VPN accounts: those
     * reach whoever works that page instead of every admin, manager and agent.
     */
    async findUsersWithPageAccess(pageKey: PageKey, roles?: string[], excludeUserIds: string[] = []): Promise<User[]> {
        const users = await this.userRepo.find({
            where: { isActive: true, ...(roles ? { role: In(roles as any) } : {}) } as any,
            select: ['id', 'email', 'fullName', 'role', 'appliedPresetId'],
        });
        const presetIds = [...new Set(users.map(u => u.appliedPresetId).filter((id): id is string => Boolean(id)))];
        const presets = presetIds.length
            ? await this.entityManager.getRepository(PermissionPreset).find({ where: { id: In(presetIds) }, select: ['id', 'pageAccess'] })
            : [];
        const presetAccess = new Map(presets.map(p => [p.id, p.pageAccess]));
        return users.filter(u => {
            if (excludeUserIds.includes(u.id)) return false;
            const access = (u.appliedPresetId && presetAccess.get(u.appliedPresetId)) || getRoleDefaultPageAccess(u.role);
            return access[pageKey] === true;
        });
    }

    // =====================
    // Preferences Management
    // =====================

    async getOrCreatePreferences(userId: string): Promise<NotificationPreference> {
        let prefs = await this.preferenceRepo.findOne({ where: { userId } });

        if (prefs) {
            return this.syncAccountEmail(prefs);
        }

        // Get user to populate defaults
        const user = await this.userRepo.findOne({ where: { id: userId } });
        prefs = this.preferenceRepo.create({
            userId,
            inAppEnabled: true,
            emailEnabled: true,
            emailAddress: user?.email || undefined,
            // Browser push only reaches devices that subscribed; on by default so subscribing is enough.
            pushEnabled: true,
            digestEnabled: false,
            digestFrequency: DigestFrequency.REALTIME,
            quietHoursEnabled: false,
            timezone: 'Asia/Jakarta',
        });
        await this.preferenceRepo.save(prefs);
        return prefs;
    }

    /**
     * The email channel always uses the account email. emailAddress used to be a copy taken when the
     * preferences row was first created, so after an email change (self-service, admin, HRIS) mail kept
     * going to the old address and the settings page kept showing it. Re-sync it whenever it is read.
     */
    private async syncAccountEmail(prefs: NotificationPreference): Promise<NotificationPreference> {
        const user = await this.userRepo.findOne({ where: { id: prefs.userId }, select: ['id', 'email'] });
        if (!user?.email || user.email === prefs.emailAddress) return prefs;
        prefs.emailAddress = user.email;
        await this.preferenceRepo.update(prefs.id, { emailAddress: user.email });
        return prefs;
    }

    async updatePreferences(
        userId: string,
        updates: Partial<NotificationPreference>
    ): Promise<NotificationPreference> {
        const prefs = await this.getOrCreatePreferences(userId);
        // Only user-settable fields: the address follows the account email (see syncAccountEmail), and identity,
        // tokens and per-type settings have their own paths.
        const { emailAddress: _email, id: _id, userId: _user, pushTokens: _tokens, typeSettings: _types, categorySettings: _cats, ...allowed } = updates as any;
        const saved = await this.preferenceRepo.save({ ...prefs, ...allowed });
        await this.gate?.forget(userId);
        return saved;
    }

    async updateTypePreference(
        userId: string,
        notificationType: NotificationType,
        channelSettings: Record<string, boolean>
    ): Promise<NotificationPreference> {
        const prefs = await this.getOrCreatePreferences(userId);
        // Merge: the settings page changes one channel at a time, and must not wipe the others for this type.
        prefs.typeSettings = {
            ...prefs.typeSettings,
            [notificationType]: { ...prefs.typeSettings?.[notificationType], ...channelSettings },
        };
        const saved = await this.preferenceRepo.save(prefs);
        await this.gate?.forget(userId);
        return saved;
    }

    // =====================
    // Action Items
    // =====================

    emitActionItemsRefresh(userId: string, entityType: string, entityId: string): void {
        try {
            // Instantly clear cached action items for this user across all roles & sites
            this.cacheService.delByPattern(`action-items:${userId}:*`).catch(err => {
                this.logger.warn(`Failed to clear action-items cache for user ${userId}:`, err);
            });
            this.eventsGateway.server.to(`user:${userId}`).emit(`action-items:refresh:${userId}`, { entityType, entityId });
        } catch (error) {
            this.logger.warn(`Failed to emit action-items refresh for user ${userId}:`, error);
        }
    }

    async snoozeActionItem(userId: string, entityType: string, entityId: string, duration: '30m' | '2h' | 'tomorrow'): Promise<{ snoozeUntil: string }> {
        const snoozedUntil = resolveSnoozedUntil(duration);
        await this.snoozeRepo.upsert(
            { userId, entityType, entityId, snoozedUntil },
            { conflictPaths: ['userId', 'entityType', 'entityId'] }
        );
        this.emitActionItemsRefresh(userId, entityType, entityId);
        return { snoozeUntil: snoozedUntil.toISOString() };
    }

    async unsnoozeActionItem(userId: string, entityType: string, entityId: string): Promise<void> {
        await this.snoozeRepo.delete({ userId, entityType, entityId });
        this.emitActionItemsRefresh(userId, entityType, entityId);
    }

    async getCategorySettings(userId: string): Promise<Record<string, boolean>> {
        const pref = await this.preferenceRepo.findOne({ where: { userId } });
        if (!pref?.categorySettings) return { ...DEFAULT_CATEGORY_SETTINGS };
        return { ...DEFAULT_CATEGORY_SETTINGS, ...pref.categorySettings };
    }

    async updateCategorySettings(userId: string, updates: Partial<Record<string, boolean>>): Promise<Record<string, boolean>> {
        const pref = await this.preferenceRepo.findOne({ where: { userId } });
        if (!pref) {
            throw new Error('Notification preferences not found');
        }
        const current = pref.categorySettings || {};
        const updated = { ...current, ...updates };
        await this.preferenceRepo.update({ userId }, { categorySettings: updated as any });
        this.emitActionItemsRefresh(userId, 'SETTINGS', 'categories');
        return { ...DEFAULT_CATEGORY_SETTINGS, ...updated };
    }

    async getActionItems(userId: string, role: string, siteId?: string | null): Promise<any> {
        const cacheKey = `action-items:${userId}:${role}:${siteId ?? 'all'}`;
        const existing = await this.cacheService.getOrSet(
            cacheKey,
            async () => {
                const now = new Date();
                const [data, activeSnoozes, categorySettings] = await Promise.all([
                    fetchActionItemData(this.entityManager, userId, role, siteId ?? null, now),
                    this.snoozeRepo.find({
                        where: { userId, snoozedUntil: MoreThan(now) },
                    }),
                    this.getCategorySettings(userId),
                ]);
                const rawItems = mapQueriesToActionItems(data, now);
                return processAndFilterActionItems(rawItems, activeSnoozes, categorySettings);
            },
            30,
        );
        if (!this.noteActions) return existing;
        const [notes, snoozes, settings] = await Promise.all([
            this.noteActions.items(userId),
            this.snoozeRepo.find({ where: { userId, snoozedUntil: MoreThan(new Date()) } }),
            this.getCategorySettings(userId),
        ]);
        return processAndFilterActionItems([...existing.items, ...notes], snoozes, settings);
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
                .catch(err => {
                    this.logger.error(`Unhandled error delivering to channel ${channel} for notification ${notification.id}: ${err.message}`, err.stack);
                    return null;
                })
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

        const isChannelAvailable = channelService && (
            typeof channelService.isAvailable === 'function'
                ? channelService.isAvailable()
                : true
        );

        if (!isChannelAvailable) {
            this.logger.warn(`Channel ${channel} is not available`);
            return null;
        }

        const recipient = this.getRecipientForChannel(channel, preferences, userId);
        if (!recipient) {
            this.logger.warn(`No recipient for channel ${channel} for user ${userId}`);
            return null;
        }

        // Create log entry
        let log: any = null;
        try {
            log = await this.logRepo.save({
                notificationId: notification.id,
                channel,
                status: DeliveryStatus.PENDING,
                recipient,
            });
        } catch (logErr: any) {
            this.logger.warn(`Could not create notification delivery log: ${logErr.message}`);
        }

        if (notification.type === NotificationType.TICKET_NOTE && this.noteVisibility &&
            !(await this.noteVisibility.filter(userId, [notification])).length) {
            return { success: false, channel, error: 'Private note access revoked', timestamp: new Date() };
        }
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

        // Send with non-blocking try-catch isolation
        let result: DeliveryResult;
        try {
            result = await channelService.send(deliveryPayload);
        } catch (error: any) {
            this.logger.error(`Channel ${channel} delivery threw an unexpected error for user ${userId}: ${error.message}`, error.stack);
            result = {
                success: false,
                channel,
                error: error.message || 'Channel send failed',
                timestamp: new Date(),
            };
        }

        // Update log
        if (log?.id) {
            try {
                await this.logRepo.update(log.id, {
                    status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
                    externalMessageId: result.messageId,
                    errorMessage: result.error,
                    sentAt: result.success ? result.timestamp : undefined,
                });
            } catch (updateErr: any) {
                this.logger.warn(`Could not update notification delivery log: ${updateErr.message}`);
            }
        }

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
            case DeliveryChannel.PUSH:
                return userId; // Push uses userId, subscriptions are looked up by PushChannelService
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
        // In-app unless the caller asks for more: modules send their own templated emails, and a generic copy
        // on top of those reached every e-form recipient twice.
        const requestedChannels = payload.channels || DEFAULT_CHANNELS;

        // Filter based on preferences
        return requestedChannels.filter(channel => {
            // Check global channel toggle
            if (!this.isChannelEnabled(channel, preferences)) {
                return false;
            }

            if (!this.allowsChannel(channel, payload.type, preferences)) return false;

            // Check if recipient exists for this channel
            const recipient = this.getRecipientForChannel(channel, preferences, payload.userId);
            if (!recipient) {
                return false;
            }

            return true;
        });
    }

    /** The global switch and the per-type switch for a channel ("in_app", "email", "push" keys). */
    private allowsChannel(channel: DeliveryChannel, type: NotificationType, preferences: NotificationPreference): boolean {
        if (!this.isChannelEnabled(channel, preferences)) return false;
        return preferences.typeSettings?.[type]?.[channel.toLowerCase()] !== false;
    }

    private isChannelEnabled(channel: DeliveryChannel, preferences: NotificationPreference): boolean {
        switch (channel) {
            case DeliveryChannel.IN_APP:
                return preferences.inAppEnabled;
            case DeliveryChannel.EMAIL:
                return preferences.emailEnabled;
            case DeliveryChannel.PUSH:
                return preferences.pushEnabled;
            default:
                return false;
        }
    }

    // =====================
    // Digest System
    // =====================

    private async addToDigestBuffer(userId: string, notification: Notification): Promise<void> {
        const buffer = this.digestBuffer.get(userId) || [];
        
        // Cap buffer to prevent OOM
        const MAX_BUFFER_PER_USER = 200;
        if (buffer.length >= MAX_BUFFER_PER_USER) {
            this.logger.warn(`Digest buffer overflow for user ${userId}. Dropping oldest notifications.`);
            buffer.splice(0, buffer.length - MAX_BUFFER_PER_USER + 1);
        }

        buffer.push(notification);
        this.digestBuffer.set(userId, buffer);
    }

    @Cron(CronExpression.EVERY_HOUR)
    async processHourlyDigests(): Promise<void> {
        await this.processDigests(DigestFrequency.HOURLY);
    }

    @Cron('0 9 * * *', { timeZone: 'Asia/Jakarta' }) // Every day at 09:00 WIB
    async processDailyDigests(): Promise<void> {
        await this.processDigests(DigestFrequency.DAILY);
    }

    @Cron('0 9 * * 1', { timeZone: 'Asia/Jakarta' }) // Every Monday at 09:00 WIB
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
                await this.sendDigest(await this.syncAccountEmail(pref), buffer);
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
    }

    // =====================
    // Notification CRUD
    // =====================

    private async createNotification(payload: NotificationPayload): Promise<Notification> {
        const notification = this.notificationRepo.create({
            ...(payload.id ? { id: payload.id } : {}),
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            ticketId: payload.ticketId,
            // Kept so "opened the target page" can mark it read, and so it lands in the right category tab.
            referenceId: payload.referenceId,
            category: getCategoryFromType(payload.type),
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
                    status: result.success 
                        ? DeliveryStatus.SENT 
                        : (log.retryCount >= 2 ? DeliveryStatus.PERMANENTLY_FAILED : DeliveryStatus.FAILED),
                    retryCount: log.retryCount + 1,
                    externalMessageId: result.messageId,
                    errorMessage: result.error,
                    sentAt: result.success ? result.timestamp : undefined,
                });
            } catch (error) {
                await this.logRepo.update(log.id, {
                    status: log.retryCount >= 2 ? DeliveryStatus.PERMANENTLY_FAILED : DeliveryStatus.FAILED,
                    retryCount: log.retryCount + 1,
                    errorMessage: error instanceof Error ? error.message : 'Retry failed',
                });
            }
        }
    }
}
