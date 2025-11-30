import { Injectable, Inject, NotFoundException, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { TicketRepliedEvent } from '../events/ticket-replied.event';

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
        private readonly eventsGateway: EventsGateway,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async findMessages(ticketId: string) {
        return this.messageRepo.find({
            where: { ticketId },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }

    async getMessages(ticketId: string): Promise<TicketMessage[]> {
        return this.findMessages(ticketId);
    }

    async replyToTicket(ticketId: string, userId: string, content: string, files: string[] = [], mentionedUserIds: string[] = []) {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
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

        // === Track First Response Time ===
        const isAgentOrAdmin = user.role === UserRole.AGENT || user.role === UserRole.ADMIN;
        const isFirstAgentReply = !ticket.firstResponseAt && isAgentOrAdmin;

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
        if (isAgentOrAdmin && ticket.status === TicketStatus.TODO) {
            ticket.status = TicketStatus.IN_PROGRESS;

            // Also start SLA timer if not started
            if (!ticket.slaStartedAt) {
                const now = new Date();
                ticket.slaStartedAt = now;

                const slaConfig = await this.slaConfigRepo.findOne({
                    where: { priority: ticket.priority }
                });

                if (slaConfig) {
                    ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
                    this.logger.log(`SLA Timer started for ticket #${ticket.ticketNumber}. Target: ${ticket.slaTarget}`);
                }
            }
        }

        // Save ticket changes if any
        if (isFirstAgentReply || (isAgentOrAdmin && ticket.status === TicketStatus.IN_PROGRESS)) {
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
                user.role,
                mentionedUserIds,
            ),
        );

        return message;
    }
}
