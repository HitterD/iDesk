import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketType, HandlingTeam, TICKET_INACTIVE_STATUSES } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { WorkloadService } from '../../workload/workload.service';
import { SlaClockService } from './sla-clock.service';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { NotificationService } from '../../notifications/notification.service';
import { validateTicketAccess } from '../utils/oracle-ticket-access.util';
import { validateTicketSiteAccess } from '../utils/site-access.util';
import { presentMessage } from '../utils/message-presenter.util';

/**
 * Move a ticket between ops-support (within or across self-handled sites) and developer teams.
 * The reason is mandatory and quoted in the system message so the handover is auditable.
 *
 * Forwarding to OPS_SUPPORT unassigns the previous agent (recalculating old workload), moves site
 * when requested, auto-assigns the best available ops agent for the destination site (mirrors ticket create),
 * notifies destination ops agents if left unassigned, and resets the resolution SLA clock.
 * Forwarding to dev teams releases the assignee and resets the SLA clock.
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
        private readonly slaClock: SlaClockService,
        @Optional()
        private readonly eventEmitter?: EventEmitter2,
        @Optional() @InjectRepository(Site)
        private readonly siteRepo?: Repository<Site>,
        @Optional() @InjectRepository(User)
        private readonly userRepo?: Repository<User>,
        @Optional()
        private readonly notificationService?: NotificationService,
    ) {}

    async forwardTicket(
        ticketId: string,
        dto: { targetTeam: HandlingTeam; reason: string; targetSiteId?: string },
        actor: { userId: string; fullName: string; role?: UserRole | string; siteId?: string | null },
    ): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['site', 'assignedTo', 'user'],
        });
        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        if (actor.role) {
            validateTicketAccess({ role: actor.role }, ticket);
            validateTicketSiteAccess(actor.role as UserRole, actor.siteId ?? null, ticket.siteId);
        }

        if (TICKET_INACTIVE_STATUSES.includes(ticket.status)) {
            throw new ConflictException('Cannot forward a resolved, closed or cancelled ticket');
        }

        if (dto.targetTeam !== HandlingTeam.OPS_SUPPORT && dto.targetSiteId && dto.targetSiteId !== ticket.siteId) {
            throw new BadRequestException('Target site can only be changed when forwarding to OPS_SUPPORT');
        }

        const previousTeam = ticket.handlingTeam ?? HandlingTeam.OPS_SUPPORT;
        const previousSiteId = ticket.siteId ?? null;
        const targetSiteId = dto.targetTeam === HandlingTeam.OPS_SUPPORT
            ? (dto.targetSiteId ?? previousSiteId)
            : previousSiteId;

        if (previousTeam === dto.targetTeam && targetSiteId === previousSiteId) {
            throw new ConflictException(
                `Ticket is already handled by ${dto.targetTeam}`,
            );
        }

        const siteChanged = Boolean(targetSiteId && targetSiteId !== previousSiteId);
        const targetSite = siteChanged && targetSiteId
            ? await this.validateTargetSite(targetSiteId)
            : null;
        const originSite = ticket.site ?? (previousSiteId && this.siteRepo
            ? await this.siteRepo.findOne({ where: { id: previousSiteId } })
            : null);

        const previousAssigneeId = ticket.assignedToId ?? ticket.assignedTo?.id ?? null;
        const changeNotes: string[] = [
            `Ticket forwarded from ${previousTeam} to ${dto.targetTeam} by ${actor.fullName}. Reason: ${dto.reason}`,
        ];
        if (siteChanged && targetSiteId) {
            const fromCode = originSite?.code ?? previousSiteId ?? 'unknown';
            const toCode = targetSite?.code ?? targetSiteId;
            changeNotes.push(`Site forwarded: ${fromCode} -> ${toCode}`);
        }

        ticket.handlingTeam = dto.targetTeam;
        ticket.forwardedFromTeam = previousTeam;
        ticket.forwardedAt = new Date();
        ticket.forwardedById = actor.userId;
        ticket.forwardedFromSiteId = siteChanged ? previousSiteId : null;
        ticket.forwardedFromSite = siteChanged ? (originSite ?? null) : null;
        if (siteChanged && targetSiteId) {
            ticket.siteId = targetSiteId;
            if (targetSite) {
                ticket.site = targetSite;
            }
        }

        // Release previous assignee and adjust ticket type based on target team
        ticket.assignedTo = null;
        ticket.assignedToId = null;

        if (dto.targetTeam === HandlingTeam.MOBILE_DEV) {
            ticket.ticketType = TicketType.MOBILE_DEV_REQUEST;
            ticket.category = 'MOBILE_DEV_REQUEST';
        } else if (dto.targetTeam === HandlingTeam.WEB_DEV) {
            ticket.ticketType = TicketType.WEB_DEV_REQUEST;
            ticket.category = 'WEB_DEV_REQUEST';
        } else if (dto.targetTeam === HandlingTeam.ORACLE_DEV) {
            ticket.ticketType = TicketType.ORACLE_REQUEST;
            ticket.category = 'ORACLE_REQUEST';
        } else if (dto.targetTeam === HandlingTeam.OPS_SUPPORT && previousTeam !== HandlingTeam.OPS_SUPPORT) {
            ticket.ticketType = TicketType.SERVICE;
            ticket.category = 'GENERAL';
        }

        // Reset the resolution SLA clock: a forwarded ticket gets a fresh
        // budget under the new team, not the leftovers of the previous one.
        await this.resetResolutionSla(ticket, changeNotes);

        const saved = await this.ticketRepo.save(ticket);

        if (previousAssigneeId && typeof this.workloadService?.recalculateAgentWorkload === 'function') {
            try {
                await this.workloadService.recalculateAgentWorkload(
                    { role: UserRole.ADMIN, siteId: previousSiteId ?? undefined },
                    previousAssigneeId,
                    previousSiteId ?? undefined,
                );
            } catch (err: any) {
                this.logger.warn(
                    `Workload recalculation failed for previous PIC ${previousAssigneeId} on ${ticket.ticketNumber || ticketId}: ${err?.message ?? err}`,
                );
            }
        }

        // Auto-assign the best ops agent for the site (mirrors create). Only
        // OPS_SUPPORT tickets — dev teams have no workload pool. Skipped when
        // the ticket has no site, since the workload pool is site-scoped.
        if (dto.targetTeam === HandlingTeam.OPS_SUPPORT && saved.siteId) {
            try {
                const assigned = await this.workloadService.autoAssignTicket(ticket.id);
                saved.assignedToId = assigned.assignedToId;
                saved.assignedTo = assigned.assignedTo;
                changeNotes.push(
                    `Auto-assigned to ${assigned.assignedTo?.fullName ?? 'agent'} (${assigned.assignedToId ?? 'unknown'})`,
                );
                await this.ticketRepo.save(saved);
            } catch (err: any) {
                // Auto-assign disabled for the target module, or no eligible
                // agent: log, don't fail the forward.
                this.logger.warn(
                    `Auto-assign after forward skipped for ${ticket.ticketNumber || ticket.id}: ${err?.message ?? err}`,
                );
                changeNotes.push('Auto-assign skipped (tidak ada agent yang tersedia untuk modul ini)');
            }

            if (!saved.assignedToId && (siteChanged || previousTeam !== HandlingTeam.OPS_SUPPORT)) {
                await this.notifyDestinationOpsAgents(saved, actor.userId, actor.fullName);
            }
        }

        const message = this.messageRepo.create({
            content: changeNotes.join('\n'),
            ticket: saved,
            senderId: actor.userId,
            isSystemMessage: true,
        });
        const savedMessage = await this.messageRepo.save(message);
        this.eventsGateway?.notifyNewMessage?.(ticketId, {
            ...presentMessage(savedMessage),
            sender: {
                id: actor.userId,
                fullName: actor.fullName,
                role: actor.role ?? UserRole.AGENT,
            },
        });

        this.emitForwardUpdates(saved, previousSiteId, saved.siteId ?? null);

        this.logger.log(
            `Ticket ${ticket.ticketNumber || ticketId} forwarded ${previousTeam} -> ${dto.targetTeam}` +
            (siteChanged ? ` (site ${previousSiteId ?? 'none'} -> ${saved.siteId})` : '') +
            ` by ${actor.fullName} (${actor.userId})`,
        );

        return saved;
    }

    private async validateTargetSite(targetSiteId: string): Promise<Site | null> {
        if (!this.siteRepo) return null;
        const targetSite = await this.siteRepo.findOne({ where: { id: targetSiteId } });
        if (!targetSite || !targetSite.isActive) {
            throw new BadRequestException('Target site not found or inactive');
        }
        if (targetSite.handledBySiteId) {
            throw new BadRequestException('Cannot forward directly to a delegated site');
        }
        return targetSite;
    }

    private async notifyDestinationOpsAgents(ticket: Ticket, actorId: string, actorName: string): Promise<void> {
        if (!this.userRepo || !this.notificationService || !ticket.siteId) return;
        try {
            const agents = await this.userRepo.find({
                where: {
                    role: In([UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT]),
                    siteId: ticket.siteId,
                    isActive: true,
                },
                select: ['id'],
            });
            const agentIds = agents.map(a => a.id).filter(id => id !== actorId);
            if (!agentIds.length) return;
            await this.notificationService.notifyNewTicketToAdmins(
                ticket.id,
                ticket.ticketNumber,
                ticket.title,
                ticket.priority,
                ticket.category,
                ticket.user?.fullName || actorName,
                agentIds,
            );
        } catch (err: any) {
            this.logger.warn(`Failed to notify destination OPS agents for ticket ${ticket.id}: ${err?.message ?? err}`);
        }
    }

    private emitForwardUpdates(ticket: Ticket, previousSiteId: string | null, nextSiteId: string | null): void {
        const ticketId = ticket.id;
        void this.eventsGateway?.pruneTicketRooms?.(ticket);
        const affectedSites = [...new Set([previousSiteId, nextSiteId].filter((id): id is string => Boolean(id)))];
        this.eventsGateway?.server?.to?.(`ticket:${ticketId}`)?.emit('ticket:updated', { ticketId });
        for (const siteId of affectedSites) {
            if (typeof this.eventsGateway?.emitToTicketAudience === 'function') {
                this.eventsGateway.emitToTicketAudience(siteId, 'ticket:updated', { ticketId });
            } else {
                this.eventsGateway?.server?.to?.(`site:${siteId}`)?.emit('ticket:updated', { ticketId });
            }
            this.eventsGateway?.notifyTicketListUpdate?.(siteId);
            this.eventsGateway?.notifyDashboardStatsUpdate?.(siteId);
            this.eventEmitter?.emit('tv-board.ticket-changed', { siteId });
        }
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
        ticket.slaStartedAt = now;
        ticket.isOverdue = false;
        ticket.isFirstResponseBreached = false;

        if (ticket.status === TicketStatus.IN_PROGRESS || ticket.status === TicketStatus.TODO) {
            const slaConfig = await this.slaClock.startResolution(ticket, now);
            if (slaConfig) {
                notes.push(
                    `SLA reset. Target: ${ticket.slaTarget!.toISOString()} (${slaConfig.resolutionTimeMinutes} minutes for ${ticket.priority})`,
                );
            } else {
                ticket.slaTarget = null;
                ticket.originalSlaTarget = null;
                notes.push('SLA reset (no SlaConfig for this priority)');
            }
        } else if (ticket.status === TicketStatus.WAITING_VENDOR) {
            // Paused at the vendor: restart with the full budget, held until the vendor answers.
            const slaConfig = await this.slaClock.startResolution(ticket, now);
            ticket.slaRemainingMinutes = slaConfig ? slaConfig.resolutionTimeMinutes : null;
            notes.push('SLA reset and held for waiting-vendor');
        } else {
            // Not actively worked on: clear the clock so it restarts when work resumes.
            ticket.slaTarget = null;
            ticket.originalSlaTarget = null;
            ticket.slaRemainingMinutes = null;
            notes.push('SLA cleared (ticket not in progress)');
        }
    }
}
