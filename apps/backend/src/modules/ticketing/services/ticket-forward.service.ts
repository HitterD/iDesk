import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, HandlingTeam } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { WorkloadService } from '../../workload/workload.service';
import { BusinessHoursService } from '../../sla-config/business-hours.service';

/**
 * Move a ticket between the ops-support and the Oracle/Dev teams.
 * The reason is mandatory and quoted in the system message so the
 * handover is auditable.
 *
 * Forwarding to OPS_SUPPORT unassigns the previous agent and auto-assigns
 * the best available ops agent for the ticket site (mirrors ticket create),
 * then resets the SLA clock. Forwarding to ORACLE_DEV does not auto-assign
 * (Oracle dev has no workload pool) but still resets the SLA clock.
 */
@Injectable()
export class TicketForwardService {
    private readonly logger = new Logger(TicketForwardService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly eventsGateway: EventsGateway,
        private readonly workloadService: WorkloadService,
        private readonly businessHoursService: BusinessHoursService,
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
        const previousAssignee = ticket.assignedTo?.fullName || null;
        const changeNotes: string[] = [
            `Ticket forwarded from ${previousTeam} to ${dto.targetTeam}. Reason: ${dto.reason}`,
        ];
        ticket.handlingTeam = dto.targetTeam;

        // Moving to OPS_SUPPORT gives the ticket a fresh ops agent; the old
        // (possibly K2) assignee is released.
        if (dto.targetTeam === HandlingTeam.OPS_SUPPORT) {
            ticket.assignedTo = null;
            ticket.assignedToId = null;
        }

        // Reset the resolution SLA clock: a forwarded ticket gets a fresh
        // budget under the new team, not the leftovers of the previous one.
        await this.resetResolutionSla(ticket, changeNotes);

        const saved = await this.ticketRepo.save(ticket);

        // Auto-assign the best ops agent for the site (mirrors create). Only
        // OPS_SUPPORT tickets — Oracle dev has no workload pool. Skipped when
        // the ticket has no site, since the workload pool is site-scoped.
        if (dto.targetTeam === HandlingTeam.OPS_SUPPORT && ticket.siteId) {
            try {
                const assigned = await this.workloadService.autoAssignTicket(ticket.id);
                saved.assignedToId = assigned.assignedToId;
                saved.assignedTo = assigned.assignedTo;
                changeNotes.push(
                    `Auto-assigned to ${assigned.assignedTo?.fullName ?? 'agent'} (${assigned.assignedToId ?? 'unknown'})`,
                );
                await this.ticketRepo.save(saved);
            } catch (err: any) {
                // No available agents / site issue: log, don't fail the forward.
                this.logger.warn(
                    `Auto-assign after forward skipped for ${ticket.ticketNumber || ticket.id}: ${err?.message ?? err}`,
                );
                changeNotes.push('Auto-assign skipped (no available agent for this site)');
            }
        }

        const message = this.messageRepo.create({
            content: changeNotes.join('\n'),
            ticket: saved,
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

    /**
     * Restart the resolution SLA clock for a forwarded ticket.
     * slaStartedAt = now, slaTarget recalculated from the priority config,
     * originalSlaTarget anchored to the new target, overdue cleared.
     * The first-response clock is left as-is (it is about the requester,
     * not the handling team).
     */
    private async resetResolutionSla(ticket: Ticket, notes: string[]): Promise<void> {
        const now = new Date();
        const slaConfig = await this.slaConfigRepo.findOne({
            where: { priority: ticket.priority },
        });

        ticket.slaStartedAt = now;
        ticket.isOverdue = false;
        ticket.isFirstResponseBreached = false;

        if (ticket.status === TicketStatus.IN_PROGRESS || ticket.status === TicketStatus.TODO) {
            if (slaConfig) {
                if (this.businessHoursService) {
                    ticket.slaTarget = await this.businessHoursService.calculateSlaTarget(
                        now,
                        slaConfig.resolutionTimeMinutes,
                    );
                } else {
                    ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
                }
                ticket.originalSlaTarget = new Date(ticket.slaTarget);
                notes.push(
                    `SLA reset. Target: ${ticket.slaTarget.toISOString()} (${slaConfig.resolutionTimeMinutes} minutes for ${ticket.priority})`,
                );
            } else {
                ticket.slaTarget = null;
                ticket.originalSlaTarget = null;
                notes.push('SLA reset (no SlaConfig for this priority)');
            }
        } else {
            // Not actively worked on: clear the clock so it restarts when work resumes.
            ticket.slaTarget = null;
            ticket.originalSlaTarget = null;
            notes.push('SLA cleared (ticket not in progress)');
        }
    }
}
