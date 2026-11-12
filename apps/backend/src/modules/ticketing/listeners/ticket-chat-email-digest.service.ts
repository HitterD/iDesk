import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification, NotificationType } from '../../notifications/entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';
import { runOncePerPeriod } from '../../../shared/core/utils/run-exclusive';
import { ticketLinkFor } from './ticket-chat-push.listener';

/** A chat notice still unread this long is worth an email. */
export const CHAT_EMAIL_DELAY_MS = 15 * 60_000;
/** At most one chat email per ticket per person in this window. */
export const CHAT_EMAIL_INTERVAL_MS = 60 * 60_000;
const BATCH = 200;
const RUN_EVERY_MS = 5 * 60_000;

/**
 * Chat email without spam: instead of one email per message, people who have not read a ticket's new messages
 * within CHAT_EMAIL_DELAY_MS get one summary email, at most once per CHAT_EMAIL_INTERVAL_MS per ticket.
 * Reading the ticket marks the grouped notification read, which stops the email.
 */
@Injectable()
export class TicketChatEmailDigestService {
    private readonly logger = new Logger(TicketChatEmailDigestService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly mailDispatch: MailDispatchService,
        private readonly dataSource: DataSource,
    ) { }

    @Cron('*/5 * * * *', { timeZone: 'Asia/Jakarta', name: 'ticket-chat-email-digest' })
    async run(now: Date = new Date()): Promise<number> {
        const slot = String(Math.floor(now.getTime() / RUN_EVERY_MS));
        try {
            return (await runOncePerPeriod(this.dataSource, 'ticket-chat-email-digest', slot, () => this.sendDue(now))) ?? 0;
        } catch (error) {
            this.logger.error(`Chat email digest failed: ${(error as Error).message}`);
            return 0;
        }
    }

    async sendDue(now: Date): Promise<number> {
        const due = await this.notificationRepo.createQueryBuilder('n')
            .where('n.type = :type', { type: NotificationType.TICKET_REPLY })
            .andWhere('n.isRead = false')
            .andWhere('n.ticketId IS NOT NULL')
            .andWhere('n.createdAt <= :readBy', { readBy: new Date(now.getTime() - CHAT_EMAIL_DELAY_MS) })
            .andWhere('(n.emailedAt IS NULL OR n.emailedAt <= :again)', { again: new Date(now.getTime() - CHAT_EMAIL_INTERVAL_MS) })
            // Emailed already and nothing newer since: wait for the next message.
            .andWhere('(n.emailedAt IS NULL OR n.createdAt > n.emailedAt)')
            .orderBy('n.createdAt', 'ASC')
            .take(BATCH)
            .getMany();
        if (due.length === 0) return 0;

        const users = await this.userRepo.findByIds([...new Set(due.map(n => n.userId))]);
        const byId = new Map(users.map(u => [u.id, u]));
        let sent = 0;
        for (const notification of due) {
            const user = byId.get(notification.userId);
            // Mark first, so a slow or failing mail server never makes the next run send it again.
            await this.notificationRepo.update({ id: notification.id }, { emailedAt: now });
            if (!user?.email || user.isActive === false) continue;
            try {
                await this.mailDispatch.send({
                    to: user.email,
                    subject: notification.title,
                    template: 'notification',
                    context: {
                        title: 'Pesan belum dibaca',
                        message: `${notification.message}\n\nBuka tiket untuk membaca dan membalas.`,
                        link: buildAppUrl(ticketLinkFor(user.role, notification.ticketId!)),
                        year: now.getFullYear(),
                    },
                });
                sent++;
            } catch (error) {
                this.logger.warn(`Chat email to ${user.id} failed: ${(error as Error).message}`);
            }
        }
        return sent;
    }
}
