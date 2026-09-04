import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Ticket, TicketType } from '../entities/ticket.entity';
import { TicketParticipant } from '../entities/ticket-participant.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { isOracleK2Category } from '../utils/oracle-ticket-access.util';

@Injectable()
export class TicketParticipantService {
    private readonly logger = new Logger(TicketParticipantService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketParticipant)
        private readonly participantRepo: Repository<TicketParticipant>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Get all participants for a specific ticket
     */
    async getParticipants(ticketId: string): Promise<TicketParticipant[]> {
        return this.participantRepo.find({
            where: { ticketId },
            relations: ['user', 'user.department', 'invitedBy'],
            order: { joinedAt: 'ASC' },
        });
    }

    /**
     * Add multiple users to a ticket
     */
    async addParticipants(
        ticketId: string,
        userIds: string[],
        actorUserId: string,
        actorRole: UserRole,
    ): Promise<TicketParticipant[]> {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new BadRequestException('Daftar userId tidak boleh kosong');
        }

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user', 'assignedTo'],
        });

        if (!ticket) {
            throw new NotFoundException('Tiket tidak ditemukan');
        }

        const isOracle = isOracleK2Category(ticket.category, ticket.ticketType);
        const isAdmin = actorRole === UserRole.ADMIN;
        const isAgentOracle = actorRole === UserRole.AGENT_ORACLE;
        const isCreator = ticket.userId === actorUserId;

        // Check if actor is an existing participant
        const existingActorParticipant = await this.participantRepo.findOne({
            where: { ticketId, userId: actorUserId },
        });

        // Any of: Admin, Agent Oracle, Creator, or existing participant can add
        if (!isAdmin && !isAgentOracle && !isCreator && !existingActorParticipant) {
            throw new ForbiddenException('Anda tidak memiliki izin untuk menambahkan user ke tiket ini');
        }

        const actor = await this.userRepo.findOne({ where: { id: actorUserId } });
        const actorName = actor?.fullName || 'User';

        // Load users to add
        const targetUsers = await this.userRepo.find({
            where: { id: In(userIds), isActive: true },
            relations: ['department'],
        });

        if (targetUsers.length === 0) {
            throw new BadRequestException('User tidak ditemukan atau tidak aktif');
        }

        const existingParticipants = await this.participantRepo.find({
            where: { ticketId },
            select: ['userId'],
        });
        const existingSet = new Set(existingParticipants.map((p) => p.userId));
        // Creator is implicitly part of the ticket
        if (ticket.userId) existingSet.add(ticket.userId);

        const newlyAddedUsers: User[] = [];
        const addedParticipants: TicketParticipant[] = [];

        await this.dataSource.transaction(async (manager) => {
            for (const targetUser of targetUsers) {
                if (existingSet.has(targetUser.id)) {
                    continue; // Skip if already a participant or creator
                }

                const participant = manager.create(TicketParticipant, {
                    ticketId: ticket.id,
                    userId: targetUser.id,
                    invitedById: actorUserId,
                    role: 'PARTICIPANT',
                });
                const saved = await manager.save(TicketParticipant, participant);
                saved.user = targetUser;
                saved.invitedBy = actor;
                addedParticipants.push(saved);
                newlyAddedUsers.push(targetUser);
                existingSet.add(targetUser.id);

                // Insert System Message
                const systemMessage = manager.create(TicketMessage, {
                    ticketId: ticket.id,
                    senderId: actorUserId,
                    content: `${actorName} menambahkan ${targetUser.fullName} ke dalam tiket`,
                    isSystemMessage: true,
                    isInternal: false,
                    source: 'WEB',
                });
                const savedMsg = await manager.save(TicketMessage, systemMessage);

                // Notify WebSocket
                const msgWithSender = {
                    ...savedMsg,
                    sender: {
                        id: actor?.id || actorUserId,
                        fullName: actorName,
                        role: actorRole,
                    },
                };
                this.eventsGateway.notifyNewMessage(ticketId, msgWithSender);
                this.eventsGateway.server.emit('NEW_MESSAGE', msgWithSender);
            }
        });

        // Broadcast participant added event and in-app notifications
        for (const addedUser of newlyAddedUsers) {
            try {
                this.eventsGateway.server.to(`ticket_${ticketId}`).emit('ticket:participant_added', {
                    ticketId,
                    user: {
                        id: addedUser.id,
                        fullName: addedUser.fullName,
                        email: addedUser.email,
                        department: addedUser.department ? { name: addedUser.department.name } : undefined,
                    },
                    addedBy: {
                        id: actorUserId,
                        fullName: actorName,
                    },
                });

                // Send In-App Notification to the invited user
                if (addedUser.id !== actorUserId) {
                    await this.notificationService.create({
                        userId: addedUser.id,
                        type: NotificationType.TICKET_CREATED,
                        title: 'Anda Ditambahkan ke Tiket Oracle',
                        message: `${actorName} mengundang Anda ke tiket #${ticket.ticketNumber || ticket.id.slice(0, 8)}: ${ticket.title}`,
                        link: `/client/tickets/${ticket.id}`,
                    });
                }
            } catch (err) {
                this.logger.error(`Error sending participant added notification: ${err}`);
            }
        }

        // Emit list refresh for connected clients
        try {
            this.eventsGateway.server.emit('ticket:updated', { ticketId, ticket });
            this.eventsGateway.server.emit('tickets:listUpdated', { ticketId });
        } catch (err) {
            this.logger.error(`Error emitting ticket list update: ${err}`);
        }

        return this.getParticipants(ticketId);
    }

    /**
     * Remove a participant from a ticket.
     * Restriction: Only AGENT_ORACLE and ADMIN can delete/remove participants!
     */
    async removeParticipant(
        ticketId: string,
        targetUserId: string,
        actorUserId: string,
        actorRole: UserRole,
    ): Promise<{ success: boolean; message: string }> {
        const isAdmin = actorRole === UserRole.ADMIN;
        const isAgentOracle = actorRole === UserRole.AGENT_ORACLE;

        if (!isAdmin && !isAgentOracle) {
            throw new ForbiddenException('Khusus Agent Oracle dan Admin yang dapat menghapus partisipan dari tiket');
        }

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
        });

        if (!ticket) {
            throw new NotFoundException('Tiket tidak ditemukan');
        }

        if (ticket.userId === targetUserId) {
            throw new BadRequestException('Pembuat tiket (Creator) tidak dapat dihapus dari tiket');
        }

        const participant = await this.participantRepo.findOne({
            where: { ticketId, userId: targetUserId },
            relations: ['user'],
        });

        if (!participant) {
            throw new NotFoundException('Partisipan tidak ditemukan pada tiket ini');
        }

        const actor = await this.userRepo.findOne({ where: { id: actorUserId } });
        const actorName = actor?.fullName || 'Agent';
        const targetName = participant.user?.fullName || 'User';

        await this.dataSource.transaction(async (manager) => {
            await manager.delete(TicketParticipant, { id: participant.id });

            // Create System Message
            const systemMessage = manager.create(TicketMessage, {
                ticketId: ticket.id,
                senderId: actorUserId,
                content: `${actorName} mengeluarkan ${targetName} dari tiket`,
                isSystemMessage: true,
                isInternal: false,
                source: 'WEB',
            });
            const savedMsg = await manager.save(TicketMessage, systemMessage);

            const msgWithSender = {
                ...savedMsg,
                sender: {
                    id: actor?.id || actorUserId,
                    fullName: actorName,
                    role: actorRole,
                },
            };
            this.eventsGateway.notifyNewMessage(ticketId, msgWithSender);
            this.eventsGateway.server.emit('NEW_MESSAGE', msgWithSender);
        });

        // Broadcast removal event
        try {
            this.eventsGateway.server.to(`ticket_${ticketId}`).emit('ticket:participant_removed', {
                ticketId,
                userId: targetUserId,
                removedBy: {
                    id: actorUserId,
                    fullName: actorName,
                },
            });
            this.eventsGateway.server.emit('ticket:updated', { ticketId, ticket });
            this.eventsGateway.server.emit('tickets:listUpdated', { ticketId });
        } catch (err) {
            this.logger.error(`Error emitting participant removed event: ${err}`);
        }

        return {
            success: true,
            message: `Partisipan ${targetName} berhasil dikeluarkan dari tiket`,
        };
    }

    /**
     * Check if a given user is either the creator or a registered participant of a ticket
     */
    async isUserParticipant(ticketId: string, userId: string): Promise<boolean> {
        const count = await this.participantRepo.count({
            where: { ticketId, userId },
        });
        return count > 0;
    }
}
