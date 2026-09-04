import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TicketCreatedEvent } from '../events/ticket-created.event';
import { TicketUpdatedEvent } from '../events/ticket-updated.event';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { TicketCancelledEvent } from '../events/ticket-cancelled.event';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';
import { TelegramService } from '../../telegram/telegram.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus } from '../entities/ticket.entity';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { TelegramChatBridgeService } from '../../telegram/telegram-chat-bridge.service';
import { User } from '../../users/entities/user.entity';
import { NotificationPreference } from '../../notifications/entities/notification-preference.entity';
import {
    isMobileDevCategory,
    isWebDevCategory,
    isOracleDevCategory,
} from '../utils/oracle-ticket-access.util';

@Injectable()
export class TicketNotificationListener {
    private readonly logger = new Logger(TicketNotificationListener.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly notificationCenterService: NotificationCenterService,
        private readonly mailDispatch: MailDispatchService,
        private readonly telegramService: TelegramService,
        private readonly telegramChatBridge: TelegramChatBridgeService,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(NotificationPreference)
        private readonly prefRepo: Repository<NotificationPreference>,
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
            this.logger.error('Failed to send ticket created notification to requester', error);
        }

        // 2. Notify Agents (In-App & Email) precisely based on ticket category / team
        try {
            let targetAgents: User[] = [];
            let emailSubjectPrefix = 'Tiket Baru';
            let teamName = 'Operational Support';

            if (isMobileDevCategory(event.category, event.ticketType)) {
                // Mobile Dev Request: Notify AGENT_MOBILE_DEV only
                targetAgents = await this.userRepo.find({
                    where: { role: UserRole.AGENT_MOBILE_DEV as any, isActive: true },
                });
                emailSubjectPrefix = 'Permintaan Mobile Dev Baru';
                teamName = 'Mobile Developer';
            } else if (isWebDevCategory(event.category, event.ticketType)) {
                // Web Dev Request: Notify AGENT_ORACLE
                targetAgents = await this.userRepo.find({
                    where: { role: UserRole.AGENT_ORACLE as any, isActive: true },
                });
                emailSubjectPrefix = 'Permintaan Web Dev Baru';
                teamName = 'Web Developer';
            } else if (isOracleDevCategory(event.category, event.ticketType)) {
                // Oracle / K2 Request: Notify AGENT_ORACLE and AGENT_MOBILE_DEV
                targetAgents = await this.userRepo.find({
                    where: [
                        { role: UserRole.AGENT_ORACLE as any, isActive: true },
                        { role: UserRole.AGENT_MOBILE_DEV as any, isActive: true },
                    ] as any,
                });
                emailSubjectPrefix = 'Permintaan Oracle/K2 Baru';
                teamName = 'Oracle & Mobile Developer';
            } else {
                // General / IT Support: Notify AGENT_OPERATIONAL_SUPPORT (scoped to ticket siteId or cross-site)
                targetAgents = event.siteId
                    ? await this.userRepo.find({
                        where: [
                            { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId: event.siteId, isActive: true },
                            { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId: IsNull(), isActive: true },
                        ] as any,
                    })
                    : await this.userRepo.find({
                        where: { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, isActive: true },
                    });
                emailSubjectPrefix = 'Tiket Baru';
                teamName = 'Operational Support';
            }

            const agentIds = targetAgents.map(a => a.id);

            if (agentIds.length > 0) {
                await this.notificationService.notifyNewTicketToAdmins(
                    event.ticketId,
                    event.ticketNumber,
                    event.title,
                    event.priority,
                    event.category,
                    event.userFullName,
                    agentIds,
                );
            }

            const emailContext = {
                title: emailSubjectPrefix,
                message: `Tiket baru #${event.ticketNumber} (${event.title}) diajukan oleh ${event.userFullName} dan menunggu penanganan tim ${teamName}.`,
                ticketId: event.ticketNumber,
                link: buildAppUrl(`/tickets/${event.ticketId}`),
                year: new Date().getFullYear(),
            };

            await Promise.all(
                targetAgents
                    .filter(a => !!a.email)
                    .map(a =>
                        this.mailDispatch.send({
                            to: a.email,
                            subject: `${emailSubjectPrefix}: #${event.ticketNumber} - ${event.title}`,
                            template: 'notification',
                            context: emailContext,
                        }).catch(err => this.logger.error(`Failed to send new ticket email to ${a.email}: ${err.message}`))
                    )
            );
        } catch (error) {
            this.logger.error('Failed to notify agents about new ticket', error);
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

                    // Auto-resolve: emit refresh ke semua pihak yang terlibat
                    if (ticket.user?.id) {
                        this.notificationCenterService.emitActionItemsRefresh(ticket.user.id, 'TICKET', ticket.id);
                    }
                    if (ticket.assignedToId) {
                        this.notificationCenterService.emitActionItemsRefresh(ticket.assignedToId, 'TICKET', ticket.id);
                    }
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

        // 2. Email Notification (Exclusive to parties inside the ticket room: Requester & Assigned Agent)
        try {
            const isActorRequester = event.userId === ticket.user?.id;
            const isActorAssignee = event.userId === ticket.assignedToId || (ticket.assignedTo && event.userId === ticket.assignedTo.id);

            let assignedAgent = ticket.assignedTo;
            if (!assignedAgent && ticket.assignedToId) {
                assignedAgent = await this.userRepo.findOne({ where: { id: ticket.assignedToId } }) as any;
            }

            const recipients: Array<{ email: string; name: string }> = [];

            // If updater is NOT requester, notify requester
            if (!isActorRequester && ticket.user?.email) {
                recipients.push({ email: ticket.user.email, name: ticket.user.fullName || 'User' });
            }

            // If updater is NOT assignee, notify assignee
            if (!isActorAssignee && assignedAgent?.email) {
                recipients.push({ email: assignedAgent.email, name: assignedAgent.fullName || 'Agent' });
            }

            const subject = ticket.status === TicketStatus.RESOLVED
                ? `Ticket Resolved: #${ticketNumber}`
                : `Ticket Updated: #${ticketNumber}`;

            await Promise.all(
                recipients.map(r =>
                    this.mailDispatch.send({
                        to: r.email,
                        subject,
                        template: 'ticket-update',
                        context: {
                            name: r.name,
                            ticketId: ticket.id,
                            ticketNumber,
                            status: ticket.status,
                            title: ticket.title,
                            link: buildAppUrl(`/tickets/${ticket.id}`),
                            year: new Date().getFullYear(),
                        },
                    }).catch(err => this.logger.error(`Failed to send ticket update email to ${r.email}: ${err.message}`))
                )
            );
        } catch (error) {
            this.logger.error('Failed to send ticket update emails', error);
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

        // 2. Email Notification to Assignee (respects prefs, bypass quiet/digest - actionable)
        if (event.assigneeEmail) {
            try {
                const pref = await this.prefRepo.findOne({ where: { userId: event.assigneeId } as any });
                const emailAllowed = !pref || (pref.emailEnabled !== false);
                const typeAllowed = !pref?.typeSettings || (pref.typeSettings?.['TICKET_ASSIGNED']?.['email'] !== false);
                if (!emailAllowed || !typeAllowed) {
                    this.logger.log(`Skipping assignment email for ${event.assigneeId} (prefs)`);
                } else {
                    await this.mailDispatch.send({
                        to: event.assigneeEmail,
                        subject: `Ticket Assigned to You: #${event.ticketNumber}`,
                        template: 'ticket-assigned',
                        context: {
                            name: event.assigneeName,
                            ticketId: event.ticketId,
                            ticketNumber: event.ticketNumber,
                            status: event.ticketStatus,
                            title: event.ticketTitle,
                            assigneeName: event.assigneeName,
                            assignerName: event.assignerName,
                            message: `You have been assigned to this ticket by ${event.assignerName}.`,
                            link: buildAppUrl(`/tickets/${event.ticketId}`),
                            year: new Date().getFullYear(),
                        },
                    });
                }
            } catch (error) {
                this.logger.error(`Failed to send assignment email to ${event.assigneeEmail}`, error);
            }
        }

        // 3. Email Notification to Requester (Ticket Owner)
        if (event.ticketOwnerEmail && event.ticketOwnerEmail !== event.assigneeEmail) {
            try {
                await this.mailDispatch.send({
                    to: event.ticketOwnerEmail,
                    subject: `Ticket Assigned: #${event.ticketNumber} - ${event.ticketTitle}`,
                    template: 'notification',
                    context: {
                        title: 'Tiket Sedang Ditangani',
                        message: `Tiket Anda #${event.ticketNumber} (${event.ticketTitle}) telah ditugaskan kepada ${event.assigneeName} dan sedang dalam penanganan.`,
                        ticketId: event.ticketNumber,
                        link: buildAppUrl(`/tickets/${event.ticketId}`),
                        year: new Date().getFullYear(),
                    },
                });
            } catch (error) {
                this.logger.error(`Failed to send assignment notification email to requester ${event.ticketOwnerEmail}`, error);
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
                            await this.mailDispatch.send({
                                to: mentionedUser.email,
                                subject: `You were mentioned in Ticket #${event.ticketNumber}`,
                                template: 'mention-notification',
                                context: {
                                    name: mentionedUser.fullName,
                                    ticketId: event.ticketId,
                                    mentionedBy: event.senderName,
                                    link: buildAppUrl(`/admin/tickets/${event.ticketId}`),
                                    year: new Date().getFullYear(),
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

            // Emit action-items refresh bagi assignee dan requester agar item hilang otomatis
            if (event.ticketAssignedToId) {
                this.notificationCenterService.emitActionItemsRefresh(
                    event.ticketAssignedToId, 'TICKET', event.ticketId
                );
            }
            if (event.ticketOwnerId) {
                this.notificationCenterService.emitActionItemsRefresh(
                    event.ticketOwnerId, 'TICKET', event.ticketId
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

        // 4. Email Notification (Bidirectional: Agent -> Requester, Requester -> Assignee)
        try {
            if (event.senderRole === UserRole.AGENT || event.senderRole === UserRole.ADMIN) {
                if (event.ticketOwnerEmail && (!event.mentionedUserIds || !event.mentionedUserIds.includes(event.ticketOwnerId))) {
                    await this.mailDispatch.send({
                        to: event.ticketOwnerEmail,
                        subject: `New Reply on Ticket #${event.ticketNumber}`,
                        template: 'ticket-update',
                        context: {
                            name: event.ticketOwnerName,
                            ticketId: event.ticketId,
                            ticketNumber: event.ticketNumber,
                            status: event.ticketStatus,
                            title: event.ticketTitle,
                            link: buildAppUrl(`/tickets/${event.ticketId}`),
                            year: new Date().getFullYear(),
                        },
                    });
                }
            } else if (event.senderRole === UserRole.USER && event.ticketAssignedToId && event.ticketAssignedToId !== event.senderId) {
                if (!event.mentionedUserIds || !event.mentionedUserIds.includes(event.ticketAssignedToId)) {
                    const assignedAgent = await this.userRepo.findOne({ where: { id: event.ticketAssignedToId } });
                    if (assignedAgent?.email) {
                        await this.mailDispatch.send({
                            to: assignedAgent.email,
                            subject: `New Reply on Ticket #${event.ticketNumber}`,
                            template: 'ticket-update',
                            context: {
                                name: assignedAgent.fullName,
                                ticketId: event.ticketId,
                                ticketNumber: event.ticketNumber,
                                status: event.ticketStatus,
                                title: event.ticketTitle,
                                link: buildAppUrl(`/tickets/${event.ticketId}`),
                                year: new Date().getFullYear(),
                            },
                        });
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Failed to send reply email: ${error.message}`, error);
        }
    }

    @OnEvent('ticket.auto-assigned')
    async handleTicketAutoAssignedEvent(event: { ticket: any; agent: any; workloadPoints?: number }) {
        this.logger.log(`Handling ticket.auto-assigned for ticket ${event.ticket?.id} -> agent ${event.agent?.id}`);
        // Reuse assignment flow: in-app + email (same preference honoring)
        const ticket = event.ticket;
        const agent = event.agent;
        if (!ticket || !agent) return;
        try {
            await this.notificationService.notifyTicketAssigned(agent.id, ticket.id, ticket.ticketNumber || ticket.id.slice(0, 8), 'Auto-assign');
        } catch (e) { this.logger.error('Auto-assign in-app notify failed', e); }
        if (agent.email) {
            try {
                const pref = await this.prefRepo.findOne({ where: { userId: agent.id } });
                const emailAllowed = !pref || (pref.emailEnabled !== false);
                const typeAllowed = !pref?.typeSettings || (pref.typeSettings?.['TICKET_ASSIGNED']?.['email'] !== false);
                if (emailAllowed && typeAllowed) {
                    await this.mailDispatch.send({
                        to: agent.email,
                        subject: `[Auto] Ticket Assigned: #${ticket.ticketNumber || ticket.id.slice(0, 8)}`,
                        template: 'ticket-assigned',
                        context: {
                            name: agent.fullName, ticketId: ticket.id, ticketNumber: ticket.ticketNumber || ticket.id.slice(0, 8),
                            status: ticket.status, title: ticket.title, assigneeName: agent.fullName, assignerName: 'Auto-assign',
                            link: buildAppUrl(`/tickets/${ticket.id}`), year: new Date().getFullYear(),
                        },
                    });
                }
            } catch (e) { this.logger.error(`Failed auto-assign email to ${agent.email}`, e); }
        }

        // Notify requester about auto-assignment
        if (ticket.user?.email && ticket.user.email !== agent.email) {
            try {
                await this.mailDispatch.send({
                    to: ticket.user.email,
                    subject: `Ticket Assigned: #${ticket.ticketNumber || ticket.id.slice(0, 8)} - ${ticket.title}`,
                    template: 'notification',
                    context: {
                        title: 'Tiket Sedang Ditangani',
                        message: `Tiket Anda #${ticket.ticketNumber || ticket.id.slice(0, 8)} (${ticket.title}) telah ditugaskan kepada ${agent.fullName} dan sedang dalam penanganan.`,
                        ticketId: ticket.ticketNumber || ticket.id.slice(0, 8),
                        link: buildAppUrl(`/tickets/${ticket.id}`),
                        year: new Date().getFullYear(),
                    },
                });
            } catch (e) {
                this.logger.error(`Failed auto-assign email to requester ${ticket.user.email}`, e);
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

                const assignedAgent = await this.userRepo.findOne({ where: { id: event.ticketAssignedToId } });
                if (assignedAgent?.email) {
                    await this.mailDispatch.send({
                        to: assignedAgent.email,
                        subject: `Ticket Cancelled: #${event.ticketNumber}`,
                        template: 'notification',
                        context: {
                            title: 'Tiket Dibatalkan',
                            message: `Tiket #${event.ticketNumber} (${event.ticketTitle}) telah dibatalkan oleh ${event.userFullName}${event.reason ? `. Alasan: ${event.reason}` : ''}.`,
                            ticketId: event.ticketNumber,
                            link: buildAppUrl(`/tickets/${event.ticketId}`),
                            year: new Date().getFullYear(),
                        },
                    }).catch(e => this.logger.error(`Failed to send cancellation email: ${e.message}`));
                }
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

                const ticketOwner = await this.userRepo.findOne({ where: { id: event.ticketOwnerId } });
                if (ticketOwner?.email) {
                    await this.mailDispatch.send({
                        to: ticketOwner.email,
                        subject: `Ticket Cancelled: #${event.ticketNumber}`,
                        template: 'notification',
                        context: {
                            title: 'Tiket Dibatalkan',
                            message: `Tiket Anda #${event.ticketNumber} (${event.ticketTitle}) telah dibatalkan oleh pihak support${event.reason ? `. Alasan: ${event.reason}` : ''}.`,
                            ticketId: event.ticketNumber,
                            link: buildAppUrl(`/tickets/${event.ticketId}`),
                            year: new Date().getFullYear(),
                        },
                    }).catch(e => this.logger.error(`Failed to send cancellation email: ${e.message}`));
                }
            }
        } catch (error) {
            this.logger.error('Failed to send cancellation notification', error);
        }
    }
}
