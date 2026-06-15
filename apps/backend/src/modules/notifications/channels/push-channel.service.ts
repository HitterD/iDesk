import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

// Maximum failed attempts before auto-unsubscribe
const MAX_FAILED_ATTEMPTS = 3;
// P1: cap the number of pushes a single user can receive per minute to
// avoid notification storms (e.g. a misbehaving upstream emitter).
const PUSH_LIMIT_PER_MIN = 10;

@Injectable()
export class PushChannelService implements INotificationChannel {
    private readonly logger = new Logger(PushChannelService.name);
    readonly channelType = DeliveryChannel.PUSH;
    private isConfigured = false;

    constructor(
        @InjectRepository(PushSubscription)
        private readonly pushSubscriptionRepo: Repository<PushSubscription>,
        private readonly configService: ConfigService,
        private readonly cacheService: CacheService,
    ) {
        this.initializeVapid();
    }

    private initializeVapid(): void {
        const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
        const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@idesk.com';

        if (publicKey && privateKey) {
            try {
                webpush.setVapidDetails(subject, publicKey, privateKey);
                this.isConfigured = true;
                this.logger.log('Web Push VAPID configured successfully');
            } catch (error) {
                this.logger.error('Failed to configure VAPID:', error);
            }
        } else {
            this.logger.warn('VAPID keys not configured. Push notifications will be disabled.');
        }
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
                icon: '/logo192.png',
                badge: '/badge.png',
                tag: payload.notificationId,
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
        return this.configService.get<string>('VAPID_PUBLIC_KEY') || null;
    }

    // Cleanup old/inactive subscriptions (can be called via cron)
    async cleanupInactiveSubscriptions(olderThanDays = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.pushSubscriptionRepo.delete({
            isActive: false,
            updatedAt: cutoffDate,
        });

        const deleted = result.affected ?? 0;
        if (deleted > 0) {
            this.logger.log(`Cleaned up ${deleted} inactive push subscriptions`);
        }

        return deleted;
    }
}
