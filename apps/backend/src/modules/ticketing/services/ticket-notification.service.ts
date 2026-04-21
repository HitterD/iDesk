import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';

import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { CustomerSession } from '../../users/entities/customer-session.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { TelegramService } from '../../telegram/telegram.service';
import { TelegramChatBridgeService } from '../../telegram/telegram-chat-bridge.service';

/**
 * Ticket Notification Service
 * Handles all notification logic for tickets (Email, Telegram, In-app)
 */
@Injectable()
export class TicketNotificationService {
    private readonly logger = new Logger(TicketNotificationService.name);
    private notificationService: NotificationService | null = null;

    constructor(
        @InjectRepository(CustomerSession)
        private readonly sessionRepo: Repository<CustomerSession>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly mailerService: MailerService,
        @Optional() @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
        @Optional() @Inject(forwardRef(() => TelegramChatBridgeService))
        private readonly telegramChatBridge: TelegramChatBridgeService,
    ) {}

    setNotificationService(notificationService: NotificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Notify ticket created
     */
    async notifyTicketCreated(ticket: Ticket, user: User): Promise<void> {
        if (!this.notificationService) return;

        try {
            await this.notificationService.notifyTicketCreated(
                user.id,
                ticket.id,
                ticket.ticketNumber || ticket.id.split('-')[0],
                ticket.title,
            );
        } catch (error) {
            this.logger.error('Failed to send ticket created notification:', error);
        }
    }

    /**
     * Notify ticket status update
     */
    async notifyTicketUpdate(ticket: Ticket, changes: string[]): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // In-app notification
        if (this.notificationService && ticket.user) {
            try {
                if (ticket.status === TicketStatus.RESOLVED) {
                    await this.notificationService.notifyTicketResolved(
                        ticket.user.id,
                        ticket.id,
                        ticketNumber,
                    );
                } else {
                    await this.notificationService.notifyTicketUpdated(
                        ticket.user.id,
                        ticket.id,
                        ticketNumber,
                        changes.join(', '),
                    );
                }
            } catch (error) {
                this.logger.error('Failed to send ticket update notification:', error);
            }
        }

        // Email notification
        if (ticket.user?.email) {
            await this.sendEmail(
                ticket.user.email,
                `Ticket Updated: #${ticket.id}`,
                'ticket-update',
                {
                    name: ticket.user.fullName,
                    ticketId: ticket.id,
                    status: ticket.status,
                    title: ticket.title,
                },
            );
        }

        // Telegram notification
        await this.sendTelegramStatusUpdate(ticket, changes);
    }

    /**
     * Notify ticket assigned
     */
    async notifyTicketAssigned(
        ticket: Ticket,
        assignee: User,
        assigner: User,
    ): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // In-app notification
        if (this.notificationService) {
            try {
                await this.notificationService.notifyTicketAssigned(
                    assignee.id,
                    ticket.id,
                    ticketNumber,
                    assigner.fullName,
                );
            } catch (error) {
                this.logger.error('Failed to send assignment notification:', error);
            }
        }

