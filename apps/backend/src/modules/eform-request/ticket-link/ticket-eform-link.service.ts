import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EFormRequest } from '../entities/eform-request.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketLinkedRequestService } from '../../ticketing/services/ticket-linked-request.service';
import { EFormTicketPhase } from '../../ticketing/utils/ticket-activity.util';
import { accessName, eformCode } from './eform-ticket.util';

/** Chat text per phase; the structured `systemEvent.eformRequest` drives the card, this stays for email and search. */
const PHASE_TEXT: Record<EFormTicketPhase, (access: string) => string> = {
    PROPOSED: (a) => `Tim IT mengusulkan pengajuan ${a}. Pemohon diminta melengkapi dan menandatangani.`,
    DECLINED: (a) => `Pemohon menolak usulan ${a}.`,
    WITHDRAWN: (a) => `Tim IT menarik usulan ${a}.`,
    SUBMITTED: (a) => `Pemohon menandatangani dan mengajukan ${a}; tiket menunggu prosesnya.`,
    MANAGER_APPROVED: (a) => `Pengajuan ${a} disetujui atasan dan diteruskan ke ICT.`,
    GRANTED: (a) => `${a.charAt(0).toUpperCase()}${a.slice(1)} sudah diberikan. Tiket ditutup otomatis.`,
    REJECTED: (a) => `Pengajuan ${a} ditolak. Tiket kembali ditangani.`,
};

/** Where the ticket goes at each phase; phases not listed leave its status alone. */
const PHASE_STATUS: Partial<Record<EFormTicketPhase, TicketStatus>> = {
    SUBMITTED: TicketStatus.WAITING_VENDOR,
    GRANTED: TicketStatus.CLOSED,
    REJECTED: TicketStatus.IN_PROGRESS,
};

/**
 * Tells an IT support ticket what happened to the e-form access proposed from it: a chat card per step and, while
 * the request runs, the ticket waits (SLA held), resuming when it is rejected and closing once access is granted.
 */
@Injectable()
export class TicketEFormLinkService {
    constructor(
        @InjectRepository(EFormRequest) private readonly repo: Repository<EFormRequest>,
        private readonly linked: TicketLinkedRequestService,
    ) {}

    async record(requestId: string, phase: EFormTicketPhase, options: { actorId?: string | null; reason?: string | null } = {}): Promise<void> {
        const request = await this.repo.findOne({ where: { id: requestId } }).catch(() => null);
        if (!request?.sourceTicketId) return;
        await this.linked.record({
            ticketId: request.sourceTicketId,
            actorId: options.actorId,
            target: PHASE_STATUS[phase],
            text: PHASE_TEXT[phase](accessName(request.formType, request.id)),
            event: {
                ...(options.reason ? { reason: options.reason } : {}),
                eformRequest: { id: request.id, code: eformCode(request.id), formType: request.formType, phase },
            },
        });
    }
}
