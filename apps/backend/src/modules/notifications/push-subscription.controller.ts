import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PushChannelService } from './channels/push-channel.service';

interface SubscribeDto {
    subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    };
    deviceName?: string;
}

interface UnsubscribeDto {
    endpoint: string;
}

@Controller('notifications/push')
@UseGuards(JwtAuthGuard)
export class PushSubscriptionController {
    constructor(private readonly pushChannelService: PushChannelService) { }

    /**
     * Get VAPID public key for client-side subscription
     */
    @Get('vapid-key')
    getVapidKey() {
        const publicKey = this.pushChannelService.getVapidPublicKey();

        if (!publicKey) {
            throw new BadRequestException('Push notifications are not configured');
        }

        return { publicKey };
    }

    /**
     * Subscribe to push notifications
     */
    @Post('subscribe')
    @HttpCode(HttpStatus.OK)
    async subscribe(@Req() req: any, @Body() dto: SubscribeDto) {
        const userId = req.user.userId;
        const userAgent = req.headers['user-agent'];

        if (!dto.subscription?.endpoint || !dto.subscription?.keys?.p256dh || !dto.subscription?.keys?.auth) {
            throw new BadRequestException('Invalid subscription object');
        }

        const subscription = await this.pushChannelService.subscribe(
            userId,
            dto.subscription,
            userAgent,
            dto.deviceName,
        );

        return {
            success: true,
            message: 'Successfully subscribed to push notifications',
            subscriptionId: subscription.id,
        };
    }

    /**
     * Unsubscribe from push notifications
     */
    @Post('unsubscribe')
    @HttpCode(HttpStatus.OK)
    async unsubscribe(@Req() req: any, @Body() dto: UnsubscribeDto) {
        const userId = req.user.userId;

        if (!dto.endpoint) {
            throw new BadRequestException('Endpoint is required');
        }

        const success = await this.pushChannelService.unsubscribe(userId, dto.endpoint);

        return {
            success,
            message: success
                ? 'Successfully unsubscribed from push notifications'
                : 'Subscription not found',
        };
    }

    /**
     * Unsubscribe all devices
     */
    @Delete('unsubscribe-all')
    @HttpCode(HttpStatus.OK)
    async unsubscribeAll(@Req() req: any) {
        const userId = req.user.userId;
        await this.pushChannelService.unsubscribeAll(userId);

        return {
            success: true,
            message: 'Unsubscribed from all devices',
        };
    }

    /**
     * Get all active subscriptions for current user
     */
    @Get('subscriptions')
    async getSubscriptions(@Req() req: any) {
        const userId = req.user.userId;
        const subscriptions = await this.pushChannelService.getSubscriptions(userId);

        // Return sanitized subscription info (without sensitive keys)
        return subscriptions.map((sub) => ({
            id: sub.id,
            deviceName: sub.deviceName || this.parseDeviceName(sub.userAgent),
            createdAt: sub.createdAt,
            lastPushAt: sub.lastPushAt,
        }));
    }

    /**
     * Get subscription count for current user
     */
    @Get('count')
    async getSubscriptionCount(@Req() req: any) {
        const userId = req.user.userId;
        const count = await this.pushChannelService.getSubscriptionCount(userId);

        return { count };
    }

    /**
     * Check if push notifications are available
     */
    @Get('status')
    async getStatus(@Req() req: any) {
        const userId = req.user.userId;
        const isConfigured = this.pushChannelService.isAvailable();
        const subscriptionCount = await this.pushChannelService.getSubscriptionCount(userId);

        return {
            isConfigured,
            isSubscribed: subscriptionCount > 0,
            subscriptionCount,
            publicKey: isConfigured ? this.pushChannelService.getVapidPublicKey() : null,
        };
    }

    /**
     * Sends a test toast to every browser this user subscribed, so they can see it works without a real event.
     * Throttled with the user's other pushes (10 per minute).
     */
    @Post('test')
    @HttpCode(HttpStatus.OK)
    async sendTest(@Req() req: any) {
        const result = await this.pushChannelService.send({
            notificationId: `test-${Date.now()}`,
            recipient: req.user.userId,
            title: 'Notifikasi uji',
            body: 'Notifikasi browser iDesk aktif di perangkat ini.',
            data: { link: '/notifications', type: 'PUSH_TEST' },
        });
        return { delivered: result.success, error: result.success ? null : result.error ?? null };
    }

    /**
     * Parse device name from user agent
     */
    private parseDeviceName(userAgent?: string): string {
        if (!userAgent) return 'Unknown Device';

        // Simple parsing - can be enhanced with a library
        if (userAgent.includes('Windows')) return 'Windows PC';
        if (userAgent.includes('Macintosh')) return 'Mac';
        if (userAgent.includes('iPhone')) return 'iPhone';
        if (userAgent.includes('iPad')) return 'iPad';
        if (userAgent.includes('Android')) return 'Android Device';
        if (userAgent.includes('Linux')) return 'Linux PC';

        // Browser-based fallback
        if (userAgent.includes('Chrome')) return 'Chrome Browser';
        if (userAgent.includes('Firefox')) return 'Firefox Browser';
        if (userAgent.includes('Safari')) return 'Safari Browser';
        if (userAgent.includes('Edge')) return 'Edge Browser';

        return 'Web Browser';
    }
}
