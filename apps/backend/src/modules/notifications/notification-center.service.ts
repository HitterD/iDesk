import { Injectable, Logger, OnModuleInit, forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
import { addMinutes, addHours, addDays, startOfDay, setHours } from 'date-fns';
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
import { TelegramChannelService } from './channels/telegram-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';
import { PushChannelService } from './channels/push-channel.service';
import { User } from '../users/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';
import { ActionItemDto, ActionItemUrgency, ActionItemEntityType, ActionItemsResponseDto } from './dto/action-item.dto';
import { CacheService } from '../../shared/core/cache/cache.service';

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
        private readonly telegramChannel: TelegramChannelService,
        private readonly inAppChannel: InAppChannelService,
        private readonly pushChannel: PushChannelService,
        private readonly entityManager: EntityManager,
        private readonly cacheService: CacheService,
    ) { }

    onModuleInit() {
        // Register available channels
        this.channels.set(DeliveryChannel.EMAIL, this.emailChannel);
        this.channels.set(DeliveryChannel.TELEGRAM, this.telegramChannel);
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
        if (!siteId) {
            this.logger.warn(`sendToRoleAtSite called without siteId for role ${role}; returning 0 (fail-closed, no global fanout)`);
            return { sent: 0 };
        }
        const PAGE = 200;
        let sent = 0; let skip = 0;
        while (true) {
            const users = await this.userRepo.find({ where: { role: role as any, siteId } as any, take: PAGE, skip, select: ['id'] });
            if (users.length === 0) break;
            await this.sendBulk(users.map(u => u.id), payload);
            sent += users.length;
            if (users.length < PAGE) break;
            skip += PAGE;
        }
        // No fallback to global sendToRole if sent === 0
        return { sent };
    }

    async sendToRole(role: string, payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
        // P1 perf: original loaded every user with the role in a single
        // unbounded query. For a large USER/AGENT role that meant thousands
        // of entities in memory. Now we page 200 at a time and stream.
        const PAGE = 200;
        let skip = 0;
        while (true) {
            const users = await this.userRepo.find({
                where: { role: role as any },
                take: PAGE,
                skip,
                select: ['id'],
            });
            if (users.length === 0) break;
            await this.sendBulk(users.map(u => u.id), payload);
            if (users.length < PAGE) break;
            skip += PAGE;
        }
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
                emailAddress: user?.email || undefined,
                telegramEnabled: !!user?.telegramChatId,
                telegramChatId: user?.telegramChatId || undefined,
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
        return this.preferenceRepo.save({ ...prefs, ...updates });
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
    // Action Items
    // =====================

    private resolveSnoozedUntil(duration: '30m' | '2h' | 'tomorrow'): Date {
        const now = new Date();
        if (duration === '30m') return addMinutes(now, 30);
        if (duration === '2h') return addHours(now, 2);
        const tomorrow = startOfDay(addDays(now, 1));
        return setHours(tomorrow, 8);
    }

    emitActionItemsRefresh(userId: string, entityType: string, entityId: string): void {
        try {
            this.eventsGateway.server.emit(`action-items:refresh:${userId}`, { entityType, entityId });
        } catch (error) {
            this.logger.warn(`Failed to emit action-items refresh for user ${userId}:`, error);
        }
    }

    async snoozeActionItem(userId: string, entityType: string, entityId: string, duration: '30m' | '2h' | 'tomorrow'): Promise<{ snoozeUntil: string }> {
        const snoozedUntil = this.resolveSnoozedUntil(duration);
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
        const defaults = { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: true };
        if (!pref?.categorySettings) return defaults;
        return { ...defaults, ...pref.categorySettings };
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
        const defaults = { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: true };
        return { ...defaults, ...updated };
    }

    async getActionItems(userId: string, role: string, siteId?: string | null): Promise<any> {
        // P0 perf: 30s cache per (user, role) to stop the manager+admin poll
        // from full-table-scanning tickets/renewals/eform/hardware on every
        // request. Cache is invalidated by snooze toggle / category settings
        // mutations via the action-items:refresh event emitted elsewhere.
        const cacheKey = `action-items:${userId}:${role}:${siteId ?? 'all'}`;
        return this.cacheService.getOrSet(
            cacheKey,
            async () => {
                const now = new Date();
                const [data, activeSnoozes, categorySettings] = await Promise.all([
                    this.fetchActionItemData(userId, role, siteId ?? null, now),
                    this.snoozeRepo.find({
                        where: { userId, snoozedUntil: MoreThan(now) },
                    }),
                    this.getCategorySettings(userId),
                ]);
                const rawItems = this.mapQueriesToActionItems(data, now);
                return this.processAndFilterActionItems(rawItems, activeSnoozes, categorySettings);
            },
            30,
        );
    }

    private async fetchActionItemData(userId: string, role: string, siteId: string | null, now: Date) {
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const isAgentOrAdmin = role === 'AGENT' || role === 'ADMIN';
        const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
        const isUser = role === 'USER';

        // Build optional site filter per query, with correct parameter indices.
        // Hardware query has no prior params → site uses $1.
        // EForm query already has $1 (userId) → site uses $2.
        const hwSiteFilterSql = siteId ? ' AND "siteId" = $1' : '';
        const hwSiteFilterParams = siteId ? [siteId] : [];
        const eformSiteFilterSql = siteId ? ' AND "siteId" = $2' : '';

        const [slaBreachedTickets, unrespondedTickets, resolvedTickets, pendingHw, pendingEform, renewals] = await Promise.all([
            isAgentOrAdmin ? this.entityManager.query(
                `SELECT id, "ticketNumber", title, "createdAt", "updatedAt" FROM tickets WHERE "assignedToId" = $1 AND status != 'RESOLVED' AND "slaTarget" < $2 ORDER BY "slaTarget" ASC LIMIT 50`,
                [userId, now]
            ) : Promise.resolve([]),
            isAgentOrAdmin ? this.entityManager.query(
                `SELECT id, "ticketNumber", title, "createdAt" FROM tickets WHERE "assignedToId" = $1 AND status = 'TODO' AND "createdAt" < $2 ORDER BY "createdAt" ASC LIMIT 50`,
                [userId, oneHourAgo]
            ) : Promise.resolve([]),
            isUser ? this.entityManager.query(
                `SELECT id, "ticketNumber", title, "updatedAt" FROM tickets WHERE "userId" = $1 AND status = 'RESOLVED' ORDER BY "updatedAt" DESC LIMIT 50`,
                [userId]
            ) : Promise.resolve([]),
            isManagerOrAdmin ? this.entityManager.query(
                `SELECT id, "requestNumber", status, "createdAt" FROM hardware_requests WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')${hwSiteFilterSql} ORDER BY "createdAt" DESC LIMIT 50`,
                hwSiteFilterParams
            ) : Promise.resolve([]),
            isManagerOrAdmin ? this.entityManager.query(
                `SELECT id, "formType", "createdAt" FROM eform_requests WHERE "currentApproverId" = $1 AND status IN ('PENDING_MANAGER', 'PENDING_ICT')${eformSiteFilterSql} ORDER BY "createdAt" DESC LIMIT 50`,
                siteId ? [userId, siteId] : [userId]
            ) : Promise.resolve([]),
            isManagerOrAdmin ? this.entityManager.query(
                `SELECT id, "vendorName", "description", "endDate", "status" FROM renewal_contracts WHERE "status" != 'EXPIRED' AND "endDate" < $1 AND "deletedAt" IS NULL ORDER BY "endDate" ASC LIMIT 50`,
                [next7Days]
            ).catch(() => []) : Promise.resolve([]),
        ]);

        return { slaBreachedTickets, unrespondedTickets, resolvedTickets, pendingHw, pendingEform, renewals };
    }

    private mapQueriesToActionItems(data: any, now: Date): ActionItemDto[] {
        const items: ActionItemDto[] = [];
        const next1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        data.slaBreachedTickets.forEach((t: any) => items.push({
            id: `tkt-sla-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `SLA Breached: ${t.ticketNumber}`,
            description: t.title, urgency: ActionItemUrgency.CRITICAL, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.updatedAt, isSnoozed: false
        }));

        data.unrespondedTickets.forEach((t: any) => items.push({
            id: `tkt-unresp-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Unresponded: ${t.ticketNumber}`,
            description: t.title, urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.createdAt, isSnoozed: false
        }));

        data.resolvedTickets.forEach((t: any) => items.push({
            id: `tkt-res-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Ticket Resolved: ${t.ticketNumber}`,
            description: 'Please confirm resolution', urgency: ActionItemUrgency.NORMAL, entityId: t.id, link: `/client/tickets/${t.id}`, createdAt: t.updatedAt, isSnoozed: false
        }));

        data.pendingHw.forEach((hw: any) => items.push({
            id: `hw-${hw.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: `Hardware Approval Pending`,
            description: `Request ${hw.requestNumber}`, urgency: ActionItemUrgency.HIGH, entityId: hw.id, link: `/hardware-requests/${hw.id}`, createdAt: hw.createdAt, isSnoozed: false
        }));

        data.pendingEform.forEach((ef: any) => items.push({
            id: `ef-${ef.id}`, entityType: ActionItemEntityType.EFORM, title: `E-Form Approval Pending`,
            description: `${ef.formType} Request`, urgency: ActionItemUrgency.HIGH, entityId: ef.id, link: `/eform/requests/${ef.id}`, createdAt: ef.createdAt, isSnoozed: false
        }));

        data.renewals.forEach((r: any) => {
            const isCritical = new Date(r.endDate) < next1Day;
            const label = r.vendorName || r.description || 'Unknown Contract';
            items.push({
                id: `ren-${r.id}`, entityType: ActionItemEntityType.RENEWAL, title: isCritical ? `Renewal Critical` : `Renewal Expiring Soon`,
                description: label, urgency: isCritical ? ActionItemUrgency.CRITICAL : ActionItemUrgency.HIGH, entityId: r.id, link: `/renewals/${r.id}`, createdAt: new Date(), isSnoozed: false
            });
        });

        return items;
    }

    private processAndFilterActionItems(items: ActionItemDto[], activeSnoozes: any[], categorySettings: Record<string, boolean>) {
        const snoozeMap = new Map(
            activeSnoozes.map(s => [`${s.entityType}:${s.entityId}`, s.snoozedUntil])
        );

        // Annotate items dengan snooze info + filter disabled categories
        const annotatedItems = items
            .filter(item => {
                const catKey = item.entityType as string;
                return categorySettings[catKey] !== false;
            })
            .map(item => {
                const key = `${item.entityType}:${item.entityId}`;
                const snoozeUntil = snoozeMap.get(key);
                return {
                    ...item,
                    isSnoozed: !!snoozeUntil,
                    snoozeUntil: snoozeUntil?.toISOString(),
                };
            });

        // Recalculate counts (exclude snoozed items)
        const activeItems = annotatedItems.filter(i => !i.isSnoozed);
        const counts = {
            critical: activeItems.filter(i => i.urgency === ActionItemUrgency.CRITICAL).length,
            high: activeItems.filter(i => i.urgency === ActionItemUrgency.HIGH).length,
            normal: activeItems.filter(i => i.urgency === ActionItemUrgency.NORMAL).length,
            total: activeItems.length,
        };

        const sortedItems = annotatedItems.sort((a, b) => {
            const urgencyWeight: Record<string, number> = { 'CRITICAL': 3, 'HIGH': 2, 'NORMAL': 1 };
            if (urgencyWeight[b.urgency] !== urgencyWeight[a.urgency]) {
                return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return { items: sortedItems, counts };
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
