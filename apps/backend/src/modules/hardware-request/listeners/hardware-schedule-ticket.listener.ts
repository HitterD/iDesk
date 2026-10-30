import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial, Not, IsNull } from 'typeorm';
import { HardwareEvents, ScheduleConfirmedPayload } from '../domain/events/hardware-request.events';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { Ticket, TicketPriority, TicketSource, TicketStatus, TicketType, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { WorkloadService } from '../../workload/workload.service';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';
import { SlaClockService } from '../../ticketing/services/sla-clock.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';
import { departmentDivision, generateNextTicketNumber, withTicketNumberRetry } from '../../ticketing/utils/ticket-number-generator';

/** Schedule times are shown in WIB; the server clock runs in UTC. */
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_TIMEZONE };
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: DEFAULT_TIMEZONE,
};

@Injectable()
export class HardwareScheduleTicketListener {
    private readonly logger = new Logger(HardwareScheduleTicketListener.name);

    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqRepo: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule)
        private readonly schedRepo: Repository<InstallationSchedule>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource,
        private readonly workloadService: WorkloadService,
        private readonly eventsGateway: EventsGateway,
        private readonly slaClock: SlaClockService,
    ) {}

    @OnEvent(HardwareEvents.ScheduleConfirmed)
    async onScheduleConfirmed(payload: ScheduleConfirmedPayload) {
        try {
            this.logger.log(`Handling ScheduleConfirmed for request ${payload.requestId}, schedule ${payload.scheduleId}`);

            const req = await this.reqRepo.findOne({
                where: { id: payload.requestId },
                relations: ['items', 'requester', 'site', 'recipient'],
            });
            if (!req) {
                this.logger.warn(`Hardware request ${payload.requestId} not found`);
                return;
            }

            const sched = await this.schedRepo.findOne({
                where: { id: payload.scheduleId },
                relations: ['technician', 'items', 'items.item'],
            });
            if (!sched) {
                this.logger.warn(`Installation schedule ${payload.scheduleId} not found`);
                return;
            }

            // Raised from an IT support ticket: that ticket follows the request (TicketHardwareSyncListener),
            // so no separate installation ticket.
            if (req.sourceTicketId) return;

            // Check if ticket already created for this schedule to avoid duplicate
            if (sched.ticketId) {
                this.logger.log(`Ticket already exists for schedule ${sched.id}: ${sched.ticketId}`);
                return;
            }

            const technician = sched.technician || await this.userRepo.findOne({ where: { id: payload.technicianId } });
            const requester = req.requester || await this.userRepo.findOne({
                where: { id: req.requesterId },
                relations: ['department'],
            });

            // Format scheduled date and time range
            const startDate = new Date(payload.scheduledStart);
            const endDate = new Date(payload.scheduledEnd);
            
            const startHour = startDate.toLocaleTimeString('id-ID', TIME_FORMAT);
            const endHour = endDate.toLocaleTimeString('id-ID', TIME_FORMAT);
            const scheduledTime = `${startHour} - ${endHour}`;

            // A reschedule confirms a new schedule row for the same request: move
            // the existing installation ticket instead of opening a second one.
            if (await this.syncRescheduledTicket(sched, payload, startDate, scheduledTime)) {
                return;
            }

            // Build item summary
            const scheduledItemNames = (sched.items && sched.items.length > 0)
                ? sched.items.map(si => si.item?.categorySnapshot?.name || (si.item as any)?.name || 'Perangkat Hardware')
                : (req.items ?? []).map(i => i.categorySnapshot?.name || (i as any)?.name || 'Perangkat Hardware');
            
            const itemSummary = Array.from(new Set(scheduledItemNames)).join(', ');

            // SLA Target: closing time of the first working day after the schedule
            const slaTarget = await this.slaClock.hardwareTarget(startDate);

            // Execute transaction to generate ticket and link schedule
            const createdTicket = await withTicketNumberRetry(this.logger, () => this.dataSource.transaction(async (manager) => {
                const ticketRepo = manager.getRepository(Ticket);
                const messageRepo = manager.getRepository(TicketMessage);
                const schedRepo = manager.getRepository(InstallationSchedule);

                const division = departmentDivision(requester?.department, 'ICT');
                // Shared locked generator: the old inline copy missed soft-deleted tickets and collided ("already exists").
                const ticketNumber = await generateNextTicketNumber(manager, division);

                const title = `[Hardware Installation] ${req.requestNumber} - ${itemSummary}`;
                const description = [
                    `Pemasangan Hardware untuk Pengajuan ${req.requestNumber}`,
                    `Lokasi Site: ${req.site?.name || '—'}`,
                    `Pemohon: ${requester?.fullName || '—'} (${requester?.email || '—'})`,
                    `Penerima: ${req.recipientName || requester?.fullName || '—'}`,
                    `Jadwal Terkonfirmasi: ${startDate.toLocaleDateString('id-ID', DATE_FORMAT)} pk ${scheduledTime}`,
                    `Agent Teknisi: ${technician?.fullName || '—'}`,
                    `Item yang dipasang: ${itemSummary}`,
                    `Justifikasi: "${req.justification || '—'}"`,
                ].join('\n');

                const ticket = ticketRepo.create({
                    ticketNumber,
                    title,
                    description,
                    priority: TicketPriority.HARDWARE_INSTALLATION,
                    category: 'HARDWARE_INSTALLATION',
                    ticketType: TicketType.HARDWARE_INSTALLATION,
                    source: TicketSource.WEB,
                    status: TicketStatus.IN_PROGRESS,
                    siteId: req.siteId,
                    userId: req.requesterId,
                    user: requester,
                    assignedToId: payload.technicianId,
                    assignedTo: technician,
                    isHardwareInstallation: true,
                    scheduledDate: startDate,
                    scheduledTime,
                    hardwareType: itemSummary.slice(0, 50),
                    slaTarget,
                    slaStartedAt: new Date(),
                    firstResponseTarget: null,
                    userAcknowledged: true,
                } as DeepPartial<Ticket>);

                const savedTicket = await ticketRepo.save(ticket);

                // Save initial message
                const message = messageRepo.create({
                    content: description,
                    ticket: savedTicket,
                    senderId: requester?.id || payload.technicianId,
                    attachments: [],
                });
                await messageRepo.save(message);

                // Update schedule with ticketId
                await schedRepo.update(sched.id, {
                    ticketId: savedTicket.id,
                });

                return savedTicket;
            }));

            this.logger.log(`Created installation ticket #${createdTicket.ticketNumber} for request ${req.requestNumber}`);

            // Real-time notification fanout
            this.eventsGateway.notifyDashboardStatsUpdate(createdTicket.siteId ?? null);
            this.eventsGateway.notifyNewTicket({
                id: createdTicket.id,
                ticketNumber: createdTicket.ticketNumber,
                title: createdTicket.title,
                status: createdTicket.status,
                priority: createdTicket.priority,
                category: createdTicket.category,
                siteId: createdTicket.siteId ?? null,
                user: {
                    id: requester?.id || req.requesterId,
                    fullName: requester?.fullName || 'Pemohon',
                    email: requester?.email || '',
                },
                createdAt: createdTicket.createdAt,
            });

            // Update workload for the assigned agent. Points stay 0 until the
            // install day opens; WorkloadService's activation job adds them then.
            if (payload.technicianId && createdTicket.siteId) {
                try {
                    const priorityPoints = await this.workloadService.workloadPointsFor(createdTicket);
                    const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: createdTicket.siteId };
                    // Atomic increment — a concurrent auto-assignment to the same agent
                    // must not lose this increment (PROD-20).
                    await this.workloadService.incrementAgentWorkload(
                        internalActor,
                        payload.technicianId,
                        createdTicket.siteId,
                        priorityPoints,
                    );
                    this.logger.log(`Updated workload points (+${priorityPoints}) for agent ${payload.technicianId}`);
                } catch (wlErr: any) {
                    this.logger.warn(`Failed to update workload for agent ${payload.technicianId}: ${wlErr.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`Error in HardwareScheduleTicketListener: ${error.message}`, error.stack);
        }
    }

    /**
     * Point the request's still-open installation ticket at the newly confirmed
     * slot (date, time, SLA, technician) and recompute affected workloads.
     * @returns false when there is no open ticket to move.
     */
    private async syncRescheduledTicket(
        sched: InstallationSchedule,
        payload: ScheduleConfirmedPayload,
        startDate: Date,
        scheduledTime: string,
    ): Promise<boolean> {
        const previous = await this.schedRepo.findOne({
            where: { requestId: sched.requestId, ticketId: Not(IsNull()) },
            order: { createdAt: 'DESC' },
        });
        if (!previous?.ticketId) return false;

        const ticket = await this.ticketRepo.findOne({ where: { id: previous.ticketId } });
        if (!ticket || TICKET_INACTIVE_STATUSES.includes(ticket.status)) return false;

        const previousAssigneeId = ticket.assignedToId;
        ticket.scheduledDate = startDate;
        ticket.scheduledTime = scheduledTime;
        ticket.slaTarget = await this.slaClock.hardwareTarget(startDate);
        if (payload.technicianId) ticket.assignedToId = payload.technicianId;
        await this.ticketRepo.save(ticket);
        await this.schedRepo.update(sched.id, { ticketId: ticket.id });
        this.logger.log(`Rescheduled installation ticket #${ticket.ticketNumber} to ${startDate.toISOString()}`);

        if (ticket.siteId) {
            const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: ticket.siteId };
            const agentIds = new Set([previousAssigneeId, ticket.assignedToId].filter((id): id is string => !!id));
            for (const agentId of agentIds) {
                try {
                    await this.workloadService.recalculateAgentWorkload(internalActor, agentId, ticket.siteId);
                } catch (wlErr: any) {
                    this.logger.warn(`Failed to recalculate workload for agent ${agentId}: ${wlErr.message}`);
                }
            }
        }
        this.eventsGateway.notifyDashboardStatsUpdate(ticket.siteId ?? null);
        return true;
    }
}
