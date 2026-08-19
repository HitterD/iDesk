import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { AuditService, AuditAction } from '../../audit';
import { assertTicketRoleAccess } from './ticket-oracle-access';
import { validateTicketSiteAccess } from '../utils/site-access.util';

@Injectable()
export class TicketMergeService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
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

        // P1 fix: source ticket status update + new message insert + target
        // ticket update were three separate awaits (per secondary ticket
        // that's 4+ writes). A crash left messages orphaned on a cancelled
        // ticket, or the cancel-status without the merge message. Now atomic
        // via dataSource.transaction.
        const secondaryTicketNumbers = await this.dataSource.transaction(async (manager) => {
            const primaryTicket = await manager.findOne(Ticket, {
                where: { id: primaryTicketId },
                relations: ['user', 'assignedTo'],
            });
            if (!primaryTicket) {
                throw new NotFoundException('Primary ticket not found');
            }

            const secondaryTickets = await manager.find(Ticket, {
                where: { id: In(secondaryTicketIds) },
                relations: ['user'],
            });
            if (secondaryTickets.length !== secondaryTicketIds.length) {
                throw new NotFoundException('One or more secondary tickets not found');
            }

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new NotFoundException('User not found');
            }

            assertTicketRoleAccess(primaryTicket, user.role);
            for (const secondaryTicket of secondaryTickets) {
                assertTicketRoleAccess(secondaryTicket, user.role);
            }

            // Site isolation: every ticket in the merge set must be from the caller's site.
            validateTicketSiteAccess(user.role as any, (user as any).siteId ?? null, (primaryTicket as any).siteId ?? null);
            for (const secondaryTicket of secondaryTickets) {
                validateTicketSiteAccess(user.role as any, (user as any).siteId ?? null, (secondaryTicket as any).siteId ?? null);
            }

            // Pre-validate status before any writes
            for (const secondaryTicket of secondaryTickets) {
                if (secondaryTicket.status === TicketStatus.RESOLVED || secondaryTicket.status === TicketStatus.CANCELLED) {
                    throw new BadRequestException(`Cannot merge resolved or cancelled ticket: ${secondaryTicket.ticketNumber}`);
                }
            }

            const ticketNumbers: string[] = [];
            for (const secondaryTicket of secondaryTickets) {
                ticketNumbers.push(secondaryTicket.ticketNumber);

                // Move all source messages to the primary ticket in one bulk save
                const messages = await manager.find(TicketMessage, {
                    where: { ticketId: secondaryTicket.id },
                    order: { createdAt: 'ASC' },
                });

                const movedMessages = messages.map((message) =>
                    manager.create(TicketMessage, {
                        ticketId: primaryTicketId,
                        senderId: message.senderId,
                        content: `[Merged from #${secondaryTicket.ticketNumber}] ${message.content}`,
                        attachments: message.attachments,
                        isSystemMessage: message.isSystemMessage,
                        createdAt: message.createdAt,
                    }),
                );
                if (movedMessages.length > 0) {
                    await manager.save(TicketMessage, movedMessages);
                }

                // System note on the primary ticket
                const systemMessage = manager.create(TicketMessage, {
                    ticketId: primaryTicketId,
                    senderId: userId,
                    content: `System: Ticket #${secondaryTicket.ticketNumber} was merged into this ticket by ${user.fullName}${reason ? `. Reason: ${reason}` : ''}`,
                    isSystemMessage: true,
                });
                await manager.save(TicketMessage, systemMessage);

                // Mark secondary as cancelled (with a final system message)
                secondaryTicket.status = TicketStatus.CANCELLED;
                secondaryTicket.description = `[MERGED INTO #${primaryTicket.ticketNumber}] ${secondaryTicket.description}`;
                await manager.save(Ticket, secondaryTicket);

                const cancelMessage = manager.create(TicketMessage, {
                    ticketId: secondaryTicket.id,
                    senderId: userId,
                    content: `System: This ticket was merged into #${primaryTicket.ticketNumber} by ${user.fullName}`,
                    isSystemMessage: true,
                });
                await manager.save(TicketMessage, cancelMessage);
            }

            return ticketNumbers;
        });

        // Post-commit side effects (audit + WS push) — these should fire only
        // if the transaction succeeded.
        await this.auditService.log({
            userId,
            action: AuditAction.TICKET_MERGE,
            entityType: 'Ticket',
            entityId: primaryTicketId,
            oldValue: { secondaryTicketIds },
            newValue: { mergedInto: primaryTicketId, secondaryTicketNumbers },
            description: `Merged ${secondaryTicketIds.length} tickets into primary`,
        });

        const ticket = await this.ticketRepo.findOne({
            where: { id: primaryTicketId },
            relations: ['user', 'assignedTo', 'messages', 'messages.sender'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        this.eventsGateway.server.emit('ticket:updated', { ticketId: primaryTicketId });
        if ((ticket as any).siteId) {
            this.eventsGateway.server.to(`site:${(ticket as any).siteId}`).emit('ticket:updated', { ticketId: primaryTicketId });
        }
        this.eventsGateway.notifyTicketListUpdate((ticket as any).siteId ?? null);
        this.eventsGateway.notifyDashboardStatsUpdate((ticket as any).siteId ?? null);
        return ticket;
    }
}
