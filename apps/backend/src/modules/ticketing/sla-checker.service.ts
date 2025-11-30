import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
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
     */
    private async checkResolutionSla(): Promise<void> {
        const now = new Date();

        // Get tickets that have SLA started and not yet marked as overdue
        const tickets = await this.ticketRepo.find({
            where: {
                status: In([TicketStatus.IN_PROGRESS, TicketStatus.TODO]),
                isOverdue: false,
                slaTarget: Not(IsNull()),
                slaStartedAt: Not(IsNull()),
            },
            relations: ['user', 'assignedTo'],
        });

        for (const ticket of tickets) {
            // Skip if waiting vendor (SLA is paused)
            if (ticket.status === TicketStatus.WAITING_VENDOR) continue;

            // Skip if no SLA target
            if (!ticket.slaTarget) continue;

            const targetTime = new Date(ticket.slaTarget);

            if (now > targetTime) {
                this.logger.warn(`Ticket #${ticket.ticketNumber || ticket.id} is OVERDUE!`);

                ticket.isOverdue = true;
                await this.ticketRepo.save(ticket);

                await this.sendOverdueNotifications(ticket, 'resolution');
            }
        }
    }

    /**
     * Check First Response Time SLA
     * Checks tickets that haven't received first response yet
     */
    private async checkFirstResponseSla(): Promise<void> {
        const now = new Date();

        // Get tickets waiting for first response
        const tickets = await this.ticketRepo.find({
            where: {
                firstResponseAt: IsNull(),
                firstResponseTarget: Not(IsNull()),
                isFirstResponseBreached: false,
                status: Not(In([TicketStatus.RESOLVED, TicketStatus.CANCELLED])),
            },
            relations: ['user', 'assignedTo'],
        });

        for (const ticket of tickets) {
            // Skip if waiting vendor (SLA is paused)
            if (ticket.status === TicketStatus.WAITING_VENDOR) continue;

            // Skip if no first response target
            if (!ticket.firstResponseTarget) continue;

            const targetTime = new Date(ticket.firstResponseTarget);

            if (now > targetTime) {
                this.logger.warn(`First Response SLA Breached for ticket #${ticket.ticketNumber || ticket.id}`);

                ticket.isFirstResponseBreached = true;
                await this.ticketRepo.save(ticket);

                await this.sendOverdueNotifications(ticket, 'first_response');
            }
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

        // 1. Email to Admin
        const adminEmail = 'admin@antigravity.com';
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
