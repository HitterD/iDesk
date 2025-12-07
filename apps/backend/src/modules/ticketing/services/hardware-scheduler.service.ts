import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, And, IsNull, Not } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { BusinessHoursService } from '../../sla-config/business-hours.service';

/**
 * Hardware Installation Scheduler Service
 * Sends reminder notifications for scheduled hardware installations:
 * - D-1: One day before (or Friday if D-1 is weekend/holiday)
 * - D-0: Day of installation
 */
@Injectable()
export class HardwareSchedulerService {
    private readonly logger = new Logger(HardwareSchedulerService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notificationService: NotificationService,
        private readonly businessHoursService: BusinessHoursService,
    ) { }

    // === DAILY JOB: Check Hardware Installations (9 AM WIB) ===
    @Cron('0 9 * * *', {
        name: 'hardware-installation-reminder',
        timeZone: 'Asia/Jakarta',
    })
    async checkUpcomingInstallations() {
        this.logger.log('Running daily hardware installation reminder check...');

        try {
            await this.processD1Reminders();
            await this.processD0Reminders();
            await this.autoResolveOverdueInstallations(); // H+1 auto-resolve
            this.logger.log('Hardware installation reminder check complete.');
        } catch (error) {
            this.logger.error('Hardware installation reminder check failed:', error);
        }
    }

    /**
     * Auto-resolve hardware installation tickets on H+1 if not resolved on scheduled date
     */
    private async autoResolveOverdueInstallations() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find installations that were scheduled for yesterday or earlier and not resolved
        const overdueTickets = await this.ticketRepo.find({
            where: {
                isHardwareInstallation: true,
                scheduledDate: LessThanOrEqual(today),
                status: Not(TicketStatus.RESOLVED),
            },
            relations: ['user', 'assignedTo'],
        });

        if (overdueTickets.length === 0) {
            this.logger.debug('No overdue hardware installations to auto-resolve');
            return;
        }

        this.logger.log(`Found ${overdueTickets.length} overdue hardware installations to auto-resolve`);

