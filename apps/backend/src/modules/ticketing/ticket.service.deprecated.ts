import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DeepPartial, MoreThanOrEqual } from 'typeorm';

import { Ticket, TicketStatus, TicketSource, TicketPriority } from './entities/ticket.entity';
import { SlaConfig } from './entities/sla-config.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CustomerSession } from '../users/entities/customer-session.entity';
import { EventsGateway } from './presentation/gateways/events.gateway';

import { MailerService } from '@nestjs-modules/mailer';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { SurveysService } from './surveys.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramChatBridgeService } from '../telegram/telegram-chat-bridge.service';
import { CacheService, CacheKeys } from '../../shared/core/cache';

@Injectable()
export class TicketService {
    private notificationService: NotificationService | null = null;

    constructor(

        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(CustomerSession)
        private readonly sessionRepo: Repository<CustomerSession>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly eventsGateway: EventsGateway,
        private readonly mailerService: MailerService,
        private readonly kbService: KnowledgeBaseService,
        private readonly surveysService: SurveysService,
        @Optional() @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
        @Optional() @Inject(forwardRef(() => TelegramChatBridgeService))
        private readonly telegramChatBridge: TelegramChatBridgeService,
        private readonly cacheService: CacheService,
    ) { }

    setNotificationService(notificationService: NotificationService) {
        this.notificationService = notificationService;
    }



