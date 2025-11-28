import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Ticket, TicketStatus, TicketSource } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { CacheService } from '../../../shared/core/cache';
import { TicketCreatedEvent } from '../events/ticket-created.event';

@Injectable()
export class TicketCreateService {
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
        private readonly cacheService: CacheService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async createTicket(userId: string, createTicketDto: any, files: string[] = []): Promise<Ticket> {
        try {
            const user = await this.userRepo.findOne({
                where: { id: userId },
                relations: ['department']
            });
            if (!user) {
                throw new NotFoundException('User not found');
            }

            const ticket = this.ticketRepo.create({
                ...createTicketDto,
                user,
                status: TicketStatus.TODO,
                source: createTicketDto.source || TicketSource.WEB,
                category: createTicketDto.category || 'GENERAL',
                device: createTicketDto.device,
                software: createTicketDto.software,
            } as DeepPartial<Ticket>);

            // Generate Custom Ticket Number
            const date = new Date();
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString().slice(-2);
            const dateStr = `${day}${month}${year}`;

            const division = user.department?.name ? user.department.name.substring(0, 3).toUpperCase() : 'GEN';

            // Get count for today to increment
            const count = await this.ticketRepo.count({
                where: {
                    createdAt: MoreThanOrEqual(new Date(date.setHours(0, 0, 0, 0))),
                }
            });
            const number = (count + 1).toString().padStart(4, '0');

            ticket.ticketNumber = `${dateStr}-${division}-${number}`;

            // Set initial SLA Target based on priority
            const priority = createTicketDto.priority || 'MEDIUM';
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority } });
            if (slaConfig) {
                const now = new Date();
                ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
            }

            await this.ticketRepo.save(ticket);

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

            // Emit Domain Event
            this.eventEmitter.emit(
                'ticket.created',
                new TicketCreatedEvent(
                    ticket.id,
                    ticket.ticketNumber,
                    ticket.title,
                    ticket.priority,
                    ticket.category,
                    ticket.status,
                    user.id,
                    user.fullName,
                    user.email,
                    ticket.createdAt,
                ),
            );

            return ticket;
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    }
}
