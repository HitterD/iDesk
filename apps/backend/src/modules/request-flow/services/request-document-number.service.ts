import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { DOCUMENT_NUMBER_MAX, DOCUMENT_NUMBER_PATTERN } from '../../eform-request/eform-document-number';
import { EFormRequest, EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { ActivityAction } from '../../hardware-request/domain/enums/activity-action.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { RequestFlowReader } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';

/** `hardware_requests.requestNumber` is varchar(32). */
export const HARDWARE_NUMBER_MAX = 32;
const CLOSED_HARDWARE: readonly string[] = [RequestStatus.COMPLETED, RequestStatus.CLOSED, RequestStatus.REJECTED, RequestStatus.CANCELLED];
const CLOSED_EFORM: readonly string[] = [EFormStatus.CONFIRMED, EFormStatus.REJECTED, EFormStatus.CANCELLED, EFormStatus.DRAFT];
const PG_UNIQUE_VIOLATION = '23505';

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    closed: 'Nomor dokumen tidak bisa diubah setelah permintaan selesai, ditolak, atau dibatalkan',
} as const;

const invalidMessage = (max: number): string => `Nomor dokumen hanya boleh huruf, angka, dan / . _ - (maks. ${max} karakter)`;

/** IT edits the document number of a request ticket: the e-form's document number or the hardware request's number. */
@Injectable()
export class RequestDocumentNumberService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly audit: AuditService,
    ) {}

    async update(actor: FlowActor, ticketId: string, raw: string): Promise<{ documentNumber: string }> {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
        const value = raw?.trim() ?? '';

        return this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            const status = (ctx.hardware ?? ctx.eform)!.status as string;
            if ((ctx.hardware ? CLOSED_HARDWARE : CLOSED_EFORM).includes(status)) throw new ConflictException(MESSAGES.closed);

            const max = ctx.hardware ? HARDWARE_NUMBER_MAX : DOCUMENT_NUMBER_MAX;
            if (!value || value.length > max || !DOCUMENT_NUMBER_PATTERN.test(value)) throw new BadRequestException(invalidMessage(max));
            const previous = ctx.number;
            if (value === previous) return { documentNumber: value };

            const id = (ctx.hardware ?? ctx.eform)!.id;
            const target = ctx.hardware ? HardwareRequest : EFormRequest;
            const column = ctx.hardware ? 'requestNumber' : 'documentNumber';
            const taken = await manager.exists(target as never, { where: { [column]: value, id: Not(id) } } as never);
            if (taken) throw new ConflictException(`Nomor ${value} sudah dipakai dokumen lain`);
            try {
                await manager.update(target as never, { id } as never, { [column]: value } as never);
            } catch (err: any) {
                // Two edits racing to the same number: the unique index decides, the loser gets the same answer as above.
                if (err?.code === PG_UNIQUE_VIOLATION) throw new ConflictException(`Nomor ${value} sudah dipakai dokumen lain`);
                throw err;
            }

            if (ctx.hardware) {
                await manager.save(HardwareRequestActivity, manager.create(HardwareRequestActivity, {
                    requestId: id, actorId: actor.userId, action: ActivityAction.UPDATED,
                    fromStatus: ctx.hardware.status, toStatus: ctx.hardware.status,
                    metadata: { change: 'DOCUMENT_NUMBER', from: previous, to: value },
                }));
            } else {
                this.audit.logAsync({
                    userId: actor.userId, action: AuditAction.EFORM_DOCUMENT_NUMBER_UPDATE, entityType: 'EFormRequest', entityId: id,
                    description: 'Changed E-Form document number', oldValue: { documentNumber: previous }, newValue: { documentNumber: value },
                });
            }
            return { documentNumber: value };
        });
    }
}
