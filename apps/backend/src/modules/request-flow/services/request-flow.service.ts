import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/application/auth-user.types';
import { EFormRequestService } from '../../eform-request/eform-request.service';
import { EFormType } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { Ticket, TicketPriority } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { TicketCreateService } from '../../ticketing/services/ticket-create.service';
import { TicketSystemEvent } from '../../ticketing/utils/ticket-activity.util';
import { User } from '../../users/entities/user.entity';
import { periodError } from '../domain/eform-period';
import { RequestKind, ticketTypeOf } from '../domain/request-kind';
import { CreateEformTicketDto } from '../dto/create-eform-ticket.dto';
import { CreateHardwareTicketDto, HardwareTicketItemDto } from '../dto/create-hardware-ticket.dto';
import { RequestDocumentRevision } from '../entities/request-document-revision.entity';
import { RequestFlow } from '../entities/request-flow.entity';

export interface CreatedRequestTicket { ticketId: string; ticketNumber: string }

const FIRST_REVISION = { version: 1, kind: 'GEN', label: 'Dibuat dari pengajuan · TTD pemohon' } as const;
const RECIPIENT_SEPARATOR = ', ';
const KIND_LABEL: Record<RequestKind, string> = { HARDWARE: 'Hardware Request', EFORM: 'E-Form Request' };

/** Ticket title per access kind, as the form names them. */
const EFORM_TITLE: Record<EFormType, string> = {
    [EFormType.VPN]: 'Akses VPN',
    [EFormType.WEBSITE]: 'Akses Website',
    [EFormType.NETWORK]: 'Akses Network',
    [EFormType.FLASHDISK]: 'Akses Flashdisk',
    [EFormType.EMAIL]: 'Akses Email',
    [EFormType.SYNOLOGY_NAS]: 'Akses Synology NAS',
};

const MESSAGES = {
    managerSelf: 'Atasan tidak boleh pemohon sendiri',
    managerInactive: 'Atasan yang dipilih tidak ditemukan atau tidak aktif',
    termsRequired: 'Setujui syarat penggunaan',
} as const;

/**
 * Hardware and e-form requests filed from the unified "Buat Tiket" form. Each becomes one IT ticket typed by kind, in
 * one transaction: ticket -> request detail (linked by `sourceTicketId`) -> `request_flows` row (route decided later
 * by IT) -> document revision v1 -> the ticket's first system message. Nothing notifies an approver here.
 */
@Injectable()
export class RequestFlowService {
    constructor(
        private readonly tickets: TicketCreateService,
        private readonly hardware: HardwareRequestCommandService,
        private readonly eforms: EFormRequestService,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) {}

    async createHardware(actor: AuthenticatedUser, dto: CreateHardwareTicketDto): Promise<CreatedRequestTicket> {
        await this.assertProposedManager(actor.userId, dto.managerId);
        const ticket = await this.tickets.createTicketWithin(actor.userId, {
            title: dto.title,
            description: dto.justification,
            priority: TicketPriority.MEDIUM,
            ticketType: ticketTypeOf('HARDWARE'),
        }, async (manager, saved, requester) => {
            const draft = await this.hardware.createDraftWith(manager, actor.userId, actor.siteId, actor.role, {
                recipientName: dto.recipients.join(RECIPIENT_SEPARATOR),
                division: dto.division,
                // Stored as given: the source (budget / stock) is IT's decision at review, not a prefix.
                justification: dto.justification,
                items: dto.items.map(toDraftItem),
            }, { sourceTicketId: saved.id, requesterSignature: dto.signatureData });
            await this.hardware.submitWith(manager, actor.userId, draft.id, { allowDirectInstallation: false });
            await this.openFlow(manager, saved, requester, { kind: 'HARDWARE', hardwareRequestId: draft.id, managerId: dto.managerId });
        });
        return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
    }

    async createEform(actor: AuthenticatedUser, dto: CreateEformTicketDto): Promise<CreatedRequestTicket> {
        if (!dto.termsAccepted) throw new BadRequestException(MESSAGES.termsRequired);
        const invalidPeriod = periodError(dto.formType, dto.startDate, dto.endDate);
        if (invalidPeriod) throw new BadRequestException(invalidPeriod);
        await this.assertProposedManager(actor.userId, dto.managerId);

        const { startDate, endDate, ...request } = dto;
        // Same keys the e-form pages, PDF and expiry reminders read; an empty end date means permanent.
        const formData = { ...(dto.formData ?? {}), dariTanggal: startDate, sampaiTanggal: endDate ?? '' };
        const title = EFORM_TITLE[dto.formType];
        const ticket = await this.tickets.createTicketWithin(actor.userId, {
            title,
            description: String(dto.formData?.alasan ?? '').trim() || title,
            priority: TicketPriority.MEDIUM,
            ticketType: ticketTypeOf('EFORM'),
        }, async (manager, saved, requester) => {
            const eform = await this.eforms.createForTicket(manager, actor.userId, actor.fullName, { ...request, formData }, saved.id);
            await this.openFlow(manager, saved, requester, { kind: 'EFORM', eformRequestId: eform.id, managerId: dto.managerId });
        });
        return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
    }

    /** The manager the requester proposes must be someone else who can still sign. */
    private async assertProposedManager(requesterId: string, managerId?: string): Promise<void> {
        if (!managerId) return;
        if (managerId === requesterId) throw new BadRequestException(MESSAGES.managerSelf);
        const exists = await this.userRepo.exists({ where: { id: managerId, isActive: true } });
        if (!exists) throw new BadRequestException(MESSAGES.managerInactive);
    }

    private async openFlow(
        manager: EntityManager,
        ticket: Ticket,
        requester: User,
        flow: { kind: RequestKind; hardwareRequestId?: string; eformRequestId?: string; managerId?: string },
    ): Promise<void> {
        const saved = await manager.save(RequestFlow, manager.create(RequestFlow, {
            ticketId: ticket.id,
            kind: flow.kind,
            hardwareRequestId: flow.hardwareRequestId ?? null,
            eformRequestId: flow.eformRequestId ?? null,
            route: null,
            managerId: flow.managerId ?? null,
        }));
        await manager.save(RequestDocumentRevision, manager.create(RequestDocumentRevision, {
            flowId: saved.id, ...FIRST_REVISION, actorId: requester.id,
        }));
        const systemEvent: TicketSystemEvent = { v: 1, actor: { id: requester.id, name: requester.fullName }, changes: [] };
        await manager.save(TicketMessage, manager.create(TicketMessage, {
            ticketId: ticket.id,
            senderId: requester.id,
            isSystemMessage: true,
            content: `System: ${requester.fullName} membuat ${KIND_LABEL[flow.kind]}`,
            systemEvent,
        }));
    }
}

/** Form item -> draft item; the per-item recipient is stored in its own column and, for older readers, with the item's fields. */
function toDraftItem(item: HardwareTicketItemDto) {
    return {
        catalogId: item.catalogId,
        manualName: item.manualName,
        quantity: item.quantity,
        notes: item.note,
        recipientName: item.recipientName,
        replacesName: item.replacesName,
        customFields: { ...(item.fields ?? {}), ...(item.recipientName ? { recipientName: item.recipientName } : {}) },
    };
}
