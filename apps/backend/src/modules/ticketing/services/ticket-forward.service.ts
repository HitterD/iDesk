import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, HandlingTeam } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';

/**
 * Move a ticket between the ops-support and the Oracle/Dev teams.
 * The reason is mandatory and quoted in the system message so the
 * handover is auditable.
 */
@Injectable()
export class TicketForwardService {
    private readonly logger = new Logger(TicketForwardService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async forwardTicket(
        ticketId: string,
        dto: { targetTeam: HandlingTeam; reason: string },
        actor: { userId: string; fullName: string },
    ): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
            throw new ConflictException('Cannot forward a resolved or cancelled ticket');
        }

        if (ticket.handlingTeam === dto.targetTeam) {
            throw new ConflictException(
                `Ticket is already handled by ${dto.targetTeam}`,
            );
        }

        const previousTeam = ticket.handlingTeam;
        ticket.handlingTeam = dto.targetTeam;
        // A forward bumps the overdue marker off and lets the next SLA check
        // re-evaluate against the same target; the assigned agent is kept as
        // the ticket owner until someone from the other team picks it up.
        ticket.isOverdue = false;

        const saved = await this.ticketRepo.save(ticket);

        const message = this.messageRepo.create({
            content: `Ticket forwarded from ${previousTeam} to ${dto.targetTeam}. Reason: ${dto.reason}`,
            ticket,
            senderId: actor.userId,
            isSystemMessage: true,
        });
        await this.messageRepo.save(message);

        this.eventsGateway.server
            .to(`site:${(saved as any).siteId}`)
            .emit('ticket:updated', { ticketId });

        this.logger.log(
            `Ticket ${ticket.ticketNumber || ticketId} forwarded ${previousTeam} -> ${dto.targetTeam} by ${actor.fullName} (${actor.userId})`,
        );

        return saved;
    }
}
