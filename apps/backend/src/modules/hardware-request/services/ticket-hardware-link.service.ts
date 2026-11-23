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
    RESCHEDULE_REQUESTED: (no) => `Pemohon meminta jadwal pemasangan ${no} diubah. Tim IT mengusulkan jadwal baru.`,
    SCHEDULED: (no, at) => `Pemasangan ${no} dijadwalkan${at ? ` ${at} WIB` : ''}.`,
    INSTALLED: (no) => `Pemasangan ${no} selesai dikerjakan. Menunggu konfirmasi pemohon.`,
    ISSUE_REPORTED: (no) => `Pemohon melaporkan masalah pada pemasangan ${no}. Tim IT menindaklanjuti.`,
    COMPLETED: (no) => `Hardware request ${no} selesai dan dikonfirmasi. Tiket ditutup otomatis.`,
    CANCELLED: (no) => `Hardware request ${no} dibatalkan. Tiket kembali ditangani.`,
    // Steps of the unified request flow (RequestFlowReviewService writes its own text).
    REVIEWED: (no) => `Hardware request ${no} ditinjau IT.`,
    SIGNED: (no) => `Hardware request ${no} ditandatangani.`,
    RETURNED: (no) => `Hardware request ${no} dikembalikan ke IT.`,
    REMINDED: (no) => `Pengingat persetujuan ${no} dikirim.`,
};

/** Where the ticket goes at each phase; phases not listed leave its status alone. */
const PHASE_STATUS: Partial<Record<HardwareTicketPhase, TicketStatus>> = {
    SUBMITTED: TicketStatus.WAITING_VENDOR,
    REJECTED: TicketStatus.IN_PROGRESS,
    CANCELLED: TicketStatus.IN_PROGRESS,
    COMPLETED: TicketStatus.CLOSED,
    // The requester found a problem after the installation: a resolved ticket goes back to the agent (see `REOPENING`).
    ISSUE_REPORTED: TicketStatus.IN_PROGRESS,
};

/** The only phase that may take a RESOLVED ticket back; every other step leaves a resolved ticket alone. */
const REOPENING: readonly HardwareTicketPhase[] = ['ISSUE_REPORTED'];

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

    /**
     * The request just entered INSTALLATION after delivery: the wait is over and scheduling is IT's turn, so the ticket's
     * SLA runs again. A ticket that is not waiting on the request (manual vendor wait released, in progress, closed) is left alone.
     */
    /**
     * With `silentUnlessMoved` (a retry) nothing is posted unless the ticket really leaves the wait, so repeating the call
     * is harmless on a ticket another request or an agent keeps held. Resolves to whether the ticket moved.
     */
    async resumeForInstallation(requestId: string, actorId?: string | null, options: { silentUnlessMoved?: boolean } = {}): Promise<boolean> {
        const request = await this.reqRepo.findOne({ where: { id: requestId } }).catch(() => null);
        if (!request?.sourceTicketId) return false;
        return this.linked.record({
            silentUnlessMoved: options.silentUnlessMoved,
            ticketId: request.sourceTicketId,
            actorId,
            target: TicketStatus.IN_PROGRESS,
            text: `Barang untuk ${request.requestNumber} sudah tiba. Tim IT menjadwalkan pemasangan.`,
            event: { hardwareRequest: { id: request.id, number: request.requestNumber, phase: 'PROCUREMENT_DONE', at: null } },
        });
    }

    async record(requestId: string, phase: HardwareTicketPhase, options: RecordOptions = {}): Promise<void> {
        const request = await this.reqRepo.findOne({ where: { id: requestId } }).catch(() => null);
        if (!request?.sourceTicketId) return;
        const at = options.at ? new Date(options.at) : null;
        await this.linked.record({
            ticketId: request.sourceTicketId,
            actorId: options.actorId,
            target: PHASE_STATUS[phase],
            ...(REOPENING.includes(phase) ? { reopenResolved: true as const } : {}),
            text: PHASE_TEXT[phase](request.requestNumber, at?.toLocaleString('id-ID', WHEN_FORMAT)),
            event: {
                ...(options.reason ? { reason: options.reason } : {}),
                hardwareRequest: { id: request.id, number: request.requestNumber, phase, at: at?.toISOString() ?? null },
            },
        });
    }
}
