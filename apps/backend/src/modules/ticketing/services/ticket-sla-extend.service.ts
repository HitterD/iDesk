import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { SlaAdjustment, SlaAdjustmentType } from '../entities/sla-adjustment.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { BusinessHoursService } from '../../sla-config/business-hours.service';

/**
 * A ticket may only be extended when the SLA clock is actually running.
 */
const EXTENDABLE_STATUSES: TicketStatus[] = [TicketStatus.IN_PROGRESS, TicketStatus.TODO];

/** 8 business hours, in minutes: the flat part of the extension cap. */
const EIGHT_BUSINESS_HOURS_MINUTES = 480;

/** Absolute safety ceiling when no SlaConfig row exists for the priority. */
const FALLBACK_CAP_MINUTES = 10080; // 7 * 24 * 60

@Injectable()
export class TicketSlaExtendService {
    private readonly logger = new Logger(TicketSlaExtendService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(SlaAdjustment)
        private readonly adjustmentRepo: Repository<SlaAdjustment>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly businessHoursService: BusinessHoursService,
    ) {}

    /**
     * Extend the resolution SLA target of a ticket by N business minutes,
     * recording why. Only the resolution target moves; the first-response
     * target never does.
     *
     * Cap: an extension may never push the total (elapsed + prior extensions
     * + this request) past 2x the resolution budget + 8 business hours.
     */
    async extendSla(
        ticketId: string,
        dto: { reasonCategory: SlaAdjustment['reasonCategory']; reasonText: string; minutes: number },
        actor: { userId: string; role: string },
    ): Promise<{ ticket: Ticket; adjustment: SlaAdjustment }> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        if (!EXTENDABLE_STATUSES.includes(ticket.status)) {
            throw new ConflictException(
                `Ticket is ${ticket.status}; SLA can only be extended for ${EXTENDABLE_STATUSES.join(' or ')} tickets`,
            );
        }

        if (ticket.slaTarget == null || ticket.slaStartedAt == null) {
            throw new BadRequestException('SLA clock has not started for this ticket');
        }

        const minutes = dto.minutes;
        const startedAt = new Date(ticket.slaStartedAt);
        const now = new Date();
        const elapsedBusinessMinutes = await this.businessHoursService.calculateBusinessMinutes(
            startedAt,
            now,
        );
        const alreadyExtended = await this.totalExtendedMinutes(ticketId);

        const allowed = await this.allowedExtensionBusinessMinutes(ticket.priority);
        const projected = elapsedBusinessMinutes + alreadyExtended + minutes;
        if (projected > allowed) {
            throw new BadRequestException(
                `Extend requested would exceed the cap (${allowed} business minutes allowed; ` +
                `${elapsedBusinessMinutes} elapsed + ${alreadyExtended} already extended + ${minutes} new would make ${projected})`,
            );
        }

        const previousTarget = ticket.slaTarget;
        const newTarget = await this.businessHoursService.calculateSlaTarget(previousTarget, minutes);

        ticket.slaTarget = newTarget;
        // Extending removes the overdue marker; the checker re-evaluates after the new target passes.
        ticket.isOverdue = false;

        const saved = await this.ticketRepo.save(ticket);
        const adjustment = this.adjustmentRepo.create({
            ticketId,
            type: SlaAdjustmentType.EXTEND,
            minutes,
            reasonCategory: dto.reasonCategory,
            reasonText: dto.reasonText,
            previousTarget,
            newTarget,
            actorId: actor.userId,
            approvedById: null,
        });
        const savedAdjustment = await this.adjustmentRepo.save(adjustment);

        this.logger.log(
            `SLA extended for ticket ${ticket.ticketNumber || ticketId}: +${minutes} business minutes ` +
            `(${dto.reasonCategory}) by ${actor.userId}`,
        );

        return { ticket: saved, adjustment: savedAdjustment };
    }

    /** Sum of all recorded EXTEND minutes on this ticket. */
    private async totalExtendedMinutes(ticketId: string): Promise<number> {
        const row = await this.adjustmentRepo
            .createQueryBuilder('a')
            .select('COALESCE(SUM(a.minutes), 0)', 'total')
            .where('a."ticketId" = :ticketId', { ticketId })
            .getRawOne();
        return Number(row?.total || 0);
    }

    /** Cap: 2x the priority resolution budget + 8 business hours. */
    private async allowedExtensionBusinessMinutes(priority: string): Promise<number> {
        const slaConfig = await this.slaConfigRepo.findOne({ where: { priority } });
        if (!slaConfig) {
            this.logger.warn(`No SlaConfig for priority ${priority}; using fallback cap`);
            return FALLBACK_CAP_MINUTES;
        }
        return (slaConfig.resolutionTimeMinutes ?? 0) * 2 + EIGHT_BUSINESS_HOURS_MINUTES;
    }
}
