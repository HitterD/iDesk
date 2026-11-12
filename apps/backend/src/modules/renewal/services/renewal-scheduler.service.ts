import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { RenewalService } from '../renewal.service';
import { RenewalContract } from '../entities/renewal-contract.entity';
import { NotificationService } from '../../notifications/notification.service';
import { EmailChannelService } from '../../notifications/channels/email-channel.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { runOncePerPeriod } from '../../../shared/core/utils/run-exclusive';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';

/** Only the last-day warning blocks the screen until acknowledged; earlier ones are ordinary notifications. */
const ACKNOWLEDGE_DAYS = 1;

@Injectable()
export class RenewalSchedulerService {
    private readonly logger = new Logger(RenewalSchedulerService.name);

    constructor(
        private readonly renewalService: RenewalService,
        private readonly notificationService: NotificationService,
        private readonly emailChannelService: EmailChannelService,
        private readonly notificationCenter: NotificationCenterService,
        private readonly dataSource: DataSource,
    ) { }

    // === DAILY JOB: Check Expiring Contracts (9 AM WIB) ===
    @Cron('0 9 * * *', {
        name: 'renewal-reminder-check',
        timeZone: 'Asia/Jakarta',
    })
    async checkExpiringContracts() {
        this.logger.log('Running daily renewal reminder check...');

        try {
            // Once per WIB day across replicas and restarts.
            const ran = await runOncePerPeriod(this.dataSource, 'renewal-reminder-check', localDateKey(new Date(), DEFAULT_TIMEZONE), async () => {
                // Check D-60, D-30, D-7, D-1
                for (const days of [60, 30, 7, 1] as const) await this.processReminders(days);
                return true;
            });
            if (!ran) {
                this.logger.log('Renewal reminders already sent today; skipped.');
                return;
            }

            // Update all statuses
            const updated = await this.renewalService.updateAllStatuses();
            this.logger.log(`Status update complete. ${updated} contracts updated.`);
        } catch (error) {
            this.logger.error('Renewal check failed:', error);
        }
    }

    private async processReminders(days: 60 | 30 | 7 | 1) {
        const contracts = await this.renewalService.findContractsNeedingReminder(days);

        if (contracts.length === 0) {
            this.logger.debug(`No contracts expiring in ${days} days`);
            return;
        }

        this.logger.log(`Found ${contracts.length} contracts expiring in ${days} days`);

        // Active people who work the Renewal Hub (preset page access, else role default) - not every staff account.
        const admins = await this.notificationCenter.findUsersWithPageAccess('renewal');

        for (const contract of contracts) {
            await this.sendReminderNotifications(contract, days, admins);
            await this.renewalService.markReminderSent(contract.id, days);
        }
    }

    private getNotificationTypeForDays(days: number): NotificationType {
        switch (days) {
            case 60:
                return NotificationType.RENEWAL_D60_WARNING;
            case 30:
                return NotificationType.RENEWAL_D30_WARNING;
            case 7:
                return NotificationType.RENEWAL_D7_WARNING;
            case 1:
                return NotificationType.RENEWAL_D1_WARNING;
            default:
                return NotificationType.SYSTEM;
        }
    }

    private async sendReminderNotifications(
        contract: RenewalContract,
        daysUntilExpiry: number,
        admins: User[],
    ) {
        const urgency = daysUntilExpiry === 1 ? '🚨 URGENT'
            : daysUntilExpiry === 7 ? '⚠️ WARNING'
                : daysUntilExpiry === 60 ? '📆 EARLY NOTICE'
                    : '📅 REMINDER';

        const title = `${urgency}: Contract Expiring in ${daysUntilExpiry} Day(s)`;
        const endDateStr = contract.endDate
            ? new Date(contract.endDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            })
            : 'Unknown';

        const message = `Contract "${contract.poNumber || contract.originalFileName}" ` +
            `(Vendor: ${contract.vendorName || 'Unknown'}) ` +
            `will expire on ${endDateStr}.`;

        // === IN-APP NOTIFICATION ===
        const notificationType = this.getNotificationTypeForDays(daysUntilExpiry);

        // Only the last day blocks the screen until acknowledged.
        const requiresAcknowledge = daysUntilExpiry <= ACKNOWLEDGE_DAYS;

        for (const admin of admins) {
            try {
                await this.notificationService.create({
                    userId: admin.id,
                    type: notificationType,
                    category: NotificationCategory.CATEGORY_RENEWAL,
                    title,
                    message,
                    referenceId: contract.id,
                    link: '/renewal?tab=contracts',
                    requiresAcknowledge,
                });
            } catch (error) {
                this.logger.error(`Failed to send in-app notification to ${admin.email}:`, error);
            }
        }

        // === EMAIL NOTIFICATION ===
        for (const admin of admins) {
            if (admin.email) {
                try {
                    await this.emailChannelService.send({
                        recipient: admin.email,
                        title,
                        body: message,
                        notificationId: contract.id,
                        data: {
                            contractId: contract.id,
                            link: '/renewal?tab=contracts',
                        },
                    });
                } catch (error) {
                    this.logger.error(`Failed to send email to ${admin.email}:`, error);
                }
            }
        }

        this.logger.log(`Sent ${daysUntilExpiry}-day reminder for contract ${contract.id}`);
    }

    // Manual trigger for testing
    async triggerReminderCheck() {
        await this.checkExpiringContracts();
    }
}
