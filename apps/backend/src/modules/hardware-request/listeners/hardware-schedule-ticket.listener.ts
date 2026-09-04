import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial } from 'typeorm';
import { HardwareEvents, ScheduleConfirmedPayload } from '../domain/events/hardware-request.events';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { Ticket, TicketPriority, TicketSource, TicketStatus, TicketType } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { WorkloadService } from '../../workload/workload.service';
import { EventsGateway } from '../../ticketing/presentation/gateways/events.gateway';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';

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
            
            const startHour = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const endHour = endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const scheduledTime = `${startHour} - ${endHour}`;

            // Build item summary
            const scheduledItemNames = (sched.items && sched.items.length > 0)
                ? sched.items.map(si => si.item?.categorySnapshot?.name || (si.item as any)?.name || 'Perangkat Hardware')
                : (req.items ?? []).map(i => i.categorySnapshot?.name || (i as any)?.name || 'Perangkat Hardware');
            
            const itemSummary = Array.from(new Set(scheduledItemNames)).join(', ');

            // Calculate SLA Target: H+1 from scheduledDate
            const slaTarget = new Date(startDate);
            slaTarget.setDate(slaTarget.getDate() + 1);
            slaTarget.setHours(17, 0, 0, 0);

            // Execute transaction to generate ticket and link schedule
            const createdTicket = await this.dataSource.transaction(async (manager) => {
                const ticketRepo = manager.getRepository(Ticket);
                const messageRepo = manager.getRepository(TicketMessage);
                const schedRepo = manager.getRepository(InstallationSchedule);

                const date = new Date();
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear().toString().slice(-2);
                const dateStr = `${day}${month}${year}`;

                const division = requester?.department?.name
                    ? requester.department.name.substring(0, 3).toUpperCase()
                    : 'ICT';

                const todayStart = new Date(date);
                todayStart.setHours(0, 0, 0, 0);

                const latestTicket = await manager.createQueryBuilder(Ticket, 'ticket')
                    .where('ticket.createdAt >= :todayStart', { todayStart })
                    .orderBy('ticket.createdAt', 'DESC')
                    .setLock('pessimistic_write')
                    .getOne();

                let newNumber = 1;
                if (latestTicket && latestTicket.ticketNumber) {
                    const parts = latestTicket.ticketNumber.split('-');
                    if (parts.length === 3) {
                        const lastNumber = parseInt(parts[2], 10);
                        if (!isNaN(lastNumber)) {
                            newNumber = lastNumber + 1;
                        }
                    }
                }
                const numberStr = newNumber.toString().padStart(4, '0');
                const ticketNumber = `${dateStr}-${division}-${numberStr}`;

                const title = `[Hardware Installation] ${req.requestNumber} - ${itemSummary}`;
                const description = [
                    `Pemasangan Hardware untuk Pengajuan ${req.requestNumber}`,
                    `Lokasi Site: ${req.site?.name || '—'}`,
                    `Pemohon: ${requester?.fullName || '—'} (${requester?.email || '—'})`,
                    `Penerima: ${req.recipientName || requester?.fullName || '—'}`,
                    `Jadwal Terkonfirmasi: ${startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} pk ${scheduledTime}`,
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
            });

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

            // Update workload points for the assigned agent
            if (payload.technicianId && createdTicket.siteId) {
                try {
                    const priorityPoints = await this.workloadService.getPriorityWeight(TicketPriority.HARDWARE_INSTALLATION);
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
}
