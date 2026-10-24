import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { SlaClockService } from './sla-clock.service';
import { TicketVendorVisitService } from './ticket-vendor-visit.service';
import { WorkloadService } from '../../workload/workload.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { TicketActivityChange, TicketSystemEvent } from '../utils/ticket-activity.util';

const MINUTE_MS = 60_000;

/** The request-specific part of a system message (e.g. `{ hardwareRequest }` or `{ eformRequest }`, plus a reason). */
export type LinkedRequestEvent = Omit<TicketSystemEvent, 'v' | 'actor' | 'changes'>;

export interface LinkedPhase {
    ticketId: string;
    actorId?: string | null;
    /** Where the ticket goes at this step; omitted for steps that only inform. */
    target?: TicketStatus;
    /** Chat text (also used by email and search); the structured event drives the card. */
    text: string;
    event: LinkedRequestEvent;
}

/**
 * Mirrors a request raised from a ticket (hardware request, e-form access) onto that ticket: one system message per
 * step and, while the request runs, a wait that holds the SLA like a vendor wait, resuming or closing with it.
 * The request is the source of truth; failures here are logged and never thrown back into its flow.
 */
@Injectable()
export class TicketLinkedRequestService {
    private readonly logger = new Logger(TicketLinkedRequestService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly slaClock: SlaClockService,
        private readonly vendorVisit: TicketVendorVisitService,
        private readonly eventsGateway: EventsGateway,
        private readonly workloadService: WorkloadService,
    ) {}

    async record(phase: LinkedPhase): Promise<void> {
        try {
            const result = await this.dataSource.transaction(async (manager) => {
                const ticket = await manager.findOne(Ticket, { where: { id: phase.ticketId }, lock: { mode: 'pessimistic_write' } });
                if (!ticket) return null;
                const actor = phase.actorId ? await manager.findOne(User, { where: { id: phase.actorId } }) : null;
                const changes = await this.moveTicket(manager, ticket, phase.target);
                if (changes.length > 0) await manager.save(Ticket, ticket);
                const systemEvent: TicketSystemEvent = {
                    v: 1,
                    actor: actor ? { id: actor.id, name: actor.fullName } : null,
                    changes,
                    ...phase.event,
                };
                const message = await manager.save(TicketMessage, manager.create(TicketMessage, {
                    ticketId: ticket.id,
                    content: `System: ${phase.text}`,
                    senderId: actor?.id ?? (null as unknown as string),
                    isSystemMessage: true,
                    systemEvent,
                }));
                return { ticket, message, moved: changes.length > 0 };
            });
            if (result) await this.publish(result.ticket, result.message, result.moved);
        } catch (err: any) {
            this.logger.error(`Failed to record a linked request step on ticket ${phase.ticketId}: ${err?.message ?? err}`);
        }
    }

    /** Same clock rules as a manual WAITING_VENDOR wait, without a vendor appointment. */
    private async moveTicket(manager: EntityManager, ticket: Ticket, target: TicketStatus | undefined): Promise<TicketActivityChange[]> {
        if (!target || ticket.status === target || TICKET_INACTIVE_STATUSES.includes(ticket.status)) return [];
        // Only a ticket that is waiting on the request resumes; one an agent already moved on is left alone.
        if (target === TicketStatus.IN_PROGRESS && ticket.status !== TicketStatus.WAITING_VENDOR) return [];
        const from = ticket.status;
        const now = new Date();
        if (from === TicketStatus.WAITING_VENDOR && ticket.lastPausedAt) {
            const waited = Math.floor((now.getTime() - new Date(ticket.lastPausedAt).getTime()) / MINUTE_MS);
            ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + waited;
            ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + waited;
            ticket.lastPausedAt = null;
            ticket.waitingVendorAt = null;
        }
        if (from === TicketStatus.WAITING_VENDOR) await this.vendorVisit.clear(manager, ticket);
        if (target === TicketStatus.WAITING_VENDOR) {
            ticket.lastPausedAt = now;
            ticket.waitingVendorAt = now;
            await this.slaClock.hold(ticket, now);
        } else if (target === TicketStatus.IN_PROGRESS) {
            await this.slaClock.release(ticket, now);
        } else if (target === TicketStatus.CLOSED) {
            ticket.closedAt = now;
            ticket.resolutionDeadlineAt = null;
        }
        ticket.status = target;
        return [{ field: 'status', from, to: target }];
    }

    private async publish(ticket: Ticket, message: TicketMessage, moved: boolean): Promise<void> {
        const siteId = ticket.siteId ?? null;
        this.eventsGateway.notifyNewMessage(ticket.id, message);
        this.eventsGateway.notifyTicketUpdate(ticket.id, { status: ticket.status }, siteId);
        if (!moved) return;
        this.eventsGateway.notifyTicketListUpdate(siteId);
        this.eventsGateway.notifyDashboardStatsUpdate(siteId);
        if (ticket.assignedToId && siteId) {
            const actor: SiteActor = { role: UserRole.ADMIN, siteId };
            try {
                await this.workloadService.recalculateAgentWorkload(actor, ticket.assignedToId, siteId);
            } catch (err: any) {
                this.logger.warn(`Failed to recalculate workload for agent ${ticket.assignedToId}: ${err?.message ?? err}`);
            }
        }
    }
}
