import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { SlaAdjustment, SlaAdjustmentType, SlaAdjustmentReasonCategory } from '../entities/sla-adjustment.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { SlaClockService } from './sla-clock.service';
import { EventsGateway } from '../presentation/gateways/events.gateway';

/** Tickets with a started resolution clock, including a vendor hold, may be extended. */
const EXTENDABLE_STATUSES: TicketStatus[] = [TicketStatus.IN_PROGRESS, TicketStatus.TODO, TicketStatus.WAITING_VENDOR];

/** Calendar-day sanity ceiling, allowing external obstacles without far-future typos. */
const MAX_EXTENSION_CALENDAR_DAYS = 90;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

interface ExtendSlaInput {
    reasonCategory: SlaAdjustmentReasonCategory;
    reasonText: string;
    minutes?: number;
    newTargetDate?: string;
}

type ExtensionActor = { userId: string; role: string; fullName?: string };
type Extension = { previousTarget: Date | null; newTarget: Date | null; minutes: number };

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

    /** Extends resolution time, preserving held targets and the first-response clock. */
    async extendSla(
        ticketId: string,
        dto: ExtendSlaInput,
        actor: ExtensionActor,
    ): Promise<{ ticket: Ticket; adjustment: SlaAdjustment }> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        if (!EXTENDABLE_STATUSES.includes(ticket.status)) {
            throw new ConflictException(
                `Ticket is ${ticket.status}; SLA can only be extended for ${EXTENDABLE_STATUSES.join(' or ')} tickets`,
            );
        }
        const now = new Date();
        // A ticket that skipped IN_PROGRESS never started its clock; adopt it from creation (what the page shows).
        if (ticket.slaStartedAt == null) {
            await this.slaClock.adoptUnstarted(ticket, now, { paused: ticket.status === TicketStatus.WAITING_VENDOR });
        }
        const held = ticket.slaRemainingMinutes != null;
        if (ticket.slaStartedAt == null || (!held && ticket.slaTarget == null)) {
            throw new BadRequestException('SLA clock has not started for this ticket');
        }
        const maxAllowedTarget = new Date(now.getTime() + MAX_EXTENSION_CALENDAR_DAYS * MS_PER_DAY);
        const previousTarget = ticket.slaTarget == null ? null : new Date(ticket.slaTarget);
        const extension = held
            ? await this.extendHeld(ticket, dto, now, maxAllowedTarget, previousTarget)
            : await this.extendRunning(ticket, dto, now, maxAllowedTarget, previousTarget!);

        if (!ticket.originalSlaTarget) ticket.originalSlaTarget = previousTarget;
        if (!held) ticket.slaTarget = extension.newTarget;
        // Extending removes the overdue marker; the checker re-evaluates after the new target passes.
        ticket.isOverdue = false;
        const saved = await this.ticketRepo.save(ticket);
        const adjustment = await this.recordAdjustment(ticketId, dto, actor, extension);
        await this.postSystemMessage(saved, dto, actor, extension, held);
        this.emitUpdate(saved);
        this.logger.log(
            `SLA extended for ticket ${ticket.ticketNumber || ticketId}: +${extension.minutes} business minutes ` +
            `(${dto.reasonCategory}) by ${actor.userId}`,
        );
        return { ticket: saved, adjustment };
    }

    private async extendHeld(
        ticket: Ticket, dto: ExtendSlaInput, now: Date, maxAllowedTarget: Date, previousTarget: Date | null,
    ): Promise<Extension> {
        if (dto.newTargetDate) {
            throw new BadRequestException('SLA sedang dijeda; perpanjang dengan jumlah menit, bukan tanggal');
        }
        const minutes = this.extensionMinutes(dto);
        const remaining = ticket.slaRemainingMinutes! + minutes;
        this.validateCeiling(await this.slaClock.targetFor(ticket.priority, now, remaining), maxAllowedTarget);
        ticket.slaRemainingMinutes = remaining;
        return { previousTarget, newTarget: previousTarget, minutes };
    }

    private async extendRunning(
        ticket: Ticket, dto: ExtendSlaInput, now: Date, maxAllowedTarget: Date, previousTarget: Date,
    ): Promise<Extension> {
        let newTarget: Date;
        let minutes: number;
        if (dto.newTargetDate) {
            newTarget = new Date(dto.newTargetDate);
            if (isNaN(newTarget.getTime())) {
                throw new BadRequestException('Format tanggal deadline baru tidak valid');
            }
            if (newTarget.getTime() <= now.getTime()) {
                throw new BadRequestException('Target deadline baru harus lebih lama dari waktu saat ini');
            }
            this.validateCeiling(newTarget, maxAllowedTarget);
            const calculatedMinutes = await this.slaClock.minutesBetween(ticket.priority, previousTarget, newTarget);
            minutes = calculatedMinutes > 0
                ? calculatedMinutes
                : Math.max(1, Math.round((newTarget.getTime() - previousTarget.getTime()) / MS_PER_MINUTE));
        } else {
            minutes = this.extensionMinutes(dto);
            newTarget = await this.slaClock.targetFor(ticket.priority, previousTarget, minutes);
            this.validateCeiling(newTarget, maxAllowedTarget);
        }
        return { previousTarget, newTarget, minutes };
    }

    private extensionMinutes(dto: ExtendSlaInput): number {
        if (dto.minutes && dto.minutes > 0) return dto.minutes;
        throw new BadRequestException('Harap tentukan menit perpanjangan atau tanggal deadline baru');
    }

    private validateCeiling(target: Date, maxAllowedTarget: Date): void {
        if (target.getTime() > maxAllowedTarget.getTime()) {
            throw new BadRequestException(`Target deadline baru tidak boleh melebihi ${MAX_EXTENSION_CALENDAR_DAYS} hari ke depan`);
        }
    }

    private async recordAdjustment(
        ticketId: string, dto: ExtendSlaInput, actor: ExtensionActor, extension: Extension,
    ): Promise<SlaAdjustment> {
        const adjustment = this.adjustmentRepo.create({
            ticketId,
            type: SlaAdjustmentType.EXTEND,
            ...extension,
            reasonCategory: dto.reasonCategory,
            reasonText: dto.reasonText.trim(),
            actorId: actor.userId,
            approvedById: null,
        });
        return this.adjustmentRepo.save(adjustment);
    }

    private async postSystemMessage(
        ticket: Ticket, dto: ExtendSlaInput, actor: ExtensionActor, extension: Extension, held: boolean,
    ): Promise<void> {
        try {
            const categoryLabel = CATEGORY_LABELS[dto.reasonCategory] || dto.reasonCategory;
            const deadline = held
                ? `SLA ditambah ${extension.minutes} menit (dijeda)`
                : `Deadline Baru: ${this.formatTarget(extension.newTarget!)}`;
            const systemMessageContent = `Target SLA Diperpanjang\n\n` +
                `${deadline}\n` +
                `Kategori Kendala: ${categoryLabel}\n` +
                `Penjelasan: ${dto.reasonText.trim()}\n` +
                `Diperpanjang oleh: ${actor.fullName || 'Teknisi'}`;
            const message = this.messageRepo.create({
                content: systemMessageContent,
                ticket,
                senderId: actor.userId,
                isSystemMessage: true,
            });
            await this.messageRepo.save(message);
        } catch (msgErr) {
            this.logger.warn(`Failed to post SLA extension system message: ${msgErr}`);
        }
    }

    private formatTarget(target: Date): string {
        return target.toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }) + ' ' + target.toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
        }) + ' WIB';
    }

    private emitUpdate(ticket: Ticket): void {
        if (!this.eventsGateway?.server) return;
        try {
            this.eventsGateway.server.to(`ticket:${ticket.id}`).emit('ticket:updated', { ticketId: ticket.id });
            if (ticket.siteId) {
                this.eventsGateway.server.to(`site:${ticket.siteId}`).emit('ticket:updated', { ticketId: ticket.id });
            }
        } catch (wsErr) {
            this.logger.warn(`Failed to emit websocket event: ${wsErr}`);
        }
    }
}
