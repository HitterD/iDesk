import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketLinkedRequestService } from '../../ticketing/services/ticket-linked-request.service';
import { HardwareTicketPhase } from '../../ticketing/utils/ticket-activity.util';
import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';

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
    ISSUE_REPORTED: (no) => `Pemohon melaporkan masalah pada pemasangan ${no}. Tim IT menindaklanjuti.`,
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
 */
@Injectable()
export class TicketHardwareLinkService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqRepo: Repository<HardwareRequest>,
        private readonly linked: TicketLinkedRequestService,
    ) {}

    async record(requestId: string, phase: HardwareTicketPhase, options: RecordOptions = {}): Promise<void> {
        const request = await this.reqRepo.findOne({ where: { id: requestId } }).catch(() => null);
        if (!request?.sourceTicketId) return;
        const at = options.at ? new Date(options.at) : null;
        await this.linked.record({
            ticketId: request.sourceTicketId,
            actorId: options.actorId,
            target: PHASE_STATUS[phase],
            text: PHASE_TEXT[phase](request.requestNumber, at?.toLocaleString('id-ID', WHEN_FORMAT)),
            event: {
                ...(options.reason ? { reason: options.reason } : {}),
                hardwareRequest: { id: request.id, number: request.requestNumber, phase, at: at?.toISOString() ?? null },
            },
        });
    }
}
