import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCreatedEvent } from '../events/ticket-created.event';
import { TicketUpdatedEvent } from '../events/ticket-updated.event';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { TicketCancelledEvent } from '../events/ticket-cancelled.event';
import { NotificationService } from '../../notifications/notification.service';
import { MailerService } from '@nestjs-modules/mailer';
import { TelegramService } from '../../telegram/telegram.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus } from '../entities/ticket.entity';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { TelegramChatBridgeService } from '../../telegram/telegram-chat-bridge.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class TicketNotificationListener {
    private readonly logger = new Logger(TicketNotificationListener.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly mailerService: MailerService,
        private readonly telegramService: TelegramService,
        private readonly telegramChatBridge: TelegramChatBridgeService,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    @OnEvent('ticket.created')
    async handleTicketCreatedEvent(event: TicketCreatedEvent) {
        this.logger.log(`Handling ticket.created event for ticket ${event.ticketId}`);

        // 1. Notify Requester (In-App)
        try {
            await this.notificationService.notifyTicketCreated(
                event.userId,
                event.ticketId,
                event.ticketNumber,
                event.title,
            );
        } catch (error) {
            this.logger.error('Failed to send ticket created notification', error);
        }

        // 2. Notify Admins (In-App)
        try {
            const adminAgents = await this.userRepo.find({
                where: [
                    { role: UserRole.ADMIN },
                    { role: UserRole.AGENT },
                ],
            });
            const adminIds = adminAgents.map(a => a.id);

            await this.notificationService.notifyNewTicketToAdmins(
                event.ticketId,
                event.ticketNumber,
                event.title,
                event.priority,
                event.category,
                event.userFullName,
                adminIds,
            );
        } catch (error) {
            this.logger.error('Failed to notify admins about new ticket', error);
        }
    }

    @OnEvent('ticket.updated')
    async handleTicketUpdatedEvent(event: TicketUpdatedEvent) {
        this.logger.log(`Handling ticket.updated event for ticket ${event.ticketId}`);
        const { ticket, changes } = event;
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // 1. In-App Notification
        if (ticket.user) {
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
                this.logger.error('Failed to send ticket update notification', error);
            }
        }

        // 2. Email Notification
        if (ticket.user && ticket.user.email) {
            try {
                await this.mailerService.sendMail({
                    to: ticket.user.email,
                    subject: `Ticket Updated: #${ticketNumber}`,
                    template: 'ticket-update',
                    context: {
                        name: ticket.user.fullName,
                        ticketId: ticket.id,
                        status: ticket.status,
                        title: ticket.title,
                    },
                });
            } catch (error) {
                this.logger.error(`Failed to send ticket update email to ${ticket.user.email}`, error);
            }
        }

        // 3. Telegram Notification
        if (ticket.user) {
            try {
                let updateType = 'STATUS_CHANGED';
                if (ticket.status === TicketStatus.RESOLVED) updateType = 'RESOLVED';
                else if (ticket.status === TicketStatus.IN_PROGRESS) updateType = 'STATUS_CHANGED';

                await this.telegramService.notifyTicketUpdate(ticket.user.id, ticket, updateType);
            } catch (error) {
                this.logger.error('Failed to send Telegram notification', error);
            }
        }
    }

    @OnEvent('ticket.assigned')
    async handleTicketAssignedEvent(event: TicketAssignedEvent) {
        this.logger.log(`Handling ticket.assigned event for ticket ${event.ticketId}`);

        // 1. In-App Notification
        try {
            await this.notificationService.notifyTicketAssigned(
                event.assigneeId,
                event.ticketId,
                event.ticketNumber,
                event.assignerName,
            );
        } catch (error) {
            this.logger.error('Failed to send assignment notification', error);
        }

        // 2. Email Notification
        if (event.assigneeEmail) {
            try {
                await this.mailerService.sendMail({
                    to: event.assigneeEmail,
                    subject: `Ticket Assigned to You: #${event.ticketNumber}`,
                    template: 'ticket-update',
                    context: {
                        name: event.assigneeName,
                        ticketId: event.ticketId,
                        status: event.ticketStatus,
                        title: event.ticketTitle,
                        message: `You have been assigned to this ticket by ${event.assignerName}.`,
                    },
                });
            } catch (error) {
                this.logger.error(`Failed to send assignment email to ${event.assigneeEmail}`, error);
            }
        }
    }

    @OnEvent('ticket.replied')
    async handleTicketRepliedEvent(event: TicketRepliedEvent) {
        this.logger.log(`Handling ticket.replied event for ticket ${event.ticketId}`);

        // 1. Handle Mentions
        if (event.mentionedUserIds && event.mentionedUserIds.length > 0) {
            for (const mentionedUserId of event.mentionedUserIds) {
                if (mentionedUserId === event.senderId) continue;

                const mentionedUser = await this.userRepo.findOne({ where: { id: mentionedUserId } });
                if (mentionedUser) {
                    // In-app notification
                    try {
                        await this.notificationService.notifyMention(
                            mentionedUserId,
                            event.ticketId,
                            event.ticketNumber,
                            event.senderName,
                        );
                    } catch (error) {
                        this.logger.error('Failed to send mention notification', error);
                    }

                    // Email notification
                    if (mentionedUser.email) {
                        try {
                            await this.mailerService.sendMail({
                                to: mentionedUser.email,
                                subject: `You were mentioned in Ticket #${event.ticketNumber}`,
                                template: 'mention-notification',
                                context: {
                                    name: mentionedUser.fullName,
                                    ticketId: event.ticketId,
                                    mentionedBy: event.senderName,
                                    link: `http://localhost:5173/admin/tickets/${event.ticketId}`,
                                },
                            });
                        } catch (error) {
                            this.logger.error(`Failed to send mention email to ${mentionedUser.email}`, error);
                        }
                    }
                }
            }
        }

        // 2. In-App Notification for Reply
        try {
            // Notify ticket owner if agent/admin replies
            if ((event.senderRole === UserRole.AGENT || event.senderRole === UserRole.ADMIN) && event.ticketOwnerId !== event.senderId) {
                await this.notificationService.notifyTicketReply(
                    event.ticketOwnerId,
                    event.ticketId,
                    event.ticketNumber,
                    event.senderName,
                );
            }
            // Notify assigned agent if requester replies
            if (event.senderRole === UserRole.USER && event.ticketAssignedToId && event.ticketAssignedToId !== event.senderId) {
                await this.notificationService.notifyTicketReply(
                    event.ticketAssignedToId,
                    event.ticketId,
                    event.ticketNumber,
                    event.senderName,
                );
            }
        } catch (error) {
            this.logger.error('Failed to send reply notification', error);
        }

        // 3. Telegram Notification (Forward Agent Reply)
        if (this.telegramChatBridge && (event.senderRole === UserRole.AGENT || event.senderRole === UserRole.ADMIN)) {
            if (event.ticketOwnerId !== event.senderId) {
                try {
                    const sender = await this.userRepo.findOne({ where: { id: event.senderId } });
                    if (sender) {
                        await this.telegramChatBridge.forwardAgentReplyToTelegram({
                            ticketId: event.ticketId,
                            message: event.message,
                            sender: sender,
                        });
                    }
                } catch (error) {
                    this.logger.error('Failed to send Telegram message', error);
                }
            }
        }

        // 4. Email Notification
        if (event.senderRole === UserRole.AGENT || event.senderRole === UserRole.ADMIN) {
            if (event.ticketOwnerEmail && (!event.mentionedUserIds || !event.mentionedUserIds.includes(event.ticketOwnerId))) {
                try {
                    await this.mailerService.sendMail({
                        to: event.ticketOwnerEmail,
                        subject: `New Reply on Ticket #${event.ticketNumber}`,
                        template: 'ticket-update',
                        context: {
                            name: event.ticketOwnerName,
                            ticketId: event.ticketId,
                            status: event.ticketStatus,
                            title: event.ticketTitle,
                        },
                    });
                } catch (error) {
                    this.logger.error(`Failed to send reply email to ${event.ticketOwnerEmail}`, error);
                }
            }
        }
    }

    @OnEvent('ticket.cancelled')
    async handleTicketCancelledEvent(event: TicketCancelledEvent) {
        this.logger.log(`Handling ticket.cancelled event for ticket ${event.ticketId}`);

        try {
            // If user cancelled, notify assigned agent
            if (event.userRole === UserRole.USER && event.ticketAssignedToId) {
                await this.notificationService.create({
                    userId: event.ticketAssignedToId,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Ticket #${event.ticketNumber} has been cancelled by ${event.userFullName}`,
                    ticketId: event.ticketId,
                });
            }
            // If admin/agent cancelled, notify ticket owner
            if ((event.userRole === UserRole.ADMIN || event.userRole === UserRole.AGENT) && event.ticketOwnerId !== event.userId) {
                await this.notificationService.create({
                    userId: event.ticketOwnerId,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Your ticket #${event.ticketNumber} has been cancelled by support`,
                    ticketId: event.ticketId,
                });
            }
        } catch (error) {
            this.logger.error('Failed to send cancellation notification', error);
        }
    }
}
