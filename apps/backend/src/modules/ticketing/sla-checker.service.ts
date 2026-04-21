import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { MailerService } from '@nestjs-modules/mailer';

import { CustomerSession } from '../users/entities/customer-session.entity';
import { SlaConfigService } from './sla-config.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SlaCheckerService {
    private readonly logger = new Logger(SlaCheckerService.name);

    constructor(
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        @InjectRepository(CustomerSession)
        private sessionRepo: Repository<CustomerSession>,
        private readonly mailerService: MailerService,
        private readonly slaConfigService: SlaConfigService,
        private readonly configService: ConfigService,
        @Optional() @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
    ) { }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async checkSla() {
        this.logger.log('Running SLA Checker (Resolution + First Response)...');

        // === Check Resolution Time SLA ===
        await this.checkResolutionSla();

        // === Check First Response SLA ===

        await this.checkFirstResponseSla();

        this.logger.log('SLA Checker completed.');
    }

    /**
     * Check Resolution Time SLA
     * Only checks tickets where SLA has started (slaStartedAt is set)
     * 
     * OPTIMIZED: Uses batch UPDATE instead of individual saves
     * Before: N queries for N overdue tickets
     * After: 2 queries (1 batch UPDATE + 1 SELECT for notifications)
     */
    private async checkResolutionSla(): Promise<void> {
        const now = new Date();

        // Step 1: Find tickets that are now overdue (in DB, not in app)
        const overdueTickets = await this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.status IN (:...statuses)', {
                statuses: [TicketStatus.IN_PROGRESS, TicketStatus.TODO]
            })
            .andWhere('ticket."isOverdue" = false')
            .andWhere('ticket."slaTarget" IS NOT NULL')
            .andWhere('ticket."slaStartedAt" IS NOT NULL')
            .andWhere('ticket."slaTarget" < :now', { now })
            .andWhere('ticket.status != :waitingVendor', { waitingVendor: TicketStatus.WAITING_VENDOR })
            .getMany();

        if (overdueTickets.length === 0) {
            return;
        }

        // Step 2: Batch UPDATE all overdue tickets in a single query
        const overdueIds = overdueTickets.map(t => t.id);
        await this.ticketRepo
            .createQueryBuilder()
            .update(Ticket)
            .set({ isOverdue: true })
            .where('id IN (:...ids)', { ids: overdueIds })
            .execute();

        this.logger.warn(`Marked ${overdueTickets.length} tickets as OVERDUE (batch update)`);

        // Step 3: Send notifications (async, non-blocking)
        for (const ticket of overdueTickets) {
            this.logger.warn(`Ticket #${ticket.ticketNumber || ticket.id} is OVERDUE!`);
            // Send notification without awaiting to avoid blocking
            this.sendOverdueNotifications(ticket, 'resolution').catch(err => {
                this.logger.error(`Failed to send overdue notification for ticket ${ticket.id}: ${err.message}`);
            });
        }
    }

    /**
     * Check First Response Time SLA
     * Checks tickets that haven't received first response yet
     * 
     * OPTIMIZED: Uses batch UPDATE instead of individual saves
     * Before: N queries for N breached tickets
     * After: 2 queries (1 batch UPDATE + 1 SELECT for notifications)
     */
    private async checkFirstResponseSla(): Promise<void> {
        const now = new Date();

        // Step 1: Find tickets with breached first response SLA (in DB, not in app)
        const breachedTickets = await this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket."firstResponseAt" IS NULL')
            .andWhere('ticket."firstResponseTarget" IS NOT NULL')
            .andWhere('ticket."isFirstResponseBreached" = false')
            .andWhere('ticket.status NOT IN (:...excludedStatuses)', {
                excludedStatuses: [TicketStatus.RESOLVED, TicketStatus.CANCELLED, TicketStatus.WAITING_VENDOR]
            })
            .andWhere('ticket."firstResponseTarget" < :now', { now })
            .getMany();

        if (breachedTickets.length === 0) {
            return;
        }

        // Step 2: Batch UPDATE all breached tickets in a single query
        const breachedIds = breachedTickets.map(t => t.id);
        await this.ticketRepo
            .createQueryBuilder()
            .update(Ticket)
            .set({ isFirstResponseBreached: true })
            .where('id IN (:...ids)', { ids: breachedIds })
            .execute();

        this.logger.warn(`Marked ${breachedTickets.length} tickets as First Response SLA Breached (batch update)`);

        // Step 3: Send notifications (async, non-blocking)
        for (const ticket of breachedTickets) {
            this.logger.warn(`First Response SLA Breached for ticket #${ticket.ticketNumber || ticket.id}`);
            this.sendOverdueNotifications(ticket, 'first_response').catch(err => {
                this.logger.error(`Failed to send first response breach notification for ticket ${ticket.id}: ${err.message}`);
            });
        }
    }

    /**
     * Send SLA breach notifications
     */
    private async sendOverdueNotifications(ticket: Ticket, type: 'resolution' | 'first_response'): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
        const subject = type === 'resolution'
            ? `⚠️ SLA BREACH: Ticket #${ticketNumber} Overdue!`
            : `⚠️ FIRST RESPONSE SLA BREACH: Ticket #${ticketNumber}`;

        const message = type === 'resolution'
            ? `Ticket #${ticketNumber} has exceeded its resolution time SLA.`
            : `Ticket #${ticketNumber} has not received first response within SLA.`;

        // 1. Email to Admin (externalized configuration)
        const adminEmail = this.configService.get<string>('SLA_ADMIN_EMAIL', 'admin@idesk.com');
        try {
            await this.mailerService.sendMail({
                to: adminEmail,
                subject,
                html: `
                    <h1>${type === 'resolution' ? 'SLA Breach Alert' : 'First Response SLA Alert'}</h1>
                    <p>${message}</p>
                    <ul>
                        <li><strong>Ticket:</strong> #${ticketNumber}</li>
                        <li><strong>Title:</strong> ${ticket.title}</li>
                        <li><strong>Priority:</strong> ${ticket.priority}</li>
                        <li><strong>Status:</strong> ${ticket.status}</li>
                        <li><strong>Assigned To:</strong> ${ticket.assignedTo?.fullName || 'Unassigned'}</li>
                        <li><strong>Created:</strong> ${ticket.createdAt}</li>
                        ${ticket.slaStartedAt ? `<li><strong>SLA Started:</strong> ${ticket.slaStartedAt}</li>` : ''}
                        ${ticket.slaTarget ? `<li><strong>SLA Target:</strong> ${ticket.slaTarget}</li>` : ''}
                    </ul>
                    <p style="color: red; font-weight: bold;">Please take immediate action.</p>
                `,
            });
            this.logger.log(`SLA breach email sent to ${adminEmail}`);
        } catch (e) {
            this.logger.error(`Failed to send SLA email: ${e.message}`);
        }

        // 2. Telegram notification to assigned agent
        if (this.telegramService && ticket.assignedTo) {
            try {
                const session = await this.sessionRepo.findOne({
                    where: { userId: ticket.assignedTo.id }
                });

                if (session?.telegramId) {
                    const emoji = type === 'resolution' ? '🚨' : '⚠️';
                    const telegramMsg =
                        `${emoji} <b>${type === 'resolution' ? 'SLA OVERDUE' : 'First Response SLA Breach'}</b>\n\n` +
                        `Tiket #${ticketNumber}\n` +
                        `📌 ${ticket.title}\n` +
                        `Priority: ${ticket.priority}\n\n` +
                        `<b>Segera tindak lanjuti tiket ini!</b>`;

                    await this.telegramService.sendNotification(session.telegramId, telegramMsg);
                    this.logger.log(`SLA breach Telegram notification sent to agent ${ticket.assignedTo.fullName}`);
                }
            } catch (error) {
                this.logger.error(`Failed to send Telegram notification: ${error.message}`);
            }
        }

        // 3. Log for monitoring
        this.logger.log(`[SLA BREACH] Type: ${type}, Ticket: #${ticketNumber}, Priority: ${ticket.priority}`);
    }
}
