import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { HR_EVT, HrCancelled, HrInstallCompleted } from '../domain/events/hardware-request.events';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';
import { WorkloadService } from '../../workload/workload.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';

type InstallCompletedEvent = HrInstallCompleted & { status?: RequestStatus };

/**
 * Keeps the auto-created "[Hardware Installation]" ticket in step with its hardware request:
 * the request is the source of truth, the ticket follows it to CLOSED or CANCELLED.
 * Runs after the request has committed and never throws back into that flow.
 */
@Injectable()
export class HardwareTicketStatusSyncListener {
    private readonly logger = new Logger(HardwareTicketStatusSyncListener.name);

    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqRepo: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule)
        private readonly schedRepo: Repository<InstallationSchedule>,
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly workloadService: WorkloadService,
    ) {}

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onInstallCompleted(payload: InstallCompletedEvent): Promise<void> {
        // INSTALL_COMPLETED also fires when ICT marks the job done and the requester has
        // yet to confirm; the ticket closes only once the request is COMPLETED.
        if (payload.status !== RequestStatus.COMPLETED) return;
        await this.sync(payload.requestId, TicketStatus.CLOSED, (no) => `System: Pemasangan hardware ${no} selesai dan dikonfirmasi. Tiket ditutup otomatis.`);
    }

    @OnEvent(HR_EVT.CANCELLED)
    async onRequestCancelled(payload: HrCancelled): Promise<void> {
        await this.sync(payload.requestId, TicketStatus.CANCELLED, (no) => `System: Permintaan hardware ${no} dibatalkan. Tiket pemasangan ikut dibatalkan.`);
    }

    private async sync(requestId: string, target: TicketStatus, note: (requestNumber: string) => string): Promise<void> {
        try {
            // Same lookup the reschedule flow uses: the newest schedule that points at a ticket.
            const linked = await this.schedRepo.findOne({
                where: { requestId, ticketId: Not(IsNull()) },
                order: { createdAt: 'DESC' },
            });
            if (!linked?.ticketId) return;

            const request = await this.reqRepo.findOne({ where: { id: requestId } });
            const requestNumber = request?.requestNumber ?? requestId;

            const ticket = await this.dataSource.transaction(async (manager) => {
                const row = await manager.findOne(Ticket, { where: { id: linked.ticketId! }, lock: { mode: 'pessimistic_write' } });
                if (!row || TICKET_INACTIVE_STATUSES.includes(row.status)) return null;

                row.status = target;
                if (target === TicketStatus.CLOSED) row.closedAt = new Date();
                row.resolutionDeadlineAt = null;
                const saved = await manager.save(Ticket, row);
                await manager.save(TicketMessage, manager.create(TicketMessage, {
                    ticketId: row.id, content: note(requestNumber), senderId: null as unknown as string, isSystemMessage: true,
                }));
                return saved;
            });
            if (!ticket) return;

            this.logger.log(`Ticket ${ticket.id} → ${target} following hardware request ${requestNumber}`);
            await this.publish(ticket);
        } catch (err: any) {
            this.logger.error(`Failed to sync installation ticket for hardware request ${requestId}: ${err?.message ?? err}`);
        }
    }

    private async publish(ticket: Ticket): Promise<void> {
        const siteId = ticket.siteId ?? null;
        this.eventsGateway.notifyTicketUpdate(ticket.id, { status: ticket.status }, siteId);
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
