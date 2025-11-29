import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { AuditService, AuditAction } from '../../audit';

@Injectable()
export class TicketMergeService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventsGateway: EventsGateway,
        private readonly auditService: AuditService,
    ) {}

    async mergeTickets(
        primaryTicketId: string,
        secondaryTicketIds: string[],
        userId: string,
        reason?: string,
    ): Promise<Ticket> {
        if (secondaryTicketIds.includes(primaryTicketId)) {
            throw new BadRequestException('Primary ticket cannot be in the list of secondary tickets');
        }

        const primaryTicket = await this.ticketRepo.findOne({
            where: { id: primaryTicketId },
            relations: ['user', 'assignedTo', 'messages'],
        });

        if (!primaryTicket) {
            throw new NotFoundException('Primary ticket not found');
        }

        const secondaryTickets = await this.ticketRepo.find({
            where: { id: In(secondaryTicketIds) },
            relations: ['user', 'messages'],
        });

        if (secondaryTickets.length !== secondaryTicketIds.length) {
            throw new NotFoundException('One or more secondary tickets not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        for (const secondaryTicket of secondaryTickets) {
            if (secondaryTicket.status === TicketStatus.RESOLVED || secondaryTicket.status === TicketStatus.CANCELLED) {
                throw new BadRequestException(`Cannot merge resolved or cancelled ticket: ${secondaryTicket.ticketNumber}`);
            }
        }

        for (const secondaryTicket of secondaryTickets) {
            const messages = await this.messageRepo.find({
                where: { ticketId: secondaryTicket.id },
                order: { createdAt: 'ASC' },
            });

            for (const message of messages) {
                const mergedMessage = this.messageRepo.create({
                    ticketId: primaryTicketId,
                    senderId: message.senderId,
                    content: `[Merged from #${secondaryTicket.ticketNumber}] ${message.content}`,
                    attachments: message.attachments,
                    isSystemMessage: message.isSystemMessage,
                    createdAt: message.createdAt,
                });
                await this.messageRepo.save(mergedMessage);
            }

            const systemMessage = this.messageRepo.create({
                ticketId: primaryTicketId,
                senderId: userId,
                content: `System: Ticket #${secondaryTicket.ticketNumber} was merged into this ticket by ${user.fullName}${reason ? `. Reason: ${reason}` : ''}`,
                isSystemMessage: true,
            });
            await this.messageRepo.save(systemMessage);

            secondaryTicket.status = TicketStatus.CANCELLED;
            secondaryTicket.description = `[MERGED INTO #${primaryTicket.ticketNumber}] ${secondaryTicket.description}`;
            await this.ticketRepo.save(secondaryTicket);

            const cancelMessage = this.messageRepo.create({
                ticketId: secondaryTicket.id,
                senderId: userId,
                content: `System: This ticket was merged into #${primaryTicket.ticketNumber} by ${user.fullName}`,
                isSystemMessage: true,
            });
            await this.messageRepo.save(cancelMessage);
        }

        await this.auditService.log({
            userId,
            action: AuditAction.TICKET_MERGE,
            entityType: 'Ticket',
            entityId: primaryTicketId,
            oldValue: { secondaryTicketIds },
            newValue: { mergedInto: primaryTicketId },
            description: `Merged ${secondaryTicketIds.length} tickets into #${primaryTicket.ticketNumber}`,
        });

        this.eventsGateway.server.emit('ticket:updated', { ticketId: primaryTicketId });
        this.eventsGateway.notifyTicketListUpdate();
        this.eventsGateway.notifyDashboardStatsUpdate();

        return this.ticketRepo.findOne({
            where: { id: primaryTicketId },
            relations: ['user', 'assignedTo', 'messages', 'messages.sender'],
        });
    }
}