    async findMessages(ticketId: string) {
        return this.messageRepo.find({
            where: { ticketId },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }

    async updateTicket(ticketId: string, updateData: Partial<Ticket>, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const changes: string[] = [];

        if (updateData.status && updateData.status !== ticket.status) {
            changes.push(`Status changed from ${ticket.status} to ${updateData.status}`);

            // SLA Pausing Logic
            if (updateData.status === TicketStatus.WAITING_VENDOR) {
                // Start Pausing
                ticket.lastPausedAt = new Date();
            } else if (ticket.status === TicketStatus.WAITING_VENDOR) {
                // Resume from Pause
                if (ticket.lastPausedAt) {
                    const now = new Date();
                    const diffMs = now.getTime() - new Date(ticket.lastPausedAt).getTime();
                    const diffMinutes = Math.floor(diffMs / 60000);
                    ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + diffMinutes;

                    // Adjust SLA Target
                    if (ticket.slaTarget) {
                        const currentTarget = new Date(ticket.slaTarget);
                        const newTarget = new Date(currentTarget.getTime() + diffMs);
                        ticket.slaTarget = newTarget;
                        changes.push(`SLA Target adjusted by ${diffMinutes} minutes (Paused Duration)`);
                    }

                    ticket.lastPausedAt = null;
                }
            }
        }

        if (updateData.priority && updateData.priority !== ticket.priority) {
            changes.push(`Priority changed from ${ticket.priority} to ${updateData.priority}`);

            // Recalculate SLA Target based on new priority
            const newSlaConfig = await this.slaConfigRepo.findOne({ where: { priority: updateData.priority as string } });
            if (newSlaConfig) {
                const createdAt = new Date(ticket.createdAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                const newSlaTarget = new Date(createdAt.getTime() + (newSlaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);
                ticket.slaTarget = newSlaTarget;
                changes.push(`SLA Target updated to ${newSlaTarget.toISOString()} (${newSlaConfig.resolutionTimeMinutes} minutes for ${updateData.priority})`);
            }
        }

        // Apply updates
        Object.assign(ticket, updateData);
        const savedTicket = await this.ticketRepo.save(ticket);

        // Invalidate dashboard cache
        this.cacheService.delByPattern('dashboard:stats:*');
        this.eventsGateway.notifyDashboardStatsUpdate();

        // Log changes as system messages
        if (changes.length > 0) {
            const systemMessageContent = `System: ${changes.join(', ')} by ${user.fullName}`;
            const systemMessage = this.messageRepo.create({
                content: systemMessageContent,
                ticket: savedTicket,
                senderId: user.id,
                isSystemMessage: true,
            });
            await this.messageRepo.save(systemMessage);

            this.eventsGateway.server.emit('ticket:updated', { ticketId });

            // Send in-app notification for ticket update
            if (this.notificationService && ticket.user) {
                try {
                    const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
                    if (ticket.status === TicketStatus.RESOLVED) {
                        await this.notificationService.notifyTicketResolved(
                            ticket.user.id,
                            ticketId,
                            ticketNumber,
                        );
                    } else {
                        await this.notificationService.notifyTicketUpdated(
                            ticket.user.id,
                            ticketId,
                            ticketNumber,
                            changes.join(', '),
                        );
                    }
                } catch (error) {
                    console.error('Failed to send ticket update notification:', error);
                }
            }

            // Send Email Notification
            if (ticket.user && ticket.user.email) {
                try {
                    await this.mailerService.sendMail({
                        to: ticket.user.email,
                        subject: `Ticket Updated: #${ticket.id}`,
                        template: 'ticket-update',
                        context: {
                            name: ticket.user.fullName,
                            ticketId: ticket.id,
                            status: ticket.status,
                            title: ticket.title,
                        },
                    });
                } catch (emailError) {
                    console.error(`Failed to send ticket update email to ${ticket.user.email}:`, emailError);
                }
            }

            // Send Telegram Notification using the improved notifyTicketUpdate method
            if (this.telegramService && ticket.user) {
                try {
                    let updateType = 'STATUS_CHANGED';
                    if (ticket.status === TicketStatus.RESOLVED) updateType = 'RESOLVED';
                    else if (ticket.status === TicketStatus.IN_PROGRESS) updateType = 'STATUS_CHANGED';

                    await this.telegramService.notifyTicketUpdate(ticket.user.id, ticket, updateType);
                } catch (telegramError) {
                    console.error('Failed to send Telegram notification:', telegramError);
                }
            }

            // Trigger Survey if Resolved
            if (ticket.status === TicketStatus.RESOLVED) {
                const survey = await this.surveysService.createSurvey(ticket);
                // Send survey link via Telegram
                if (ticket.user?.telegramChatId && this.telegramService) {
                    try {
                        const surveyLink = `http://localhost:5173/feedback?token=${survey.token}`;
                        await this.telegramService.sendNotification(
                            ticket.user.telegramChatId,
                            `🌟 <b>Kami Butuh Masukan Anda!</b>\n\nTiket Anda telah selesai. Seberapa puas Anda dengan layanan kami?\n\n<a href="${surveyLink}">Klik untuk memberi rating</a>`
                        );
                    } catch (telegramError) {
                        console.error('Failed to send survey Telegram notification:', telegramError);
                    }
                }
            }
        }
        return savedTicket;
    }

    async createTicket(userId: string, createTicketDto: any, files: string[] = []): Promise<Ticket> {
        try {
            console.log('Finding user with ID:', userId);
            const user = await this.userRepo.findOne({
                where: { id: userId },
                relations: ['department']
            });
            if (!user) {
                console.error('User not found');
                throw new NotFoundException('User not found');
            }
            console.log('User found:', user.fullName, 'Department:', user.department?.name);

            const ticket = this.ticketRepo.create({
                ...createTicketDto,
                user,
                status: TicketStatus.TODO,
                source: createTicketDto.source || TicketSource.WEB,
                category: createTicketDto.category || 'GENERAL',
                device: createTicketDto.device,
                software: createTicketDto.software,
            } as DeepPartial<Ticket>);
            console.log('Ticket object created');

            // Generate Custom Ticket Number
            const date = new Date();
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString().slice(-2);
            const dateStr = `${day}${month}${year}`;

            const division = user.department?.name ? user.department.name.substring(0, 3).toUpperCase() : 'GEN';

            // Get count for today to increment
            console.log('Counting tickets for today...');
            const count = await this.ticketRepo.count({
                where: {
                    createdAt: MoreThanOrEqual(new Date(date.setHours(0, 0, 0, 0))),
                }
            });
            console.log('Count result:', count);
            const number = (count + 1).toString().padStart(4, '0');

            ticket.ticketNumber = `${dateStr}-${division}-${number}`;
            console.log('Generated Ticket Number:', ticket.ticketNumber);

            // Set initial SLA Target based on priority
            const priority = createTicketDto.priority || 'MEDIUM';
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority } });
            if (slaConfig) {
                const now = new Date();
                ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
                console.log('SLA Target set:', ticket.slaTarget);
            }

            await this.ticketRepo.save(ticket);
            console.log('Ticket saved to DB');

            // Invalidate dashboard cache
            this.cacheService.delByPattern('dashboard:stats:*');
            this.eventsGateway.notifyDashboardStatsUpdate();

            // Save initial message with attachments
            const message = this.messageRepo.create({
                content: createTicketDto.description,
                ticket,
                senderId: user.id,
                attachments: files,
            });
            await this.messageRepo.save(message);
            console.log('Initial message saved');

            // Send notification to requester
            if (this.notificationService) {
                try {
                    await this.notificationService.notifyTicketCreated(
                        user.id,
                        ticket.id,
                        ticket.ticketNumber || ticket.id.split('-')[0],
                        ticket.title,
                    );
                } catch (error) {
                    console.error('Failed to send ticket created notification:', error);
                }
            }

            // Emit WebSocket event for real-time sync
            this.eventsGateway.notifyNewTicket({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category,
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                },
                createdAt: ticket.createdAt,
            });

            // Notify all admins and agents about new ticket
            if (this.notificationService) {
                try {
                    const adminAgents = await this.userRepo.find({
                        where: [
                            { role: UserRole.ADMIN },
                            { role: UserRole.AGENT },
                        ],
                    });
                    const adminIds = adminAgents.map(a => a.id);

                    await this.notificationService.notifyNewTicketToAdmins(
                        ticket.id,
                        ticket.ticketNumber || ticket.id.split('-')[0],
                        ticket.title,
                        ticket.priority,
                        ticket.category,
                        user.fullName,
                        adminIds,
                    );
                } catch (error) {
                    console.error('Failed to notify admins about new ticket:', error);
                }
            }

            return ticket;
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    }

    async findAll(userId: string, role: UserRole): Promise<Ticket[]> {
        if (role === UserRole.ADMIN || role === UserRole.AGENT) {
            return this.ticketRepo.find({ relations: ['user', 'user.department', 'assignedTo'], order: { createdAt: 'DESC' } });
        }
        return this.ticketRepo.find({
            where: { user: { id: userId } },
            relations: ['user', 'user.department', 'assignedTo'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * OPTIMIZED: Paginated ticket list with filtering and search
     */
    async findAllPaginated(
        userId: string,
        role: UserRole,
        options: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'ASC' | 'DESC';
            status?: string;
            priority?: string;
            category?: string;
            search?: string;
        } = {}
    ) {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            category,
            search,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo');

        // Role-based filtering
        if (role === UserRole.USER) {
            qb.where('ticket.userId = :userId', { userId });
        }

        // Status filter
        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }

        // Priority filter
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }

        // Category filter
        if (category) {
            qb.andWhere('ticket.category = :category', { category });
        }

        // Search in title and description
        if (search) {
            qb.andWhere(
                '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket.ticketNumber ILIKE :search)',
                { search: `%${search}%` }
            );
        }

        // Get total count (before pagination)
        const total = await qb.getCount();

        // Apply sorting
        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        qb.orderBy(`ticket.${actualSortBy}`, sortOrder);

        // Apply pagination
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const data = await qb.getMany();

        const totalPages = Math.ceil(total / limit);

        return {
            data,
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

    async getMessages(ticketId: string): Promise<TicketMessage[]> {
        return this.findMessages(ticketId);
    }

    async findOne(id: string): Promise<any> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: ['user', 'user.department', 'assignedTo', 'messages', 'messages.sender'],
        });

        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        // Use stored SLA Target if available, otherwise calculate it (for backwards compatibility)
        let slaTarget = ticket.slaTarget;
        if (!slaTarget && ticket.priority) {
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority: ticket.priority } });
            if (slaConfig) {
                const createdAt = new Date(ticket.createdAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                slaTarget = new Date(createdAt.getTime() + (slaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);

                // Save calculated SLA target to ticket for future reference
                ticket.slaTarget = slaTarget;
                await this.ticketRepo.save(ticket);
            }
        }

        return { ...ticket, slaTarget };
    }

