import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { SlaAdjustment, SlaAdjustmentType, SlaAdjustmentReasonCategory } from '../entities/sla-adjustment.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { SlaClockService } from './sla-clock.service';
import { EventsGateway } from '../presentation/gateways/events.gateway';

/**
 * A ticket may only be extended when the SLA clock is actually running.
 */
const EXTENDABLE_STATUSES: TicketStatus[] = [TicketStatus.IN_PROGRESS, TicketStatus.TODO];

/**
 * Maximum calendar days into the future for an SLA extension.
 * Generous sanity ceiling to accommodate unpredictable external obstacles
 * (e.g. waiting for vendor spare parts) while preventing accidental far-future typos.
 */
const MAX_EXTENSION_CALENDAR_DAYS = 90;

const CATEGORY_LABELS: Record<string, string> = {
    [SlaAdjustmentReasonCategory.WAITING_USER]: 'Menunggu Respon / Feedback Pengguna',
    [SlaAdjustmentReasonCategory.WAITING_VENDOR]: 'Menunggu Vendor / Pihak Ketiga',
    [SlaAdjustmentReasonCategory.WAITING_APPROVAL]: 'Menunggu Persetujuan Manajerial',
    [SlaAdjustmentReasonCategory.TECHNICAL_COMPLEXITY]: 'Kompleksitas Teknis & Investigasi Lanjutan',
    [SlaAdjustmentReasonCategory.EXTERNAL_DEPENDENCY]: 'Ketergantungan Sistem Eksternal',
    [SlaAdjustmentReasonCategory.OTHER]: 'Lainnya',
};

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
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        private readonly slaClock: SlaClockService,
        @Optional()
        private readonly eventsGateway?: EventsGateway,
    ) {}

    /**
     * Extend the resolution SLA target of a ticket by N business minutes or a manual date,
     * recording why. Only the resolution target moves; the first-response
     * target never does.
     */
    async extendSla(
        ticketId: string,
        dto: {
            reasonCategory: SlaAdjustmentReasonCategory;
            reasonText: string;
            minutes?: number;
            newTargetDate?: string;
        },
        actor: { userId: string; role: string; fullName?: string },
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

        const previousTarget = new Date(ticket.slaTarget);
        let newTarget: Date;
        let minutes: number;

        const now = new Date();
        const maxAllowedTarget = new Date(now.getTime() + MAX_EXTENSION_CALENDAR_DAYS * 24 * 60 * 60 * 1000);

        if (dto.newTargetDate) {
            const parsedTarget = new Date(dto.newTargetDate);
            if (isNaN(parsedTarget.getTime())) {
                throw new BadRequestException('Format tanggal deadline baru tidak valid');
            }
            if (parsedTarget.getTime() <= now.getTime()) {
                throw new BadRequestException('Target deadline baru harus lebih lama dari waktu saat ini');
            }
            if (parsedTarget.getTime() > maxAllowedTarget.getTime()) {
                throw new BadRequestException(
                    `Target deadline baru tidak boleh melebihi ${MAX_EXTENSION_CALENDAR_DAYS} hari ke depan`,
                );
            }

            const calculatedMinutes = await this.slaClock.minutesBetween(ticket.priority, previousTarget, parsedTarget);

            minutes = calculatedMinutes > 0
                ? calculatedMinutes
                : Math.max(1, Math.round((parsedTarget.getTime() - previousTarget.getTime()) / 60000));
            newTarget = parsedTarget;
        } else if (dto.minutes && dto.minutes > 0) {
            minutes = dto.minutes;
            newTarget = await this.slaClock.targetFor(ticket.priority, previousTarget, minutes);
            if (newTarget.getTime() > maxAllowedTarget.getTime()) {
                throw new BadRequestException(
                    `Target deadline baru tidak boleh melebihi ${MAX_EXTENSION_CALENDAR_DAYS} hari ke depan`,
                );
            }
        } else {
            throw new BadRequestException('Harap tentukan menit perpanjangan atau tanggal deadline baru');
        }

        if (!ticket.originalSlaTarget) {
            ticket.originalSlaTarget = previousTarget;
        }

        ticket.slaTarget = newTarget;
        // Extending removes the overdue marker; the checker re-evaluates after the new target passes.
        ticket.isOverdue = false;

        const saved = await this.ticketRepo.save(ticket);
        const adjustment = this.adjustmentRepo.create({
            ticketId,
            type: SlaAdjustmentType.EXTEND,
            minutes,
            reasonCategory: dto.reasonCategory,
            reasonText: dto.reasonText.trim(),
            previousTarget,
            newTarget,
            actorId: actor.userId,
            approvedById: null,
        });
        const savedAdjustment = await this.adjustmentRepo.save(adjustment);

        // Auto-post transparent system message to ticket chat
        try {
            const categoryLabel = CATEGORY_LABELS[dto.reasonCategory] || dto.reasonCategory;
            const formattedNewDate = newTarget.toLocaleDateString('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            }) + ' ' + newTarget.toLocaleTimeString('id-ID', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
            }) + ' WIB';

            const actorName = actor.fullName || 'Teknisi';
            const systemMessageContent = `Target SLA Diperpanjang\n\n` +
                `Deadline Baru: ${formattedNewDate}\n` +
                `Kategori Kendala: ${categoryLabel}\n` +
                `Penjelasan: ${dto.reasonText.trim()}\n` +
                `Diperpanjang oleh: ${actorName}`;

            const message = this.messageRepo.create({
                content: systemMessageContent,
                ticket: saved,
                senderId: actor.userId,
                isSystemMessage: true,
            });
            await this.messageRepo.save(message);
        } catch (msgErr) {
            this.logger.warn(`Failed to post SLA extension system message: ${msgErr}`);
        }

        // Emit realtime websocket updates
        if (this.eventsGateway?.server) {
            try {
                this.eventsGateway.server
                    .to(`ticket:${ticketId}`)
                    .emit('ticket:updated', { ticketId });
                if (saved.siteId) {
                    this.eventsGateway.server
                        .to(`site:${saved.siteId}`)
                        .emit('ticket:updated', { ticketId });
                }
            } catch (wsErr) {
                this.logger.warn(`Failed to emit websocket event: ${wsErr}`);
            }
        }

        this.logger.log(
            `SLA extended for ticket ${ticket.ticketNumber || ticketId}: +${minutes} business minutes ` +
            `(${dto.reasonCategory}) by ${actor.userId}`,
        );

        return { ticket: saved, adjustment: savedAdjustment };
    }
}

