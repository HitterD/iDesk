import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';
import { SlaClockService } from '../../ticketing/services/sla-clock.service';
import { TicketVendorVisitService } from '../../ticketing/services/ticket-vendor-visit.service';
import { WorkloadService } from '../../workload/workload.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { HardwareTicketPhase, TicketActivityChange, TicketSystemEvent } from '../../ticketing/utils/ticket-activity.util';
import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';

const MINUTE_MS = 60_000;
const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_TIMEZONE,
};

/** Chat text per phase; the structured `systemEvent.hardwareRequest` drives the card, this stays for email and search. */
const PHASE_TEXT: Record<HardwareTicketPhase, (no: string, at?: string) => string> = {
    PROPOSED: (no) => `Tim IT mengusulkan hardware request ${no}. Menunggu konfirmasi pemohon.`,
    SUBMITTED: (no) => `Pemohon menyetujui usulan. Hardware request ${no} diajukan; tiket menunggu proses hardware.`,
    DECLINED: (no) => `Pemohon menolak usulan hardware request ${no}.`,
    WITHDRAWN: (no) => `Tim IT menarik usulan hardware request ${no}.`,
    APPROVED: (no) => `Hardware request ${no} disetujui ICT.`,
    REJECTED: (no) => `Hardware request ${no} ditolak ICT. Tiket kembali ditangani.`,
    PROCUREMENT_DONE: (no) => `Pengadaan untuk ${no} selesai.`,
    SCHEDULE_PROPOSED: (no) => `Jadwal pemasangan ${no} diusulkan. Pemohon diminta memilih jadwal.`,
    SCHEDULED: (no, at) => `Pemasangan ${no} dijadwalkan${at ? ` ${at} WIB` : ''}.`,
    INSTALLED: (no) => `Pemasangan ${no} selesai dikerjakan. Menunggu konfirmasi pemohon.`,
    COMPLETED: (no) => `Hardware request ${no} selesai dan dikonfirmasi. Tiket ditutup otomatis.`,
    CANCELLED: (no) => `Hardware request ${no} dibatalkan. Tiket kembali ditangani.`,
};

/** Where the ticket goes at each phase; phases not listed leave its status alone. */
const PHASE_STATUS: Partial<Record<HardwareTicketPhase, TicketStatus>> = {
    SUBMITTED: TicketStatus.WAITING_VENDOR,
    REJECTED: TicketStatus.IN_PROGRESS,
    CANCELLED: TicketStatus.IN_PROGRESS,
    COMPLETED: TicketStatus.CLOSED,
};

export interface RecordOptions {
    actorId?: string | null;
    reason?: string | null;
    /** Phase moment worth showing, e.g. the confirmed installation start. */
    at?: Date | null;
}

/**
 * Tells an IT support ticket what happened to the hardware request proposed from it: a chat card per step and,
 * while the request runs, the ticket waits like a vendor wait (SLA held), resuming or closing with the request.
 * The request is the source of truth; failures here are logged and never thrown back into its flow.
 */
@Injectable()
export class TicketHardwareLinkService {
    private readonly logger = new Logger(TicketHardwareLinkService.name);

    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqRepo: Repository<HardwareRequest>,
        private readonly dataSource: DataSource,
        private readonly slaClock: SlaClockService,
        private readonly vendorVisit: TicketVendorVisitService,
        private readonly eventsGateway: EventsGateway,
        private readonly workloadService: WorkloadService,
    ) {}

    async record(requestId: string, phase: HardwareTicketPhase, options: RecordOptions = {}): Promise<void> {
        try {
            const request = await this.reqRepo.findOne({ where: { id: requestId } });
            if (!request?.sourceTicketId) return;
            const result = await this.dataSource.transaction(async (manager) => {
                const ticket = await manager.findOne(Ticket, { where: { id: request.sourceTicketId! }, lock: { mode: 'pessimistic_write' } });
                if (!ticket) return null;
                const actor = options.actorId ? await manager.findOne(User, { where: { id: options.actorId } }) : null;
                const changes = await this.moveTicket(manager, ticket, PHASE_STATUS[phase]);
                if (changes.length > 0) await manager.save(Ticket, ticket);
                const at = options.at ? new Date(options.at) : null;
                const event: TicketSystemEvent = {
                    v: 1,
                    actor: actor ? { id: actor.id, name: actor.fullName } : null,
                    changes,
                    ...(options.reason ? { reason: options.reason } : {}),
                    hardwareRequest: { id: request.id, number: request.requestNumber, phase, at: at?.toISOString() ?? null },
                };
                const message = await manager.save(TicketMessage, manager.create(TicketMessage, {
                    ticketId: ticket.id,
                    content: `System: ${PHASE_TEXT[phase](request.requestNumber, at?.toLocaleString('id-ID', WHEN_FORMAT))}`,
                    senderId: actor?.id ?? (null as unknown as string),
                    isSystemMessage: true,
                    systemEvent: event,
                }));
                return { ticket, message, moved: changes.length > 0 };
            });
            if (result) await this.publish(result.ticket, result.message, result.moved);
        } catch (err: any) {
            this.logger.error(`Failed to record ${phase} of hardware request ${requestId} on its ticket: ${err?.message ?? err}`);
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