    async replyToTicket(ticketId: string, userId: string, content: string, files: string[] = [], mentionedUserIds: string[] = []) {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Create Message
        const message = this.messageRepo.create({
            ticketId,
            senderId: userId,
            content,
            attachments: files,
        });

        const savedMessage = await this.messageRepo.save(message);

        // Update Ticket Status if Agent replies
        if (user.role === UserRole.AGENT && ticket.status === TicketStatus.TODO) {
            ticket.status = TicketStatus.IN_PROGRESS;
            await this.ticketRepo.save(ticket);
        }

        // Notify frontend via WebSocket with full message data
        const messageWithSender = {
            ...savedMessage,
            sender: {
                id: user.id,
                fullName: user.fullName,
                role: user.role,
            },
        };
        this.eventsGateway.notifyNewMessage(ticketId, messageWithSender);
        this.eventsGateway.server.emit('NEW_MESSAGE', messageWithSender);

        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // Handle Mentions (Explicit IDs)
        if (mentionedUserIds && mentionedUserIds.length > 0) {
            for (const mentionedUserId of mentionedUserIds) {
                // Don't notify self
                if (mentionedUserId === userId) continue;

                const mentionedUser = await this.userRepo.findOne({ where: { id: mentionedUserId } });
                if (mentionedUser) {
                    // In-app notification for mentions
                    if (this.notificationService) {
                        try {
                            await this.notificationService.notifyMention(
                                mentionedUserId,
                                ticketId,
                                ticketNumber,
                                user.fullName,
                            );
                        } catch (error) {
                            console.error('Failed to send mention notification:', error);
                        }
                    }

                    // Email notification for mentions
                    if (mentionedUser.email) {
                        try {
                            await this.mailerService.sendMail({
                                to: mentionedUser.email,
                                subject: `You were mentioned in Ticket #${ticket.id}`,
                                template: 'mention-notification',
                                context: {
                                    name: mentionedUser.fullName,
                                    ticketId: ticket.id,
                                    mentionedBy: user.fullName,
                                    link: `http://localhost:5173/admin/tickets/${ticket.id}`,
                                },
                            });
                            console.log(`[Mention] Notification sent to ${mentionedUser.email}`);
                        } catch (error) {
                            console.error(`Failed to send mention email to ${mentionedUser.email}`, error);
                        }
                    }
                }
            }
        }

        // Send in-app notification for reply
        if (this.notificationService) {
            try {
                // Notify ticket owner if agent/admin replies
                if ((user.role === UserRole.AGENT || user.role === UserRole.ADMIN) && ticket.user && ticket.user.id !== userId) {
                    await this.notificationService.notifyTicketReply(
                        ticket.user.id,
                        ticketId,
                        ticketNumber,
                        user.fullName,
                    );
                }
                // Notify assigned agent if requester replies
                if (user.role === UserRole.USER && ticket.assignedTo && ticket.assignedTo.id !== userId) {
                    const assignedTo = await this.userRepo.findOne({ where: { id: ticket.assignedTo.id } });
                    if (assignedTo) {
                        await this.notificationService.notifyTicketReply(
                            assignedTo.id,
                            ticketId,
                            ticketNumber,
                            user.fullName,
                        );
                    }
                }
            } catch (error) {
                console.error('Failed to send reply notification:', error);
            }
        }

        // Send Telegram notification with actual message content if agent/admin replied
        if (this.telegramChatBridge && (user.role === UserRole.AGENT || user.role === UserRole.ADMIN)) {
            if (ticket.user && ticket.user.id !== userId) {
                try {
                    await this.telegramChatBridge.forwardAgentReplyToTelegram({
                        ticketId,
                        message: savedMessage,
                        sender: user,
                    });
                } catch (error) {
                    console.error('Failed to send Telegram message:', error);
                }
            }
        }

        // Send email if agent replied (Standard notification)
        if (user.role === UserRole.AGENT || user.role === UserRole.ADMIN) {
            if (ticket.user && ticket.user.email && (!mentionedUserIds || !mentionedUserIds.includes(ticket.user.id))) {
                try {
                    await this.mailerService.sendMail({
                        to: ticket.user.email,
                        subject: `New Reply on Ticket #${ticket.id}`,
                        template: 'ticket-update',
                        context: {
                            name: ticket.user.fullName,
                            ticketId: ticket.id,
                            status: ticket.status,
                            title: ticket.title,
                        },
                    });
                } catch (emailError) {
                    console.error(`Failed to send reply email to ${ticket.user.email}:`, emailError);
                }
            }
        }

        return message;
    }