        // Email notification
        if (assignee.email) {
            await this.sendEmail(
                assignee.email,
                `Ticket Assigned to You: #${ticket.id}`,
                'ticket-update',
                {
                    name: assignee.fullName,
                    ticketId: ticket.id,
                    status: ticket.status,
                    title: ticket.title,
                    message: `You have been assigned to this ticket by ${assigner.fullName}.`,
                },
            );
        }
    }

    /**
     * Notify ticket reply
     */
    async notifyTicketReply(
        ticket: Ticket,
        message: TicketMessage,
        sender: User,
        mentionedUserIds: string[] = [],
    ): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // Handle mentions
        await this.handleMentions(ticket, sender, mentionedUserIds);

        // Notify appropriate parties based on sender role
        if (this.notificationService) {
            try {
                // Agent/Admin replied -> notify ticket owner
                if ((sender.role === UserRole.AGENT || sender.role === UserRole.ADMIN) 
                    && ticket.user && ticket.user.id !== sender.id) {
                    await this.notificationService.notifyTicketReply(
                        ticket.user.id,
                        ticket.id,
                        ticketNumber,
                        sender.fullName,
                    );
                }
                // User replied -> notify assigned agent
                if (sender.role === UserRole.USER && ticket.assignedTo && ticket.assignedTo.id !== sender.id) {
                    await this.notificationService.notifyTicketReply(
                        ticket.assignedTo.id,
                        ticket.id,
                        ticketNumber,
                        sender.fullName,
                    );
                }
            } catch (error) {
                this.logger.error('Failed to send reply notification:', error);
            }
        }

        // Telegram notification for agent reply
        if (this.telegramChatBridge && (sender.role === UserRole.AGENT || sender.role === UserRole.ADMIN)) {
            if (ticket.user && ticket.user.id !== sender.id) {
                try {
                    await this.telegramChatBridge.forwardAgentReplyToTelegram({
                        ticketId: ticket.id,
                        message,
                        sender,
                    });
                } catch (error) {
                    this.logger.error('Failed to send Telegram message:', error);
                }
            }
        }

        // Email notification for agent reply
        if ((sender.role === UserRole.AGENT || sender.role === UserRole.ADMIN) 
            && ticket.user?.email 
            && (!mentionedUserIds || !mentionedUserIds.includes(ticket.user.id))) {
            await this.sendEmail(
                ticket.user.email,
                `New Reply on Ticket #${ticket.id}`,
                'ticket-update',
                {
                    name: ticket.user.fullName,
                    ticketId: ticket.id,
                    status: ticket.status,
                    title: ticket.title,
                },
            );
        }
    }

    /**
     * Notify ticket cancelled
     */
    async notifyTicketCancelled(
        ticket: Ticket,
        canceller: User,
        cancellerRole: UserRole,
    ): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        if (!this.notificationService) return;

        try {
            // User cancelled -> notify assigned agent
            if (cancellerRole === UserRole.USER && ticket.assignedTo) {
                await this.notificationService.create({
                    userId: ticket.assignedTo.id,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Ticket #${ticketNumber} has been cancelled by ${canceller.fullName}`,
                    ticketId: ticket.id,
                });
            }
            // Admin/Agent cancelled -> notify ticket owner
            if ((cancellerRole === UserRole.ADMIN || cancellerRole === UserRole.AGENT) 
                && ticket.user.id !== canceller.id) {
                await this.notificationService.create({
                    userId: ticket.user.id,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Your ticket #${ticketNumber} has been cancelled by support`,
                    ticketId: ticket.id,
                });
            }
        } catch (error) {
            this.logger.error('Failed to send cancellation notification:', error);
        }
    }

    /**
     * Handle @mentions in messages
     */
    private async handleMentions(
        ticket: Ticket,
        sender: User,
        mentionedUserIds: string[],
    ): Promise<void> {
        if (!mentionedUserIds?.length) return;

        for (const mentionedUserId of mentionedUserIds) {
            if (mentionedUserId === sender.id) continue;

            const mentionedUser = await this.userRepo.findOne({ where: { id: mentionedUserId } });
            if (!mentionedUser) continue;

            // In-app notification
            if (this.notificationService) {
                try {
                    await this.notificationService.notifyMention(
                        mentionedUserId,
                        ticket.id,
                        ticket.ticketNumber || ticket.id.split('-')[0],
                        sender.fullName,
                    );
                } catch (error) {
                    this.logger.error('Failed to send mention notification:', error);
                }
            }

            // Email notification
            if (mentionedUser.email) {
                await this.sendEmail(
                    mentionedUser.email,
                    `You were mentioned in Ticket #${ticket.id}`,
                    'mention-notification',
                    {
                        name: mentionedUser.fullName,
                        ticketId: ticket.id,
                        mentionedBy: sender.fullName,
                        link: `http://localhost:5173/admin/tickets/${ticket.id}`,
                    },
                );
            }
        }
    }

    /**
     * Send Telegram status update
     */
    private async sendTelegramStatusUpdate(ticket: Ticket, changes: string[]): Promise<void> {
        if (!ticket.user || !this.telegramService) return;

        const session = await this.sessionRepo.findOne({ where: { userId: ticket.user.id } });
        if (!session) return;

        let emoji = 'ℹ️';
        if (ticket.status === TicketStatus.RESOLVED) emoji = '✅';
        if (ticket.status === TicketStatus.IN_PROGRESS) emoji = '🚧';

        const msg = `${emoji} **Status Tiket Diperbarui**\n\n🆔 #${ticket.id.split('-')[0]}\n📌 ${ticket.title}\nSTAT: ${ticket.status}\n\n${changes.join('\n')}`;
        await this.telegramService.sendNotification(session.telegramId, msg);
    }

    /**
     * Send email with error handling
     */
    private async sendEmail(
        to: string,
        subject: string,
        template: string,
        context: Record<string, any>,
    ): Promise<void> {
        try {
            await this.mailerService.sendMail({ to, subject, template, context });
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error);
        }
    }
}
