import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { EFormRequest, EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import type { ConfirmDto } from '../dto/confirm.dto';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

const MESSAGES = {
    badTicketId: 'ID tiket tidak valid',
    denied: 'Hanya pemohon atau tim IT yang dapat menjawab ini',
    notWaiting: 'Permintaan ini tidak sedang menunggu konfirmasi pemohon',
} as const;

export interface ConfirmResultView { status: string; result: ConfirmDto['result'] }

/** The label of the final revision; the same text whoever confirmed it (or the ticket closed by itself). */
export const finalRevisionLabel = (number: string): string => `Final · terkunci · ${number}`;

/** The requester's answer (or IT's, on their behalf) once the work is reported done: it works, or it goes back to IT. */
@Injectable()
export class RequestConfirmFlowService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly hardware: HardwareRequestCommandService,
        private readonly documents: RequestDocumentService,
        private readonly stepper: RequestFlowStepper,
        private readonly audit: AuditService,
    ) {}

    async confirm(actor: FlowActor, ticketId: string, dto: ConfirmDto): Promise<ConfirmResultView> {
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
        const issue = dto.result === 'ISSUE';
        if (issue && (dto.note?.trim().length ?? 0) < 5) throw new BadRequestException('Jelaskan kendalanya (minimal 5 karakter)');

        const { ctx, status, onBehalf, announce } = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            const onBehalf = actor.userId !== ctx.requesterId;
            if (onBehalf) {
                if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.denied);
                assertSiteAccess(actor, ctx.ticket.siteId);
            }
            if (!this.isWaiting(ctx)) throw new ConflictException(MESSAGES.notWaiting);

            let announce: () => void = () => undefined;
            let status: string;
            if (ctx.hardware) {
                const kind = issue ? 'REPORT_ISSUE' : 'ACCEPT_AS_IS';
                const done = await this.hardware.confirmInstallationWith(manager, ctx.hardware.id, actor.userId, { kind, comments: dto.note }, onBehalf);
                announce = done.announce;
                status = issue ? RequestStatus.INSTALLATION : RequestStatus.COMPLETED;
            } else {
                status = issue ? EFormStatus.PENDING_ICT : EFormStatus.CONFIRMED;
                await manager.update(EFormRequest, { id: ctx.eform!.id }, issue ? { status: EFormStatus.PENDING_ICT } : { status: EFormStatus.CONFIRMED, resolvedAt: new Date() });
            }
            if (!issue) await this.documents.bump(ctx.flow.id, 'FIN', finalRevisionLabel(ctx.number), actor.userId, manager);
            return { ctx, status, onBehalf, announce };
        });

        announce();
        const recordId = (ctx.hardware ?? ctx.eform)!.id;
        if (onBehalf) {
            this.audit.logAsync({
                userId: actor.userId, action: AuditAction.REQUEST_CONFIRMED_ON_BEHALF, entityType: ctx.hardware ? 'HardwareRequest' : 'EFormRequest', entityId: recordId,
                description: `Answered ${dto.result} on behalf of the requester`, newValue: { result: dto.result },
            });
        }
        await this.stepper.tell(ctx, this.message(ctx, actor, dto, onBehalf));
        return { status, result: dto.result };
    }

    private isWaiting(ctx: FlowContext): boolean {
        return ctx.hardware ? ctx.hardware.status === RequestStatus.AWAITING_USER_CONFIRMATION : ctx.eform?.status === EFormStatus.AWAITING_CONFIRMATION;
    }

    private message(ctx: FlowContext, actor: FlowActor, dto: ConfirmDto, onBehalf: boolean) {
        const who = onBehalf ? `${actor.fullName} (atas nama pemohon)` : actor.fullName;
        if (dto.result === 'OK') {
            return {
                actorId: actor.userId, phase: ctx.hardware ? 'COMPLETED' as const : 'CONFIRMED' as const,
                target: TicketStatus.CLOSED, text: `${who} mengonfirmasi — tiket ditutup`,
            };
        }
        return {
            actorId: actor.userId, phase: 'ISSUE_REPORTED' as const, target: TicketStatus.IN_PROGRESS, reopenResolved: true,
            text: onBehalf ? `${who} melaporkan kendala — kembali ke IT` : 'Pemohon melaporkan kendala — kembali ke IT',
            reason: dto.note,
        };
    }
}
