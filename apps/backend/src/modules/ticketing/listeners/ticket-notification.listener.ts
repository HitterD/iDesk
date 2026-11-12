import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationPreferenceGate } from '../../notifications/notification-preference-gate.service';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TICKET_ROUTED_EVENT, TicketCreatedEvent, TicketRoutedPayload } from '../events/ticket-created.event';
import { TicketUpdatedEvent } from '../events/ticket-updated.event';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { TicketCancelledEvent } from '../events/ticket-cancelled.event';
import { NotificationService } from '../../notifications/notification.service';
import { ticketLinkFor } from './ticket-chat-push.listener';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus } from '../entities/ticket.entity';
import { TicketParticipant } from '../entities/ticket-participant.entity';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import {
    isMobileDevCategory,
    isWebDevCategory,
    isOracleDevCategory,
} from '../utils/oracle-ticket-access.util';
import { formatResolutionDeadline } from '../utils/resolution-deadline.util';
import { statusChangeOf } from '../../notifications/utils/notification-copy.util';
import { forEachWithConcurrency } from '../../../shared/core/utils/concurrency.util';

/** How many agents of a pool are emailed at the same time when a ticket is created. */
export const NOTIFY_FANOUT_CONCURRENCY = 5;

@Injectable()
export class TicketNotificationListener {
    private readonly logger = new Logger(TicketNotificationListener.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly notificationCenterService: NotificationCenterService,
        private readonly mailDispatch: MailDispatchService,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(TicketParticipant)
        private readonly participantRepo: Repository<TicketParticipant>,
        @Optional() private readonly gate?: NotificationPreferenceGate,
    ) { }

    /** The person's email switch (global and for this notification type) and quiet hours. */
    private emailAllowed(userId: string | null | undefined, type: NotificationType): Promise<boolean> {
        if (!userId || !this.gate) return Promise.resolve(true);
        return this.gate.allows(userId, 'email', type);
    }

    @OnEvent('ticket.created')
    async handleTicketCreatedEvent(event: TicketCreatedEvent) {
        this.logger.log(`Handling ticket.created event for ticket ${event.ticketId}`);
        // The requester made it, so no in-app notice about their own action; an email keeps the number on record.
        await this.emailRequesterConfirmation(event);
    }

    /** Requester's receipt: the ticket number and a link, by email only. */
    private async emailRequesterConfirmation(event: TicketCreatedEvent): Promise<void> {
        if (!event.userEmail || !(await this.emailAllowed(event.userId, NotificationType.TICKET_CREATED))) return;
        try {
            await this.mailDispatch.send({
                to: event.userEmail,
                subject: `Tiket #${event.ticketNumber} diterima - ${event.title}`,
                template: 'notification',
                context: {
                    title: 'Tiket Diterima',
                    message: `Tiket Anda #${event.ticketNumber} (${event.title}) sudah diterima tim IT. Kami akan memberi kabar saat tiket mulai ditangani.`,
                    ticketId: event.ticketNumber,
                    link: buildAppUrl(`/client/tickets/${event.ticketId}`),
                    year: new Date().getFullYear(),
                },
            });
        } catch (error) {
            this.logger.error(`Failed to send ticket confirmation email to ${event.userEmail}`, error);
        }
    }

