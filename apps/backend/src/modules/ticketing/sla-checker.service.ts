import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { MailerService } from '@nestjs-modules/mailer';

import { CustomerSession } from '../users/entities/customer-session.entity';
import { SlaConfigService } from './sla-config.service';

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
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async checkSla() {
        this.logger.log('Running SLA Checker...');

        const configs = await this.slaConfigService.findAll();
        const configMap = new Map(configs.map(c => [c.priority, c.resolutionTimeMinutes]));

        const tickets = await this.ticketRepo.find({
            where: [
                { status: TicketStatus.TODO },
                { status: TicketStatus.IN_PROGRESS },
                { status: TicketStatus.WAITING_VENDOR },
            ],
            relations: ['user'],
        });

        const now = new Date();

        for (const ticket of tickets) {
            const createdAt = new Date(ticket.createdAt);
            const diffMs = now.getTime() - createdAt.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            const thresholdMinutes = configMap.get(ticket.priority) || 1440; // Default 24h if not found

            if (diffMinutes > thresholdMinutes && !ticket.isOverdue) {
                this.logger.warn(`Ticket #${ticket.id} is OVERDUE!`);

                // 1. Mark as Overdue
                ticket.isOverdue = true;
                await this.ticketRepo.save(ticket);

                // 2. Send Notifications
                await this.sendOverdueNotifications(ticket);
            }
        }
    }

    private async sendOverdueNotifications(ticket: Ticket) {
        // 1. Email to Manager (Mocked as Admin for now, or hardcoded)
        // In a real app, we'd fetch the manager of the department or a specific admin email
        const adminEmail = 'admin@antigravity.com'; // Fallback

        try {
            await this.mailerService.sendMail({
                to: adminEmail,
                subject: `⚠️ SLA BREACH: Ticket #${ticket.id.split('-')[0]}`,
                html: `
                    <h1>SLA Breach Alert</h1>
                    <p>Ticket <strong>#${ticket.id}</strong> is overdue.</p>
                    <ul>
                        <li><strong>Title:</strong> ${ticket.title}</li>
                        <li><strong>Priority:</strong> ${ticket.priority}</li>
                        <li><strong>Status:</strong> ${ticket.status}</li>
                        <li><strong>Created At:</strong> ${ticket.createdAt}</li>
                    </ul>
                    <p>Please take immediate action.</p>
                `,
            });
        } catch (e) {
            this.logger.error(`Failed to send SLA email: ${e.message}`);
        }

        // 2. Telegram Notification (if we have a group chat ID or just notify the user for now)
        // Ideally, this goes to an IT Support Group. 
        // For this demo, we'll try to notify the user themselves if they have a session, or just log it.
        // OR, if we had a configured "Support Group ID", we'd use that.
        // Let's try to find ANY session to send a debug alert, or skip if no generic channel.

        // NOTE: In a real scenario, we would store a specific Chat ID for alerts.
        // For now, let's skip sending to a random user to avoid confusion, 
        // unless we want to notify the ticket creator that their ticket is taking longer than expected?
        // The requirement says: "Kirim Notifikasi Telegram ke Group IT Support".
        // Since we don't have a hardcoded Group ID, I will log this limitation.
        this.logger.log(`[TELEGRAM] ⚠️ ALERT: Tiket #${ticket.id.split('-')[0]} Overdue! (Configure Group ID to send real msg)`);
    }
}
