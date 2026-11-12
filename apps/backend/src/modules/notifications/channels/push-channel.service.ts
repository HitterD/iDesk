import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import {
    INotificationChannel,
    ChannelDeliveryPayload,
    DeliveryResult,
    NotificationPriority,
} from '../interfaces/notification-channel.interface';
import { DeliveryChannel } from '../entities/notification-log.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { CredentialCipherService } from '../../../shared/core/encryption/credential-cipher.service';
import { SystemSettings } from '../../settings/entities/system-settings.entity';

// Maximum failed attempts before auto-unsubscribe
const MAX_FAILED_ATTEMPTS = 3;
// P1: cap the number of pushes a single user can receive per minute to
// avoid notification storms (e.g. a misbehaving upstream emitter).
const PUSH_LIMIT_PER_MIN = 10;
/** system_settings row holding the generated VAPID pair when none is configured in the environment. */
export const VAPID_SETTING_KEY = 'webpush.vapid';
/** Shipped in apps/frontend/public; shown by the OS next to the notification. */
const PUSH_ICON = '/idesk-icon.png';

interface VapidKeys { publicKey: string; privateKey: string }

@Injectable()
export class PushChannelService implements INotificationChannel, OnApplicationBootstrap {
    private readonly logger = new Logger(PushChannelService.name);
    readonly channelType = DeliveryChannel.PUSH;
    private isConfigured = false;
    private publicKey: string | null = null;

    constructor(
        @InjectRepository(PushSubscription)
        private readonly pushSubscriptionRepo: Repository<PushSubscription>,
        private readonly configService: ConfigService,
        private readonly cacheService: CacheService,
        private readonly cipher: CredentialCipherService,
    ) {}

    /**
     * After every module is initialised (the cipher derives its key in onModuleInit): VAPID keys come from the
     * environment when set; otherwise a pair is generated once and kept, encrypted, in system_settings, so browser
     * notifications work on a deployment that never configured them. Push stays off (logged) if both fail.
     */
    async onApplicationBootstrap(): Promise<void> {
        const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@idesk.com';
        try {
            const keys = this.environmentKeys() ?? (await this.storedKeys());
            webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
            this.publicKey = keys.publicKey;
            this.isConfigured = true;
            this.logger.log('Web Push VAPID configured');
        } catch (error) {
            this.logger.error(`Web Push disabled: ${(error as Error).message}`);
        }
    }

    private environmentKeys(): VapidKeys | null {
        const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
        return publicKey && privateKey ? { publicKey, privateKey } : null;
    }

    private async storedKeys(): Promise<VapidKeys> {
        const settings = this.pushSubscriptionRepo.manager.getRepository(SystemSettings);
        const read = async (): Promise<VapidKeys | null> => {
            const row = await settings.findOne({ where: { key: VAPID_SETTING_KEY } });
            const value = row?.value as { publicKey?: string; privateKey?: string } | undefined;
            return value?.publicKey && value.privateKey
                ? { publicKey: value.publicKey, privateKey: this.cipher.decrypt(value.privateKey) }
                : null;
        };
        const existing = await read();
        if (existing) return existing;

        const generated = webpush.generateVAPIDKeys();
        await settings.query(
            `INSERT INTO system_settings (key, value, description, category, "updatedBy")
             VALUES ($1, $2::jsonb, $3, 'notifications', 'system') ON CONFLICT (key) DO NOTHING`,
            [
                VAPID_SETTING_KEY,
                JSON.stringify({ publicKey: generated.publicKey, privateKey: this.cipher.encrypt(generated.privateKey) }),
                'Web Push VAPID key pair (generated because VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set)',
            ],
        );
        this.logger.warn('VAPID keys not set in the environment; using a generated pair stored in system_settings');
        // Re-read: with several instances booting at once, the first insert wins and everyone uses that pair.
        const stored = await read();
        if (!stored) throw new Error('could not store generated VAPID keys');
        return stored;
    }

    async send(payload: ChannelDeliveryPayload): Promise<DeliveryResult> {
        const timestamp = new Date();

        if (!this.isConfigured) {
            return {
                success: false,
                channel: this.channelType,
                error: 'Push notifications not configured (missing VAPID keys)',
                timestamp,
            };
        }

        // P1 perf: 60s dedup. Identical notificationId to the same user
        // within 60s is a no-op (returns success silently so the caller
        // doesn't see a failure and re-try).
        const dedupKey = `push:dedup:${payload.recipient}:${payload.notificationId}`;
        const alreadySent = await this.cacheService.getAsync<string>(dedupKey);
        if (alreadySent) {
            return {
                success: true,
                channel: this.channelType,
                messageId: 'dedup',
                timestamp,
            };
        }

        // P1 perf: per-user throttle (10/min). Bucket key includes the
        // current minute so the counter auto-resets every 60s.
        const throttleKey = `push:throttle:${payload.recipient}:${Math.floor(Date.now() / 60_000)}`;
        const priorCount = (await this.cacheService.getAsync<number>(throttleKey)) || 0;
        if (priorCount >= PUSH_LIMIT_PER_MIN) {
            return {
                success: false,
                channel: this.channelType,
                error: `Push throttled: ${PUSH_LIMIT_PER_MIN} per minute limit reached`,
                timestamp,
            };
        }
        await this.cacheService.setAsync(throttleKey, priorCount + 1, 65);

        try {
            // Get all active subscriptions for user
            const subscriptions = await this.pushSubscriptionRepo.find({
                where: { userId: payload.recipient, isActive: true },
            });

            if (subscriptions.length === 0) {
                return {
                    success: false,
                    channel: this.channelType,
                    error: 'No active push subscriptions for user',
                    timestamp,
                };
            }

            // Prepare push payload
            const pushPayload = JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: PUSH_ICON,
                badge: PUSH_ICON,
                // Lets the service worker mark the stored notification read when the toast is clicked.
                notificationId: payload.data?.notificationId ?? null,
                // Same tag replaces the toast already on screen (e.g. one per ticket chat).
                tag: payload.data?.tag || payload.notificationId,
                url: payload.data?.link || '/',
                type: payload.data?.type,
                ticketId: payload.data?.ticketId,
                timestamp: timestamp.toISOString(),
            });

