import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, In } from 'typeorm';
import { VpnAccess, VpnStatus } from './entities/vpn-access.entity';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType, NotificationCategory } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class VpnSchedulerService {
    private readonly logger = new Logger(VpnSchedulerService.name);

    constructor(
        @InjectRepository(VpnAccess)
        private readonly vpnRepo: Repository<VpnAccess>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Check for VPN expirations daily at 8 AM
     */
    @Cron('0 8 * * *', { name: 'vpn-reminder-check' })
    async checkVpnExpirations() {
        this.logger.log('Checking VPN expirations...');

        try {
            // 1. Update expired statuses
            await this.updateExpiredStatuses();

            // 2. Send reminders for expiring VPNs
            await this.sendExpiryReminders();

        } catch (error) {
            this.logger.error('Failed to check VPN expirations:', error);
        }
    }

    /**
     * Auto-update expired VPN statuses
     */
    private async updateExpiredStatuses(): Promise<void> {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues

        const expired = await this.vpnRepo.find({
            where: {
                status: VpnStatus.ACTIVE,
                validUntil: LessThanOrEqual(today),
            },
        });

        for (const vpn of expired) {
            vpn.status = VpnStatus.EXPIRED;
            await this.vpnRepo.save(vpn);
            this.logger.log(`VPN access expired: ${vpn.username}`);
        }

        if (expired.length > 0) {
            this.logger.log(`Updated ${expired.length} VPN records to EXPIRED status`);
        }
    }

    /**
     * Send reminder notifications for expiring VPNs
     */
    private async sendExpiryReminders(): Promise<void> {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues

        // Get all active VPNs
        const activeVpns = await this.vpnRepo.find({
            where: { status: VpnStatus.ACTIVE },
        });

        // Get users who should receive notifications (ADMIN and MANAGER)
        const admins = await this.userRepo.find({
            where: { role: In([UserRole.ADMIN, UserRole.MANAGER]) },
        });

        for (const vpn of activeVpns) {
            const daysUntilExpiry = this.getDaysUntilExpiry(vpn.validUntil);
            const reminderDays = vpn.getReminderDaysArray();

            // Check if today matches any reminder day
            if (!reminderDays.includes(daysUntilExpiry)) {
                continue;
            }

            // Check if we already sent a reminder today
            if (vpn.lastReminderSent) {
                const lastReminder = new Date(vpn.lastReminderSent);
                lastReminder.setHours(0, 0, 0, 0);
                if (lastReminder.getTime() === today.getTime()) {
                    continue; // Already sent today
                }
            }

            // Determine urgency
            const isUrgent = daysUntilExpiry <= 7;
            const notificationType = this.getNotificationType(daysUntilExpiry);

            // Send notification to all admins/managers
            for (const admin of admins) {
                await this.notificationService.create({
                    userId: admin.id,
                    type: notificationType,
                    category: NotificationCategory.CATEGORY_RENEWAL, // Reuse renewal category
                    title: this.getNotificationTitle(vpn, daysUntilExpiry),
                    message: this.getNotificationMessage(vpn, daysUntilExpiry),
                    referenceId: vpn.id,
                    link: '/vpn-access',
                    requiresAcknowledge: isUrgent, // D1-D7 require acknowledgment
                });
            }

            // Update last reminder sent
            vpn.lastReminderSent = new Date();
            vpn.isAcknowledged = false; // Reset acknowledgment for new reminder
            await this.vpnRepo.save(vpn);

            this.logger.log(`Sent VPN expiry reminder for ${vpn.username} (D-${daysUntilExpiry})`);
        }
    }

    private getDaysUntilExpiry(validUntil: Date): number {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const expiry = new Date(validUntil);
        expiry.setUTCHours(0, 0, 0, 0);

        const diffTime = expiry.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private getNotificationType(daysUntilExpiry: number): NotificationType {
        if (daysUntilExpiry <= 1) return NotificationType.VPN_EXPIRY_D1;
        if (daysUntilExpiry <= 7) return NotificationType.VPN_EXPIRY_D7;
        if (daysUntilExpiry <= 30) return NotificationType.VPN_EXPIRY_D30;
        return NotificationType.VPN_EXPIRY_D60;
    }

    private getNotificationTitle(vpn: VpnAccess, days: number): string {
        if (days <= 1) {
            return `🚨 VPN Access Expires TODAY: ${vpn.fullName}`;
        }
        if (days <= 7) {
            return `⚠️ VPN Access Expiring Soon: ${vpn.fullName}`;
        }
        return `📅 VPN Access Reminder: ${vpn.fullName}`;
    }

    private getNotificationMessage(vpn: VpnAccess, days: number): string {
        const expiry = new Date(vpn.validUntil).toLocaleDateString('id-ID');

        if (days <= 1) {
            return `URGENT: VPN access for ${vpn.username} (${vpn.vpnType}) expires ${days === 0 ? 'TODAY' : 'TOMORROW'} (${expiry}). Immediate action required!`;
        }

        return `VPN access for ${vpn.username} (${vpn.vpnType}) will expire in ${days} days on ${expiry}. Please review and renew if needed.`;
    }

    /**
     * Manual trigger for testing
     */
    async triggerReminderCheck(): Promise<void> {
        await this.checkVpnExpirations();
    }
}
