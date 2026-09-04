import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TicketReminder } from '../entities/ticket-reminder.entity';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';

@Injectable()
export class TicketReminderSchedulerService {
    private readonly logger = new Logger(TicketReminderSchedulerService.name);
    private isRunning = false;

    constructor(
        @InjectRepository(TicketReminder)
        private readonly reminderRepo: Repository<TicketReminder>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        private readonly mailDispatch: MailDispatchService,
        private readonly configService: ConfigService,
    ) {}

    @Cron('*/1 * * * *', { timeZone: 'Asia/Jakarta', name: 'ticket-reminder-check' })
    async handleScheduledReminders(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        try {
            const now = new Date();
            const pendingReminders = await this.reminderRepo.find({
                where: {
                    isSent: false,
                    remindAt: LessThanOrEqual(now),
                },
                relations: ['ticket', 'ticket.assignedTo', 'createdBy'],
                take: 50,
            });

            if (pendingReminders.length === 0) {
                return;
            }

            this.logger.log(`Found ${pendingReminders.length} pending ticket reminder(s) to process`);

            for (const reminder of pendingReminders) {
                await this.processReminder(reminder);
            }
        } catch (error) {
            this.logger.error(
                `Error processing scheduled reminders: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
        } finally {
            this.isRunning = false;
        }
    }

    private async processReminder(reminder: TicketReminder): Promise<void> {
        try {
            const ticket = reminder.ticket;
            if (!ticket) {
                this.logger.warn(`Reminder ${reminder.id} has no associated ticket. Marking as sent.`);
                reminder.isSent = true;
                reminder.sentAt = new Date();
                await this.reminderRepo.save(reminder);
                return;
            }

            // If ticket is already cancelled or resolved, we can mark as sent and skip email, or still notify
            if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.RESOLVED) {
                this.logger.log(`Ticket #${ticket.ticketNumber || ticket.id} is already ${ticket.status}. Skipping reminder email.`);
                reminder.isSent = true;
                reminder.sentAt = new Date();
                await this.reminderRepo.save(reminder);
                return;
            }

            const assignedAgent = ticket.assignedTo;
            if (!assignedAgent || !assignedAgent.email) {
                this.logger.warn(
                    `Ticket #${ticket.ticketNumber || ticket.id} has no assigned agent with email. Skipping email dispatch.`,
                );
                reminder.isSent = true;
                reminder.sentAt = new Date();
                await this.reminderRepo.save(reminder);
                return;
            }

            const link = buildAppUrl(`/tickets/${ticket.id}`);
            const remindAtFormatted = this.formatDateTime(reminder.remindAt);

            const mailResult = await this.mailDispatch.send({
                to: assignedAgent.email,
                subject: `[Pengingat Tiket] #${ticket.ticketNumber || ticket.id.slice(0, 8)}: ${ticket.title}`,
                template: 'ticket-reminder',
                context: {
                    ticketNumber: ticket.ticketNumber || ticket.id.slice(0, 8),
                    ticketId: ticket.id,
                    title: ticket.title,
                    agentName: assignedAgent.fullName || 'Agent',
                    creatorName: reminder.createdBy?.fullName || 'System',
                    status: ticket.status,
                    priority: ticket.priority,
                    remindAtFormatted,
                    note: reminder.note || undefined,
                    link,
                    year: new Date().getFullYear(),
                },
            });

            // Add system timeline message
            const noteText = reminder.note ? ` Catatan: "${reminder.note}"` : '';
            const timelineMessage = this.messageRepo.create({
                content: `🔔 **Pengingat Tiket Terkirim**: Email pengingat jadwal (${remindAtFormatted}) telah dikirimkan ke agent ${assignedAgent.fullName} (${assignedAgent.email}).${noteText}`,
                ticket: ticket,
                senderId: reminder.createdById || assignedAgent.id,
                isSystemMessage: true,
            });
            await this.messageRepo.save(timelineMessage);

            reminder.isSent = true;
            reminder.sentAt = new Date();
            await this.reminderRepo.save(reminder);

            this.logger.log(
                `Successfully processed reminder ${reminder.id} for ticket ${ticket.ticketNumber || ticket.id} -> sent to ${assignedAgent.email} (queued: ${Boolean((mailResult as any)?.queued)})`,
            );
        } catch (err: any) {
            this.logger.error(
                `Failed to process reminder ${reminder.id}: ${err?.message || err}`,
                err instanceof Error ? err.stack : undefined,
            );
        }
    }

    private formatDateTime(date: Date): string {
        try {
            return new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date(date)) + ' WIB';
        } catch {
            return new Date(date).toLocaleString('id-ID') + ' WIB';
        }
    }
}