            // Send to all subscriptions
            const results = await Promise.allSettled(
                subscriptions.map(async (sub) => {
                    try {
                        await webpush.sendNotification(
                            {
                                endpoint: sub.endpoint,
                                keys: {
                                    p256dh: sub.p256dh,
                                    auth: sub.auth,
                                },
                            },
                            pushPayload,
                            {
                                TTL: 86400, // 24 hours
                                urgency: payload.priority === NotificationPriority.HIGH || payload.priority === NotificationPriority.URGENT ? 'high' : 'normal',
                            }
                        );

                        // Update last push timestamp
                        await this.pushSubscriptionRepo.update(sub.id, {
                            lastPushAt: new Date(),
                            failedAttempts: 0,
                        });

                        return { success: true, subscriptionId: sub.id };
                    } catch (error: any) {
                        this.logger.error(`Push failed for subscription ${sub.id}:`, error.message);

                        // Handle gone/expired subscriptions (410 or 404)
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            await this.pushSubscriptionRepo.update(sub.id, { isActive: false });
                            this.logger.log(`Deactivated expired subscription: ${sub.id}`);
                        } else {
                            // Increment failed attempts
                            const newFailedAttempts = sub.failedAttempts + 1;
                            if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
                                await this.pushSubscriptionRepo.update(sub.id, { isActive: false });
                                this.logger.log(`Deactivated subscription after ${MAX_FAILED_ATTEMPTS} failures: ${sub.id}`);
                            } else {
                                await this.pushSubscriptionRepo.update(sub.id, { failedAttempts: newFailedAttempts });
                            }
                        }

                        return { success: false, subscriptionId: sub.id, error: error.message };
                    }
                })
            );

            // Count successful deliveries
            const successCount = results.filter(
                (r) => r.status === 'fulfilled' && r.value.success
            ).length;

            this.logger.debug(
                `Push sent to ${successCount}/${subscriptions.length} subscriptions for user ${payload.recipient}`
            );

            this.logger.log(`Push delivery: ${successCount}/${subscriptions.length} successful for user ${payload.recipient}`);

            // Mark as sent (60s dedup) so a retry within the window is a no-op.
            await this.cacheService.setAsync(dedupKey, '1', 60).catch(() => undefined);

            return {
                success: successCount > 0,
                channel: this.channelType,
                messageId: payload.notificationId,
                timestamp,
            };
        } catch (error) {
            this.logger.error(`Failed to send push notification:`, error);

            return {
                success: false,
                channel: this.channelType,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp,
            };
        }
    }

    async validateRecipient(userId: string): Promise<boolean> {
        const count = await this.pushSubscriptionRepo.count({
            where: { userId, isActive: true },
        });
        return count > 0;
    }

    isAvailable(): boolean {
        return this.isConfigured;
    }

    // =====================
    // Subscription Management
    // =====================

    async subscribe(
        userId: string,
        subscription: {
            endpoint: string;
            keys: { p256dh: string; auth: string };
        },
        userAgent?: string,
        deviceName?: string,
    ): Promise<PushSubscription> {
        // Check if subscription already exists
        const existing = await this.pushSubscriptionRepo.findOne({
            where: { endpoint: subscription.endpoint },
        });

        if (existing) {
            // Update existing subscription
            existing.userId = userId;
            existing.p256dh = subscription.keys.p256dh;
            existing.auth = subscription.keys.auth;
            existing.isActive = true;
            existing.failedAttempts = 0;
            if (userAgent) existing.userAgent = userAgent;
            if (deviceName) existing.deviceName = deviceName;

            return this.pushSubscriptionRepo.save(existing);
        }

        // Create new subscription
        const newSub = this.pushSubscriptionRepo.create({
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
            deviceName,
            isActive: true,
        });

        return this.pushSubscriptionRepo.save(newSub);
    }

    async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
        const result = await this.pushSubscriptionRepo.update(
            { userId, endpoint },
            { isActive: false }
        );
        return (result.affected ?? 0) > 0;
    }

    async unsubscribeAll(userId: string): Promise<void> {
        await this.pushSubscriptionRepo.update(
            { userId },
            { isActive: false }
        );
    }

    async getSubscriptions(userId: string): Promise<PushSubscription[]> {
        return this.pushSubscriptionRepo.find({
            where: { userId, isActive: true },
            order: { createdAt: 'DESC' },
        });
    }

    async getSubscriptionCount(userId: string): Promise<number> {
        return this.pushSubscriptionRepo.count({
            where: { userId, isActive: true },
        });
    }

    getVapidPublicKey(): string | null {
        return this.publicKey;
    }

    /** Deletes subscriptions that stopped working (gone, or failed too often) more than `olderThanDays` ago. */
    async cleanupInactiveSubscriptions(olderThanDays = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        // Older than the cutoff (the old code matched updatedAt exactly, so it never deleted anything).
        const result = await this.pushSubscriptionRepo.delete({
            isActive: false,
            updatedAt: LessThan(cutoffDate),
        });

        const deleted = result.affected ?? 0;
        if (deleted > 0) {
            this.logger.log(`Cleaned up ${deleted} inactive push subscriptions`);
        }

        return deleted;
    }
}
