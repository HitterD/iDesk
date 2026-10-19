import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { AttachmentInfo, TicketMessage } from '../entities/ticket-message.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { resolveTicketViewerAccess } from './ticket-oracle-access';
import { canAccessTicketObject } from '../utils/oracle-ticket-access.util';
import { canAccessTicketSite } from '../utils/site-access.util';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { SlaClockService, SLA_RESPONDER_ROLES } from './sla-clock.service';

@Injectable()
export class TicketMessagingService {
    private readonly logger = new Logger(TicketMessagingService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly eventEmitter: EventEmitter2,
        private readonly slaClock: SlaClockService,
    ) { }

    async findMessages(ticketId: string) {
        return this.messageRepo.find({
            where: { ticketId },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }

    async getMessages(ticketId: string, userRole?: UserRole, userSiteId: string | null = null, userId?: string): Promise<TicketMessage[]> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['participants'],
            select: ['id', 'category', 'ticketType', 'handlingTeam', 'siteId', 'userId', 'createdById'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        const access = userRole
            ? resolveTicketViewerAccess(ticket, { id: userId, role: userRole, siteId: userSiteId })
            : 'handler';

        return this.messageRepo.find({
            where: {
                ticketId,
                ...(access === 'requester' ? { isInternal: false } : {}),
            },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }

    /**
     * Get messages with pagination (4.2.2 Message Pagination)
     * More efficient for tickets with many messages
     * @param userRole - Used to filter internal messages for customers
     */
    async getMessagesPaginated(
        ticketId: string,
        page: number = 1,
        limit: number = 20,
        userRole?: UserRole,
        userSiteId: string | null = null,
        userId?: string,
    ): Promise<{
        data: TicketMessage[];
        meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
    }> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['participants'],
            select: ['id', 'category', 'ticketType', 'handlingTeam', 'siteId', 'userId', 'createdById'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        const access = userRole
            ? resolveTicketViewerAccess(ticket, { id: userId, role: userRole, siteId: userSiteId })
            : 'handler';

        const skip = (page - 1) * limit;

        // Build query
        const qb = this.messageRepo
            .createQueryBuilder('msg')
            .leftJoinAndSelect('msg.sender', 'sender')
            .where('msg.ticketId = :ticketId', { ticketId });

        // Filter internal messages for the requester side
        if (access === 'requester') {
            qb.andWhere('msg.isInternal = :isInternal', { isInternal: false });
        }

        const total = await qb.getCount();

        const data = await qb
            .orderBy('msg.createdAt', 'DESC')
            .skip(skip)
            .take(limit)
            .getMany();

        const totalPages = Math.ceil(total / limit);

        return {
            data: data.reverse(), // Reverse to show oldest first in the returned page
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }


    async replyToTicket(
        ticketId: string,
        userId: string,
        content: string,
        files: string[] = [],
        mentionedUserIds: string[] = [],
        isInternal: boolean = false,
        attachmentInfo: AttachmentInfo[] = [],
    ) {
        // P1 fix: message insert + ticket status/SLA update were two separate
        // saves outside any transaction. A crash between them left the ticket
        // without its SLA timer started (or its firstResponseAt set). Now atomic
        // via dataSource.transaction. Event emit / WS push moved outside the
        // transaction so listeners only fire on commit.
        const { savedMessage, ticket, user, startedWork, senderSideRole } = await this.dataSource.transaction(async (manager) => {
            const ticket = await manager.findOne(Ticket, {
                where: { id: ticketId },
                relations: ['user', 'assignedTo', 'participants'],
            });
            if (!ticket) {
                throw new NotFoundException('Ticket not found');
            }
            if (ticket.status === TicketStatus.CLOSED) {
                throw new BadRequestException(TICKET_CLOSED_MESSAGE);
            }

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new NotFoundException('User not found');
            }
            const access = resolveTicketViewerAccess(ticket, user);
            // The requester side chats like a requester: no internal notes and no
            // handler effects (first response, start of work), even when staff.
            if (access === 'requester' && isInternal) {
                throw new ForbiddenException('Only the handling team can add internal notes');
            }
            const isHandler = access === 'handler';

            // Create Message
            const message = manager.create(TicketMessage, {
                ticketId,
                senderId: userId,
                content,
                attachments: files,
                attachmentInfo: attachmentInfo.length > 0 ? attachmentInfo : null,
                isInternal,  // Mark as internal note if specified
            });

            const savedMessage = await manager.save(TicketMessage, message);

            // === Track First Response Time ===
            const isAgentOrAdmin = isHandler && (user.role === UserRole.AGENT || user.role === UserRole.ADMIN);
            const isFirstAgentReply = isHandler && !ticket.firstResponseAt && SLA_RESPONDER_ROLES.includes(user.role);

            if (isFirstAgentReply) {
                ticket.firstResponseAt = new Date();

                // Check if first response SLA was breached
                if (ticket.firstResponseTarget && ticket.firstResponseAt > new Date(ticket.firstResponseTarget)) {
                    ticket.isFirstResponseBreached = true;
                    this.logger.warn(`First Response SLA Breached for ticket #${ticket.ticketNumber}`);
                } else {
                    this.logger.log(`First Response recorded for ticket #${ticket.ticketNumber} - within SLA`);
                }
            }

            // Update Ticket Status if Agent/Admin replies and ticket is still TODO
            const startedWork = isAgentOrAdmin && ticket.status === TicketStatus.TODO;
            if (startedWork) {
                ticket.status = TicketStatus.IN_PROGRESS;

                // Also start SLA timer if not started
                if (!ticket.slaStartedAt && await this.slaClock.startResolution(ticket)) {
                    this.logger.log(`SLA Timer started for ticket #${ticket.ticketNumber}. Target: ${ticket.slaTarget?.toISOString()}`);
                }
            }

            // === Update Unread Tracking ===
            const now = new Date();
            ticket.lastMessageAt = now;
            // Unread tracking is two-sided: a requester-side staff reply counts as the user side.
            const senderSideRole = isHandler ? user.role : UserRole.USER;
            ticket.lastMessageSenderRole = senderSideRole;
            if (isAgentOrAdmin) {
                ticket.agentLastReadAt = now;
            } else {
                ticket.userLastReadAt = now;
            }

            // Save ticket changes
            await manager.save(Ticket, ticket);

            return { savedMessage, ticket, user, startedWork, senderSideRole };
        });

        // The reply moved the ticket from Open to In Progress; TV boards must show it.
        if (startedWork) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: (ticket as any).siteId });
        }

        // Notify frontend via WebSocket with full message data (post-commit)
        const messageWithSender = {
            ...savedMessage,
            sender: {
                id: user.id,
                fullName: user.fullName,
                role: user.role,
            },
        };
        this.eventsGateway.notifyNewMessage(ticketId, messageWithSender);
        // Broadcast typing:stop to ensure no client retains ghost typing indicator
        this.eventsGateway.server.to(`ticket:${ticketId}`).emit('typing:stop', { ticketId });
        // Site room includes other requesters: send only the id, never the message body.
        this.eventsGateway.emitToTicketAudience((ticket as any).siteId, 'NEW_MESSAGE', { ticketId });

        // Emit Domain Event
        this.eventEmitter.emit(
            'ticket.replied',
            new TicketRepliedEvent(
                ticket.id,
                ticket.ticketNumber || ticket.id.split('-')[0],
                ticket.title,
                ticket.status,
                ticket.user.id,
                ticket.user.email,
                ticket.user.fullName,
                ticket.assignedTo?.id,
                savedMessage,
                user.id,
                user.fullName,
                senderSideRole,
                mentionedUserIds,
                ticket.createdById ?? undefined,
            ),
        );

        return savedMessage;
    }

    /**
     * Mark a ticket as read for the current viewing user or agent
     */
    async markAsRead(ticketId: string, userId: string, role?: string, userSiteId: string | null = null): Promise<void> {
        const now = new Date();
        // iPop clears this person's chat notifications for the ticket (listeners skip tickets iPop can't see).
        this.eventEmitter.emit('ticket.read', { ticketId, userId });
        if (!role || role === UserRole.USER) {
            await this.touchReadMarkers(ticketId, { userLastReadAt: now });
            return;
        }
        // Staff who requested/filed the ticket read the requester side; they clear
        // the team's unread marker only when they also handle the ticket.
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            select: ['id', 'userId', 'createdById', 'handlingTeam', 'category', 'ticketType', 'siteId'],
        });
        if (!ticket) return;
        const isRequesterStaff = ticket.userId === userId || ticket.createdById === userId;
        const isHandler = canAccessTicketObject({ role }, ticket) && canAccessTicketSite(role as UserRole, userSiteId, ticket.siteId);
        const updateData = {
            ...(isHandler || !isRequesterStaff ? { agentLastReadAt: now } : {}),
            ...(isRequesterStaff ? { userLastReadAt: now } : {}),
        };

        await this.touchReadMarkers(ticketId, updateData);
    }

    /**
     * Reading a ticket is not a change to it: `repo.update()` would also bump the
     * @UpdateDateColumn (dashboards/reports treat `updatedAt` as activity time) and the
     * @VersionColumn (spurious optimistic-lock conflicts for whoever is editing it).
     */
    private async touchReadMarkers(ticketId: string, markers: Partial<Pick<Ticket, 'userLastReadAt' | 'agentLastReadAt'>>): Promise<void> {
        if (Object.keys(markers).length === 0) return;
        await this.ticketRepo
            .createQueryBuilder()
            .update(Ticket)
            .set({ ...markers, updatedAt: () => '"updatedAt"', version: () => '"version"' })
            .where('id = :ticketId', { ticketId })
            .execute();
    }
}