    /**
     * The team hears about a new ticket once auto-assign has run, and only when nobody has it yet:
     * an auto-assigned ticket reaches its PIC as "Ditugaskan" instead.
     */
    @OnEvent(TICKET_ROUTED_EVENT)
    async handleTicketRoutedEvent({ created: event, assignedToId }: TicketRoutedPayload) {
        if (assignedToId) return;
        try {
            const { agents, subjectPrefix, teamName } = await this.resolveTeam(event);
            // Whoever filed it (requester or staff on their behalf) already knows.
            const targetAgents = agents.filter(a => a.id !== event.userId && a.id !== event.createdById);
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
                title: subjectPrefix,
                message: `Tiket baru #${event.ticketNumber} (${event.title}) diajukan oleh ${event.userFullName} dan menunggu penanganan tim ${teamName}.`,
                ticketId: event.ticketNumber,
                link: buildAppUrl(`/tickets/${event.ticketId}`),
                year: new Date().getFullYear(),
            };

            const emailable: User[] = [];
            for (const a of targetAgents) if (a.email && (await this.emailAllowed(a.id, NotificationType.TICKET_CREATED))) emailable.push(a);
            await forEachWithConcurrency(emailable, NOTIFY_FANOUT_CONCURRENCY, a =>
                this.mailDispatch.send({
                    to: a.email,
                    subject: `${subjectPrefix}: #${event.ticketNumber} - ${event.title}`,
                    template: 'notification',
                    context: emailContext,
                }).then(() => undefined, err => this.logger.error(`Failed to send new ticket email to ${a.email}: ${err.message}`)));
        } catch (error) {
            this.logger.error('Failed to notify agents about new ticket', error);
        }
    }

    /** The team that handles a new ticket. Developer teams serve every site; operational support is per site. */
    private async resolveTeam(event: TicketCreatedEvent): Promise<{ agents: User[]; subjectPrefix: string; teamName: string }> {
        const activeWithRoles = (roles: UserRole[]) => this.userRepo.find({ where: roles.map(role => ({ role: role as any, isActive: true })) as any });
        if (isMobileDevCategory(event.category, event.ticketType)) {
            return { agents: await activeWithRoles([UserRole.AGENT_MOBILE_DEV]), subjectPrefix: 'Permintaan Mobile Dev Baru', teamName: 'Mobile Developer' };
        }
        if (isWebDevCategory(event.category, event.ticketType)) {
            return { agents: await activeWithRoles([UserRole.AGENT_ORACLE]), subjectPrefix: 'Permintaan Web Dev Baru', teamName: 'Web Developer' };
        }
        if (isOracleDevCategory(event.category, event.ticketType)) {
            return { agents: await activeWithRoles([UserRole.AGENT_ORACLE, UserRole.AGENT_MOBILE_DEV]), subjectPrefix: 'Permintaan Oracle/K2 Baru', teamName: 'Oracle & Mobile Developer' };
        }
        // General / IT support: the ticket's site plus cross-site agents; a ticket without a site reaches nobody.
        const agents = await this.notificationCenterService.findStaffAtSite([UserRole.AGENT_OPERATIONAL_SUPPORT], event.siteId);
        return { agents, subjectPrefix: 'Tiket Baru', teamName: 'Operational Support' };
    }

    @OnEvent('ticket.updated')
    async handleTicketUpdatedEvent(event: TicketUpdatedEvent) {
        this.logger.log(`Handling ticket.updated event for ticket ${event.ticketId}`);
        const { ticket, changes } = event;
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
        const deadlineLabel = ticket.status === TicketStatus.RESOLVED && ticket.resolutionDeadlineAt
            ? formatResolutionDeadline(ticket.resolutionDeadlineAt)
            : undefined;
        // Requester-side notices are titled with the problem and signed by the PIC.
        const notice = { title: ticket.title, assigneeName: ticket.assignedTo?.fullName ?? null };

        // 1. In-App Notification
        if (ticket.user) {
            try {
                const isActorRequester = event.userId === ticket.user?.id;
                if (!isActorRequester) {
                    if (ticket.status === TicketStatus.RESOLVED) {
                        await this.notificationService.notifyTicketResolved(
                            ticket.user.id,
                            ticket.id,
                            ticketNumber,
                            deadlineLabel,
                            notice,
                        );
                    } else {
                        await this.notificationService.notifyTicketUpdated(
                            ticket.user.id,
                            ticket.id,
                            ticketNumber,
                            changes.join(', '),
                            notice,
                        );
                    }
                }

                // Staff who filed it on the requester's behalf follow its progress too.
                if (ticket.createdById && ticket.createdById !== event.userId && ticket.createdById !== ticket.user.id) {
                    await this.notificationService.notifyTicketUpdated(
                        ticket.createdById,
                        ticket.id,
                        ticketNumber,
                        changes.join(', '),
                        notice,
                    );
                }

                if (ticket.status === TicketStatus.RESOLVED) {
                    // Auto-resolve: emit refresh ke semua pihak yang terlibat
                    if (ticket.user?.id) {
                        this.notificationCenterService.emitActionItemsRefresh(ticket.user.id, 'TICKET', ticket.id);
                    }
                    if (ticket.assignedToId) {
                        this.notificationCenterService.emitActionItemsRefresh(ticket.assignedToId, 'TICKET', ticket.id);
                    }
                }
            } catch (error) {
                this.logger.error('Failed to send ticket update notification', error);
            }
        }

        // 2. Email (requester & PIC) only when the status changed; priority/category/SLA edits stay in-app.
        if (!statusChangeOf(changes)) return;
        try {
            const isActorRequester = event.userId === ticket.user?.id;
            const isActorAssignee = event.userId === ticket.assignedToId || (ticket.assignedTo && event.userId === ticket.assignedTo.id);

            let assignedAgent = ticket.assignedTo;
            if (!assignedAgent && ticket.assignedToId) {
                assignedAgent = await this.userRepo.findOne({ where: { id: ticket.assignedToId } }) as any;
            }

            const recipients: Array<{ email: string; name: string }> = [];
            const emailType = ticket.status === TicketStatus.RESOLVED ? NotificationType.TICKET_RESOLVED : NotificationType.TICKET_UPDATED;

            // If updater is NOT requester, notify requester
            if (!isActorRequester && ticket.user?.email && (await this.emailAllowed(ticket.user.id, emailType))) {
                recipients.push({ email: ticket.user.email, name: ticket.user.fullName || 'User' });
            }

            // If updater is NOT assignee, notify assignee
            if (!isActorAssignee && assignedAgent?.email && (await this.emailAllowed(assignedAgent.id, emailType))) {
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
                            // Only the requester can confirm; the agent copy just shows the status.
                            confirmationDeadline: r.email === ticket.user?.email ? deadlineLabel : undefined,
                            link: buildAppUrl(`/tickets/${ticket.id}`),
                            year: new Date().getFullYear(),
                        },
                    }).catch(err => this.logger.error(`Failed to send ticket update email to ${r.email}: ${err.message}`))
                )
            );
        } catch (error) {
            this.logger.error('Failed to send ticket update emails', error);
        }
    }

    @OnEvent('ticket.assigned')
    async handleTicketAssignedEvent(event: TicketAssignedEvent) {
        this.logger.log(`Handling ticket.assigned event for ticket ${event.ticketId}`);
        // Self-assign (takeover / start by status, manual self-assign): no "assigned to you" notices.
        const isSelfAssign = Boolean(event.assignerId) && event.assignerId === event.assigneeId;
        if (!isSelfAssign) await this.notifyAssignee(event);
        // A takeover by status already emailed the requester about that status change: one email, not two.
        if (!event.viaStatusChange) await this.notifyRequesterOfAssignment(event);
    }

    private async notifyAssignee(event: TicketAssignedEvent): Promise<void> {
        // 1. In-App Notification
        try {
            await this.notificationService.notifyTicketAssigned(
                event.assigneeId,
                event.ticketId,
                event.ticketNumber,
                event.assignerName,
                { title: event.ticketTitle, requesterName: event.ticketOwnerName ?? null },
            );
        } catch (error) {
            this.logger.error('Failed to send assignment notification', error);
        }

        // 2. Email Notification to Assignee (respects prefs, bypass quiet/digest - actionable)
        if (event.assigneeEmail) {
            try {
                if (!(await this.emailAllowed(event.assigneeId, NotificationType.TICKET_ASSIGNED))) {
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
    }

    private async notifyRequesterOfAssignment(event: TicketAssignedEvent): Promise<void> {
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
                    if (mentionedUser.email && (await this.emailAllowed(mentionedUser.id, NotificationType.MENTION))) {
                        try {
                            await this.mailDispatch.send({
                                to: mentionedUser.email,
                                subject: `You were mentioned in Ticket #${event.ticketNumber}`,
                                template: 'mention-notification',
                                context: {
                                    name: mentionedUser.fullName,
                                    ticketId: event.ticketId,
                                    mentionedBy: event.senderName,
                                    // Each portal has its own ticket page; there is no /admin route.
                                    link: buildAppUrl(ticketLinkFor(mentionedUser.role, event.ticketId)),
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

        // 2. In-app (+ SJA) "new message" for everyone in the conversation except the sender. Mentioned people
        //    already got "Anda disebut" for this message. Rows are grouped per ticket while unread, and email
        //    follows only if they stay unread (TicketChatEmailDigestService) - no email per message.
        try {
            const mentioned = new Set(event.mentionedUserIds ?? []);
            const recipients = (await this.replyRecipients(event)).filter(id => !mentioned.has(id));
            const contentSnippet = event.message?.content || '';
            for (const userId of recipients) {
                await this.notificationService.notifyTicketReply(
                    userId,
                    event.ticketId,
                    event.ticketNumber,
                    event.senderName,
                    contentSnippet,
                    event.message?.id,
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
    }

    /**
     * People in a ticket conversation other than the sender: requester, the staff who filed it for them, the PIC
     * and invited participants. Internal notes reach staff only.
     */
    private async replyRecipients(event: TicketRepliedEvent): Promise<string[]> {
        if (event.message?.isSystemMessage) return [];
        const isInternalNote = event.message?.isInternal === true;
        const participantRows = await this.participantRepo.find({ where: { ticketId: event.ticketId }, select: ['userId'] });
        const staffSide = [event.ticketAssignedToId, ...participantRows.map(row => row.userId)];
        const requesterSide = isInternalNote ? [] : [event.ticketOwnerId, event.ticketCreatorId];
        const ids = [...new Set([...requesterSide, ...staffSide].filter((id): id is string => Boolean(id) && id !== event.senderId))];
        if (!isInternalNote || ids.length === 0) return ids;
        const users = await this.userRepo.find({ where: { id: In(ids) }, select: ['id', 'role'] });
        return users.filter(u => u.role !== UserRole.USER).map(u => u.id);
    }

    @OnEvent('ticket.auto-assigned')
    async handleTicketAutoAssignedEvent(event: { ticket: any; agent: any; workloadPoints?: number }) {
        this.logger.log(`Handling ticket.auto-assigned for ticket ${event.ticket?.id} -> agent ${event.agent?.id}`);
        // Reuse assignment flow: in-app + email (same preference honoring)
        const ticket = event.ticket;
        const agent = event.agent;
        if (!ticket || !agent) return;
        try {
            await this.notificationService.notifyTicketAssigned(
                agent.id, ticket.id, ticket.ticketNumber || ticket.id.slice(0, 8), 'Auto-assign',
                { title: ticket.title, requesterName: ticket.user?.fullName ?? null },
            );
        } catch (e) { this.logger.error('Auto-assign in-app notify failed', e); }
        if (agent.email) {
            try {
                if (await this.emailAllowed(agent.id, NotificationType.TICKET_ASSIGNED)) {
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
            const cancelledByOwner = event.userId === event.ticketOwnerId;
            // Requester cancelled -> notify the PIC
            if (cancelledByOwner && event.ticketAssignedToId && event.ticketAssignedToId !== event.userId) {
                await this.notificationService.create({
                    userId: event.ticketAssignedToId,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Ticket #${event.ticketNumber} has been cancelled by ${event.userFullName}${event.reason ? `: ${event.reason}` : ''}`,
                    ticketId: event.ticketId,
                    link: `/tickets/${event.ticketId}`,
                });

                const assignedAgent = await this.userRepo.findOne({ where: { id: event.ticketAssignedToId } });
                if (assignedAgent?.email && (await this.emailAllowed(assignedAgent.id, NotificationType.TICKET_CANCELLED))) {
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
            // Anyone else (any agent role, admin, manager) cancelled -> notify the requester
            if (!cancelledByOwner) {
                await this.notificationService.create({
                    userId: event.ticketOwnerId,
                    type: NotificationType.TICKET_CANCELLED,
                    title: 'Ticket Cancelled',
                    message: `Your ticket #${event.ticketNumber} has been cancelled by support${event.reason ? `: ${event.reason}` : ''}`,
                    ticketId: event.ticketId,
                    link: `/tickets/${event.ticketId}`,
                });

                const ticketOwner = await this.userRepo.findOne({ where: { id: event.ticketOwnerId } });
                if (ticketOwner?.email && (await this.emailAllowed(ticketOwner.id, NotificationType.TICKET_CANCELLED))) {
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
