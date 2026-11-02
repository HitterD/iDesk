import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';

import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

/**
 * Ticket Notification Service
 * Handles all notification logic for tickets (Email, In-app)
 */
@Injectable()
export class TicketNotificationService {
    private readonly logger = new Logger(TicketNotificationService.name);
    private notificationService: NotificationService | null = null;

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly mailDispatch: MailDispatchService,
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
     * Send email with error handling
     */
    private async sendEmail(
        to: string,
        subject: string,
        template: string,
        context: Record<string, any>,
    ): Promise<void> {
        try {
            await this.mailDispatch.send({ to, subject, template, context });
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error);
        }
    }
}
