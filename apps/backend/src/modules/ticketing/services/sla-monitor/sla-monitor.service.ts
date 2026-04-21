import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { EventsGateway } from '../../presentation/gateways/events.gateway';
import { TicketUpdateService } from '../ticket-update.service';
import { WorkloadService } from '../../../workload/workload.service';

@Injectable()
export class SlaMonitorService {
    private readonly logger = new Logger(SlaMonitorService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly eventsGateway: EventsGateway,
        private readonly ticketUpdateService: TicketUpdateService,
        private readonly workloadService: WorkloadService,
    ) { }

    // Run every 15 minutes to check SLA status
    @Cron('*/15 * * * *')
    async checkSlaStatus() {
        this.logger.debug('Running SLA Monitor Check...');

        // Only process tickets during business hours (08:00 - 17:00)
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();

        // Skip if outside business hours or weekend (optional weekend logic, assuming Mon-Fri for now)
        if (currentHour < 8 || currentHour >= 17 || currentDay === 0 || currentDay === 6) {
            this.logger.debug('Outside business hours. Skipping SLA Monitor Check.');
            return;
        }

        // 1. Find tickets that are In Progress / TODO but have NO first response
        const tickets = await this.ticketRepo.find({
            where: {
                status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                firstResponseAt: IsNull(),
            },
            relations: ['assignedTo'],
        });

        for (const ticket of tickets) {
            if (!ticket.slaStartedAt || !ticket.assignedTo) continue;

            const workingHoursPassed = this.calculateBusinessHoursDifference(ticket.slaStartedAt, now);

            // 6-Hour Rule: Warning
            if (workingHoursPassed >= 6 && workingHoursPassed < 8 && !ticket.slaWarningSent) {
                this.logger.warn(`Ticket ${ticket.ticketNumber} is approaching SLA breach (6 hours passed). Sending warning to ${ticket.assignedTo.fullName}`);

                // Set flag
                ticket.slaWarningSent = true;
                await this.ticketRepo.save(ticket);

                // Send In-App Notification (WebSocket)
                this.eventsGateway.server.to(`user_${ticket.assignedToId}`).emit('notification', {
                    type: 'SLA_WARNING',
                    title: 'Peringatan SLA',
                    message: `Tiket #${ticket.ticketNumber} belum direspons selama 6 jam kerja. Segera balas atau tiket akan dialihkan dalam 2 jam.`,
                    ticketId: ticket.id,
                });
            }

            // 8-Hour Rule: Auto-Reassign
            if (workingHoursPassed >= 8) {
                this.logger.warn(`Ticket ${ticket.ticketNumber} breached 8-hour SLA. Auto-reassigning from ${ticket.assignedTo.fullName}`);

                const oldAgent = ticket.assignedTo;

                // Reset states
                ticket.assignedToId = null;
                ticket.assignedTo = null;
                ticket.slaWarningSent = false;
                ticket.autoReassignedAt = now;
                ticket.status = TicketStatus.TODO; // Reset back to TODO so SLA timer logic works cleanly
                ticket.slaStartedAt = null; // Will restart when new agent picks it up

                await this.ticketRepo.save(ticket);

                // Note: oldAgent is NOT blacklisted, they simply lost the ticket.
                // Call auto-assign to find the next best agent
                try {
                    await this.workloadService.autoAssignTicket(ticket.id);

                    // Notify old agent
                    this.eventsGateway.server.to(`user_${oldAgent.id}`).emit('notification', {
                        type: 'SLA_BREACH_REASSIGNED',
                        title: 'SLA Terlewati',
                        message: `Tiket #${ticket.ticketNumber} telah dialihkan ke agen lain karena melewati batas SLA 8 jam waktu respons.`,
                        ticketId: ticket.id,
                    });
                } catch (e) {
                    this.logger.error(`Failed to auto-reassign ticket ${ticket.id} after SLA breach: ${e.message}`);
                }
            }
        }
    }

    /**
     * Calculates the difference in business hours (08:00 - 17:00, Mon-Fri) between two dates
     */
    private calculateBusinessHoursDifference(start: Date, end: Date): number {
        let current = new Date(start);
        let businessMs = 0;

        while (current < end) {
            const dayOfWeek = current.getDay();
            const hour = current.getHours();

            // Check if it's a weekday and within business hours
            if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour < 17) {
                // Move forward by 1 hour or less if 'end' is reached before a full hour
                const nextHour = new Date(current);
                nextHour.setHours(hour + 1, 0, 0, 0);

                const stepEnd = nextHour < end ? nextHour : end;
                businessMs += stepEnd.getTime() - current.getTime();

                current = nextHour;
            } else {
                // Skip to 08:00 of the next business day
                if (dayOfWeek === 5 && hour >= 17) {
                    // Friday after 17:00 -> Jump to Monday 08:00
                    current.setDate(current.getDate() + 3);
                    current.setHours(8, 0, 0, 0);
                } else if (dayOfWeek === 6) {
                    // Saturday -> Jump to Monday 08:00
                    current.setDate(current.getDate() + 2);
                    current.setHours(8, 0, 0, 0);
                } else if (dayOfWeek === 0) {
                    // Sunday -> Jump to Monday 08:00
                    current.setDate(current.getDate() + 1);
                    current.setHours(8, 0, 0, 0);
                } else if (hour >= 17) {
                    // Weekday after 17:00 -> Jump to next day 08:00
                    current.setDate(current.getDate() + 1);
                    current.setHours(8, 0, 0, 0);
                } else if (hour < 8) {
                    // Weekday before 08:00 -> Jump to 08:00
                    current.setHours(8, 0, 0, 0);
                }
            }
        }

        // Return duration in hours
        return businessMs / (1000 * 60 * 60);
    }
}
