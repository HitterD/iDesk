import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { WorkloadService } from '../../workload/workload.service';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { TicketSystemEvent } from '../utils/ticket-activity.util';
import { presentMessage } from '../utils/message-presenter.util';

export interface TicketEffectDeps {
    messageRepo: Repository<TicketMessage>;
    eventsGateway: EventsGateway;
    workloadService: WorkloadService;
    eventEmitter: EventEmitter2;
    logger: Logger;
}

export async function createAndEmitSystemMessage(
    deps: Pick<TicketEffectDeps, 'messageRepo' | 'eventsGateway'>,
    ticket: Ticket,
    actor: User,
    content: string,
    activity: TicketSystemEvent | null,
): Promise<void> {
    const systemMessage = deps.messageRepo.create({
        content,
        ticket,
        senderId: actor.id,
        isSystemMessage: true,
        systemEvent: activity,
    });
    const saved = await deps.messageRepo.save(systemMessage);
    deps.eventsGateway?.notifyNewMessage?.(ticket.id, {
        ...presentMessage(saved),
        sender: { id: actor.id, fullName: actor.fullName, role: actor.role },
    });
}

export function emitSiteTicketUpdated(eventsGateway: EventsGateway, ticket: Ticket): void {
    const siteId = (ticket as any).siteId;
    if (!siteId) return;
    if (typeof eventsGateway?.emitToTicketAudience === 'function') {
        eventsGateway.emitToTicketAudience(siteId, 'ticket:updated', { ticketId: ticket.id });
    } else {
        eventsGateway.server.to(`site:${siteId}`).emit('ticket:updated', { ticketId: ticket.id });
    }
}

export function emitDashboardAndTvUpdates(
    deps: Pick<TicketEffectDeps, 'eventsGateway' | 'eventEmitter'>,
    ticket: Ticket,
): void {
    deps.eventsGateway.notifyDashboardStatsUpdate((ticket as any).siteId ?? null);
    deps.eventsGateway.notifyTicketListUpdate((ticket as any).siteId ?? null);
    if (ticket.siteId) {
        deps.eventEmitter.emit('tv-board.ticket-changed', { siteId: ticket.siteId });
    }
}

export async function recalculateAgentsWorkload(
    deps: Pick<TicketEffectDeps, 'workloadService' | 'logger'>,
    ticket: Ticket,
    agentIds: Array<string | null | undefined>,
    contextLabel: string,
): Promise<void> {
    if (!ticket.siteId) return;
    const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: ticket.siteId };
    for (const agentId of agentIds) {
        if (!agentId) continue;
        try {
            await deps.workloadService.recalculateAgentWorkload(internalActor, agentId, ticket.siteId);
        } catch (error) {
            deps.logger.error(`Failed to recalculate workload ${contextLabel} for ticket ${ticket.ticketNumber}: ${error.message}`);
        }
    }
}