    async assignTicket(ticketId: string, assigneeId: string, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
        if (!assignee) {
            throw new NotFoundException('Assignee not found');
        }

        if (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN) {
            throw new BadRequestException('Assignee must be an AGENT or ADMIN');
        }

        const assigner = await this.userRepo.findOne({ where: { id: userId } });
        if (!assigner) {
            throw new NotFoundException('Assigner not found');
        }

        const oldAssigneeName = ticket.assignedTo ? ticket.assignedTo.fullName : 'Unassigned';
        ticket.assignedTo = assignee;
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log system message
        const systemMessageContent = `System: Ticket assigned to ${assignee.fullName} (was ${oldAssigneeName}) by ${assigner.fullName}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: assigner.id,
            isSystemMessage: true,
        });
        await this.messageRepo.save(systemMessage);

        this.eventsGateway.server.emit('ticket:updated', { ticketId });
        this.eventsGateway.server.emit('NEW_MESSAGE', systemMessage);
        this.eventsGateway.notifyDashboardStatsUpdate();

        // Send in-app notification for assignment
        if (this.notificationService) {
            try {
                await this.notificationService.notifyTicketAssigned(
                    assignee.id,
                    ticketId,
                    ticket.ticketNumber || ticket.id.split('-')[0],
                    assigner.fullName,
                );
            } catch (error) {
                console.error('Failed to send assignment notification:', error);
            }
        }

        // Notify Assignee via Email
        if (assignee.email) {
            try {
                await this.mailerService.sendMail({
                    to: assignee.email,
                    subject: `Ticket Assigned to You: #${ticket.id}`,
                    template: 'ticket-update',
                    context: {
                        name: assignee.fullName,
                        ticketId: ticket.id,
                        status: ticket.status,
                        title: ticket.title,
                        message: `You have been assigned to this ticket by ${assigner.fullName}.`,
                    },
                });
            } catch (error) {
                console.error(`Failed to send assignment email to ${assignee.email}`, error);
            }
        }

        return savedTicket;
    }

    async cancelTicket(ticketId: string, userId: string, userRole: UserRole, reason?: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check permission: User can only cancel their own tickets, Admin/Agent can cancel any
        if (userRole === UserRole.USER && ticket.user.id !== userId) {
            throw new ForbiddenException('You can only cancel your own tickets');
        }

        // Cannot cancel already resolved or cancelled tickets
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
            throw new BadRequestException('Cannot cancel a ticket that is already resolved or cancelled');
        }

        const oldStatus = ticket.status;
        ticket.status = TicketStatus.CANCELLED;
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log system message
        const cancelReason = reason ? `: ${reason}` : '';
        const systemMessageContent = `System: Ticket cancelled by ${user.fullName}${cancelReason}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: userId,
            isSystemMessage: true,
        });
        await this.messageRepo.save(systemMessage);

        // Emit WebSocket events
        this.eventsGateway.notifyStatusChange(ticketId, TicketStatus.CANCELLED, user.fullName);
        this.eventsGateway.notifyTicketListUpdate();
        this.eventsGateway.notifyDashboardStatsUpdate();

        // Notify relevant parties
        if (this.notificationService) {
            try {
                // If user cancelled, notify assigned agent
                if (userRole === UserRole.USER && ticket.assignedTo) {
                    await this.notificationService.create({
                        userId: ticket.assignedTo.id,
                        type: NotificationType.TICKET_CANCELLED,
                        title: 'Ticket Cancelled',
                        message: `Ticket #${ticket.ticketNumber || ticket.id.split('-')[0]} has been cancelled by ${user.fullName}`,
                        ticketId: ticketId,
                    });
                }
                // If admin/agent cancelled, notify ticket owner
                if ((userRole === UserRole.ADMIN || userRole === UserRole.AGENT) && ticket.user.id !== userId) {
                    await this.notificationService.create({
                        userId: ticket.user.id,
                        type: NotificationType.TICKET_CANCELLED,
                        title: 'Ticket Cancelled',
                        message: `Your ticket #${ticket.ticketNumber || ticket.id.split('-')[0]} has been cancelled by support`,
                        ticketId: ticketId,
                    });
                }
            } catch (error) {
                console.error('Failed to send cancellation notification:', error);
            }
        }

        return savedTicket;
    }

    /**
     * OPTIMIZED: Get dashboard statistics using SQL aggregations
     * Replaces in-memory filtering with efficient database queries
     * Uses caching for 60 seconds to reduce database load
     */
    async getDashboardStats(userId: string, role: UserRole) {
        const cacheKey = CacheKeys.dashboardStats(userId);

        // Try to get from cache first (60 second TTL)
        return this.cacheService.getOrSet(cacheKey, async () => {
            return this.computeDashboardStats();
        }, 60);
    }

    /**
     * Internal method to compute dashboard stats
     */
    private async computeDashboardStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last7DaysStart = new Date(today);
        last7DaysStart.setDate(today.getDate() - 6);

        // Use QueryBuilder for efficient aggregations
        const qb = this.ticketRepo.createQueryBuilder('ticket');

        // 1. Status counts - single query with CASE statements
        const statusCounts = await qb
            .select('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN ticket.status = 'TODO' THEN 1 ELSE 0 END)`, 'open')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .addSelect(`SUM(CASE WHEN ticket.status = 'WAITING_VENDOR' THEN 1 ELSE 0 END)`, 'waitingVendor')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .addSelect(`SUM(CASE WHEN ticket.status != 'RESOLVED' AND ticket.status != 'CANCELLED' AND ticket."slaTarget" IS NOT NULL AND ticket."slaTarget" < NOW() THEN 1 ELSE 0 END)`, 'overdue')
            .getRawOne();

        const total = parseInt(statusCounts.total) || 0;
        const open = parseInt(statusCounts.open) || 0;
        const inProgress = parseInt(statusCounts.inProgress) || 0;
        const waitingVendor = parseInt(statusCounts.waitingVendor) || 0;
        const resolved = parseInt(statusCounts.resolved) || 0;
        const overdue = parseInt(statusCounts.overdue) || 0;
        const slaCompliance = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

        // 2. Priority counts - single query
        const priorityCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.priority')
            .getRawMany();

        const byPriority = {
            CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0,
        };
        priorityCounts.forEach(p => {
            if (p.priority in byPriority) {
                byPriority[p.priority as keyof typeof byPriority] = parseInt(p.count) || 0;
            }
        });

        // 3. Category counts - single query
        const categoryCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`COALESCE(ticket.category, 'GENERAL')`, 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.category')
            .getRawMany();

        const byCategory: Record<string, number> = {};
        categoryCounts.forEach(c => {
            byCategory[c.category || 'GENERAL'] = parseInt(c.count) || 0;
        });

        // 4. Time-based counts - single query
        const timeCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`SUM(CASE WHEN ticket."createdAt" >= :today THEN 1 ELSE 0 END)`, 'todayTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'thisWeekTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisMonth THEN 1 ELSE 0 END)`, 'thisMonthTickets')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' AND ticket."updatedAt" >= :today THEN 1 ELSE 0 END)`, 'resolvedToday')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' AND ticket."updatedAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'resolvedThisWeek')
            .setParameters({ today, thisWeek: thisWeekStart, thisMonth: thisMonthStart })
            .getRawOne();

        const todayTickets = parseInt(timeCounts.todayTickets) || 0;
        const thisWeekTickets = parseInt(timeCounts.thisWeekTickets) || 0;
        const thisMonthTickets = parseInt(timeCounts.thisMonthTickets) || 0;
        const resolvedToday = parseInt(timeCounts.resolvedToday) || 0;
        const resolvedThisWeek = parseInt(timeCounts.resolvedThisWeek) || 0;

        // 5. Last 7 days - single query with date grouping
        const dailyStats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`DATE(ticket."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'created')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .where(`ticket."createdAt" >= :start`, { start: last7DaysStart })
            .groupBy(`DATE(ticket."createdAt")`)
            .orderBy(`DATE(ticket."createdAt")`, 'ASC')
            .getRawMany();

        // Build last 7 days array
        const last7Days: { date: string; created: number; resolved: number }[] = [];
        const dailyMap = new Map(dailyStats.map(d => [
            new Date(d.date).toDateString(),
            { created: parseInt(d.created) || 0, resolved: parseInt(d.resolved) || 0 }
        ]));

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const stats = dailyMap.get(date.toDateString()) || { created: 0, resolved: 0 };
            last7Days.push({
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                created: stats.created,
                resolved: stats.resolved,
            });
        }

        // 6. Recent tickets - limited query with joins
        const recentTickets = await this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoin('ticket.user', 'user')
            .leftJoin('ticket.assignedTo', 'assignedTo')
            .select([
                'ticket.id', 'ticket.ticketNumber', 'ticket.title',
                'ticket.status', 'ticket.priority', 'ticket.category', 'ticket.updatedAt',
                'user.fullName', 'assignedTo.fullName'
            ])
            .orderBy('ticket.updatedAt', 'DESC')
            .take(5)
            .getMany();

        const formattedRecentTickets = recentTickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            category: t.category,
            updatedAt: t.updatedAt,
            user: t.user ? { fullName: t.user.fullName } : null,
            assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        }));

        // 7. Top agents - SQL aggregation
        const agentStats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .innerJoin('ticket.assignedTo', 'agent')
            .select('agent.id', 'agentId')
            .addSelect('agent.fullName', 'name')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .groupBy('agent.id')
            .addGroupBy('agent.fullName')
            .orderBy('resolved', 'DESC')
            .limit(5)
            .getRawMany();

        const topAgents = agentStats.map(a => ({
            name: a.name,
            resolved: parseInt(a.resolved) || 0,
            inProgress: parseInt(a.inProgress) || 0,
        }));

        // 8. Average resolution time - SQL calculation
        const avgTimeResult = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`AVG(EXTRACT(EPOCH FROM (ticket."updatedAt" - ticket."createdAt")) / 60)`, 'avgMinutes')
            .where(`ticket.status = 'RESOLVED'`)
            .getRawOne();

        const avgResolutionMinutes = Math.round(parseFloat(avgTimeResult?.avgMinutes) || 0);
        const avgHours = Math.floor(avgResolutionMinutes / 60);
        const avgMins = avgResolutionMinutes % 60;
        const avgResolutionTime = avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`;

        return {
            total,
            open,
            inProgress,
            waitingVendor,
            resolved,
            overdue,
            slaCompliance,
            byPriority,
            byCategory,
            todayTickets,
            thisWeekTickets,
            thisMonthTickets,
            resolvedToday,
            resolvedThisWeek,
            last7Days,
            recentTickets: formattedRecentTickets,
            topAgents,
            avgResolutionTime,
        };
    }
}