        for (const ticket of overdueTickets) {
            // Check if scheduled date was yesterday or earlier (H+1 logic)
            const scheduledDate = new Date(ticket.scheduledDate);
            scheduledDate.setHours(0, 0, 0, 0);

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (scheduledDate <= yesterday) {
                // Auto-resolve the ticket
                await this.ticketRepo.update(ticket.id, {
                    status: TicketStatus.RESOLVED,
                    resolvedAt: new Date(),
                });

                this.logger.log(`Auto-resolved hardware installation ticket ${ticket.id} (scheduled: ${scheduledDate.toISOString()})`);

                // Send notification about auto-resolution
                await this.sendAutoResolveNotification(ticket);
            }
        }
    }

    /**
     * Send notification when ticket is auto-resolved
     */
    private async sendAutoResolveNotification(ticket: Ticket) {
        const title = `🔧 Hardware Installation Auto-Resolved`;
        const message = `Hardware installation ticket #${ticket.ticketNumber || ticket.id.substring(0, 8)} ` +
            `for ${ticket.hardwareType || 'equipment'} has been automatically resolved (H+1).`;

        // Get all admins
        const admins = await this.userRepo.find({
            where: { role: UserRole.ADMIN, isActive: true }
        });

        // Notify user, agent, and admins
        const recipientIds = new Set<string>();
        if (ticket.userId) recipientIds.add(ticket.userId);
        if (ticket.assignedToId) recipientIds.add(ticket.assignedToId);
        admins.forEach(admin => recipientIds.add(admin.id));

        for (const userId of recipientIds) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.SYSTEM,
                    category: NotificationCategory.CATEGORY_HARDWARE,
                    title,
                    message,
                    ticketId: ticket.id,
                    link: `/tickets/${ticket.id}`,
                });
            } catch (error) {
                this.logger.error(`Failed to send auto-resolve notification to ${userId}:`, error);
            }
        }
    }

    /**
     * Process D-1 reminders (1 day before installation)
     * Handles weekend/holiday: if tomorrow is installation but D-1 is weekend/holiday,
     * send notification on earlier business day
     */
    private async processD1Reminders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find installations scheduled for tomorrow or next business day after weekend
        const tickets = await this.findTicketsNeedingD1Reminder();

        if (tickets.length === 0) {
            this.logger.debug('No hardware installations needing D-1 reminder');
            return;
        }

        this.logger.log(`Found ${tickets.length} installations needing D-1 reminder`);

        for (const ticket of tickets) {
            await this.sendInstallationReminder(ticket, 'D-1');
            await this.markReminderSent(ticket.id, 'D1');
        }
    }

    /**
     * Process D-0 reminders (day of installation)
     */
    private async processD0Reminders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find installations scheduled for today
        const tickets = await this.ticketRepo.find({
            where: {
                isHardwareInstallation: true,
                scheduledDate: And(MoreThanOrEqual(today), LessThanOrEqual(tomorrow)),
                reminderD0Sent: false,
            },
            relations: ['user', 'assignedTo'],
        });

        if (tickets.length === 0) {
            this.logger.debug('No hardware installations scheduled for today');
            return;
        }

        this.logger.log(`Found ${tickets.length} installations scheduled for today`);

        for (const ticket of tickets) {
            await this.sendInstallationReminder(ticket, 'D-0');
            await this.markReminderSent(ticket.id, 'D0');
        }
    }

    /**
     * Find tickets that need D-1 reminder
     * Considers weekends and holidays
     */
    private async findTicketsNeedingD1Reminder(): Promise<Ticket[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check installations for tomorrow through next 3 days (cover weekends)
        const checkDates: Date[] = [];
        for (let i = 1; i <= 3; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);
            checkDates.push(checkDate);
        }

        // Get all potential tickets
        const endRange = new Date(today);
        endRange.setDate(endRange.getDate() + 4);

        const tickets = await this.ticketRepo.find({
            where: {
                isHardwareInstallation: true,
                scheduledDate: And(
                    MoreThanOrEqual(today),
                    LessThanOrEqual(endRange)
                ),
                reminderD1Sent: false,
            },
            relations: ['user', 'assignedTo'],
        });

        // Filter: only include tickets where today is the correct D-1 notification day
        const filteredTickets: Ticket[] = [];

        for (const ticket of tickets) {
            if (!ticket.scheduledDate) continue;

            const scheduledDate = new Date(ticket.scheduledDate);
            scheduledDate.setHours(0, 0, 0, 0);

            const notificationDay = await this.getD1NotificationDay(scheduledDate);

            // Check if today is the notification day
            if (this.isSameDay(today, notificationDay)) {
                filteredTickets.push(ticket);
            }
        }

        return filteredTickets;
    }

    /**
     * Get the day to send D-1 notification
     * If D-1 falls on weekend or holiday, find the previous business day
     */
    private async getD1NotificationDay(installationDate: Date): Promise<Date> {
        const d1 = new Date(installationDate);
        d1.setDate(d1.getDate() - 1);

        // Check if D-1 is a business day
        if (await this.isBusinessDay(d1)) {
            return d1;
        }

        // Find the previous business day
        let checkDate = new Date(d1);
        for (let i = 0; i < 7; i++) {
            checkDate.setDate(checkDate.getDate() - 1);
            if (await this.isBusinessDay(checkDate)) {
                return checkDate;
            }
        }

        // Fallback to D-1 if no business day found
        return d1;
    }

    /**
     * Check if a date is a business day (not weekend, not holiday)
     */
    private async isBusinessDay(date: Date): Promise<boolean> {
        const dayOfWeek = date.getDay();

        // Check weekend (0 = Sunday, 6 = Saturday)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }

        // Check holidays via BusinessHoursService
        try {
            const businessHours = await this.businessHoursService.getDefault();
            if (businessHours?.holidays && businessHours.holidays.length > 0) {
                const dateStr = date.toISOString().split('T')[0];
                // holidays is string[] format: ['2025-01-01', '2025-12-25', ...]
                const isHoliday = businessHours.holidays.includes(dateStr);
                if (isHoliday) {
                    return false;
                }
            }
        } catch (error) {
            this.logger.warn('Could not check holidays:', error);
        }

        return true;
    }

    private isSameDay(date1: Date, date2: Date): boolean {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    }

    /**
     * Send installation reminder to all relevant parties
     */
    private async sendInstallationReminder(ticket: Ticket, type: 'D-1' | 'D-0') {
        const isD0 = type === 'D-0';
        const urgency = isD0 ? '🔧 TODAY' : '📅 TOMORROW';
        const notificationType = isD0
            ? NotificationType.HARDWARE_INSTALL_D0
            : NotificationType.HARDWARE_INSTALL_D1;

        const scheduledDateStr = ticket.scheduledDate
            ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
            : 'Unknown';

        const title = `${urgency}: Hardware Installation - ${ticket.hardwareType || 'Equipment'}`;
        const message = `Hardware installation for ticket #${ticket.ticketNumber || ticket.id.substring(0, 8)} ` +
            `is scheduled for ${scheduledDateStr} at ${ticket.scheduledTime || 'TBD'}. ` +
            `Please ensure 2-4 hours availability for the installation.`;

        // Get all admins
        const admins = await this.userRepo.find({
            where: { role: UserRole.ADMIN, isActive: true }
        });

        // Collect notification recipients
        const recipientIds = new Set<string>();

        // 1. Ticket requester
        if (ticket.userId) {
            recipientIds.add(ticket.userId);
        }

        // 2. Assigned agent
        if (ticket.assignedToId) {
            recipientIds.add(ticket.assignedToId);
        }

        // 3. All admins
        admins.forEach(admin => recipientIds.add(admin.id));

        // Send notifications
        for (const userId of recipientIds) {
            try {
                await this.notificationService.create({
                    userId,
                    type: notificationType,
                    category: NotificationCategory.CATEGORY_HARDWARE,
                    title,
                    message,
                    ticketId: ticket.id,
                    link: `/tickets/${ticket.id}`,
                });
            } catch (error) {
                this.logger.error(`Failed to send notification to user ${userId}:`, error);
            }
        }

        this.logger.log(`Sent ${type} reminder for ticket ${ticket.id} to ${recipientIds.size} recipients`);
    }

    private async markReminderSent(ticketId: string, type: 'D1' | 'D0') {
        const update = type === 'D1'
            ? { reminderD1Sent: true }
            : { reminderD0Sent: true };

        await this.ticketRepo.update(ticketId, update);
    }

    // Manual trigger for testing
    async triggerReminderCheck() {
        await this.checkUpcomingInstallations();
    }
}
