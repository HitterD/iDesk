import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { EFormCredentialService } from '../../eform-request/eform-credential.service';
import { EFormCredential } from '../../eform-request/entities/eform-credential.entity';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { EFormSignature } from '../../eform-request/entities/eform-signature.entity';
import { CREDENTIAL_READER_ROLES } from '../../eform-request/eform-roles.constants';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { FULFILL_NOTE_MIN, type FulfillDto } from '../dto/fulfill.dto';
import { DataSource } from 'typeorm';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowNotifier } from './request-flow-notifier';
import { RequestFlowReader } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    notEform: 'Permintaan ini bukan pengajuan akses',
    notFulfilling: 'Pengajuan ini tidak sedang menunggu pemberian akses',
    credentialsRequired: 'Username dan password wajib diisi',
    noteRequired: `Catatan wajib diisi (minimal ${FULFILL_NOTE_MIN} karakter)`,
    denied: 'Tidak berhak membuka kredensial ini',
    notReady: 'Kredensial belum tersedia',
} as const;

const ICT_SIGNER_ROLE = 'ICT';

export interface FulfillResult { status: EFormStatus; mode: FulfillDto['mode'] }
export interface CredentialsView { username: string; password: string; server: string; note: string; provisionedAt: Date }

/** IT gives an e-form access on its request ticket; the requester (and IT of the site) can read the credentials back. */
@Injectable()
export class RequestFulfillFlowService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly credentialCrypto: EFormCredentialService,
        private readonly documents: RequestDocumentService,
        private readonly stepper: RequestFlowStepper,
        private readonly notifier: RequestFlowNotifier,
        private readonly audit: AuditService,
    ) {}

    async fulfill(actor: FlowActor, ticketId: string, dto: FulfillDto): Promise<FulfillResult> {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
        this.checkInput(dto);

        const ctx = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            const eform = ctx.eform;
            if (!eform) throw new ConflictException(MESSAGES.notEform);
            if (eform.status !== EFormStatus.PENDING_ICT) throw new ConflictException(MESSAGES.notFulfilling);

            // A retry after an issue replaces what IT gave before.
            await manager.delete(EFormCredential, { eformRequestId: eform.id });
            await manager.delete(EFormSignature, { eformRequestId: eform.id, signerRole: ICT_SIGNER_ROLE });
            if (dto.mode === 'CREDENTIALS') await this.storeCredentials(manager, eform, actor, dto);
            await manager.save(EFormSignature, manager.create(EFormSignature, {
                eformRequestId: eform.id, signerId: actor.userId, signerName: actor.fullName, signatureData: dto.signatureData, signerRole: ICT_SIGNER_ROLE,
            }));
            await manager.update(EFormRequest, { id: eform.id }, {
                status: EFormStatus.AWAITING_CONFIRMATION,
                currentApproverId: null,
                formData: this.fulfilledFormData(eform.formData, dto) as never,
            });
            await this.documents.bump(ctx.flow.id, 'DIG', 'TTD IT — akses diberikan', actor.userId, manager);
            return ctx;
        });

        // After the commit: one chat message, one notice to the requester; neither can fail the step.
        this.audit.logAsync({
            userId: actor.userId, action: AuditAction.EFORM_FULFILL, entityType: 'EFormRequest', entityId: ctx.eform!.id,
            description: `Gave E-Form access ${dto.mode === 'CREDENTIALS' ? 'with' : 'without'} credentials`,
        });
        await this.stepper.tell(ctx, {
            actorId: actor.userId, phase: 'FULFILLED', target: TicketStatus.RESOLVED, text: `Akses diberikan — ${ctx.requesterName} diminta mencoba`,
        });
        await this.notifier.tellRequester(ctx, 'Akses siap dicoba', `Akses untuk permintaan Anda (${ctx.ticket.ticketNumber}) sudah diberikan. Silakan coba dan konfirmasi.`);
        return { status: EFormStatus.AWAITING_CONFIRMATION, mode: dto.mode };
    }

    /** The requester, or ICT of the request's site. Every read is written to the audit trail (never the secrets). */
    async credentials(actor: FlowActor, ticketId: string): Promise<CredentialsView> {
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
        const ctx = await this.reader.load(ticketId);
        const eform = ctx.eform;
        if (!eform) throw new ConflictException(MESSAGES.notEform);

        const isRequester = actor.userId === ctx.requesterId;
        if (!isRequester && !CREDENTIAL_READER_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.denied);
        // The requester keeps access when another site's IT handled the request; staff stay site-scoped.
        if (!isRequester) assertSiteAccess(actor, ctx.ticket.siteId);

        const row = await this.dataSource.manager.findOne(EFormCredential, { where: { eformRequestId: eform.id } });
        if (!row) throw new NotFoundException(MESSAGES.notReady);
        const view: CredentialsView = {
            username: this.credentialCrypto.decrypt(row.encryptedUsername, row.iv, row.authTag),
            password: this.credentialCrypto.decrypt(row.encryptedPassword, row.passwordIv, row.passwordAuthTag),
            server: row.vpnServer ?? '',
            note: row.notes ?? '',
            provisionedAt: row.provisionedAt,
        };
        this.audit.logAsync({
            userId: actor.userId, action: AuditAction.CREDENTIALS_VIEWED, entityType: 'EFormRequest', entityId: eform.id,
            description: 'Viewed E-Form credentials',
        });
        return view;
    }

    private checkInput(dto: FulfillDto): void {
        if (dto.mode === 'CREDENTIALS') {
            if (!dto.username?.trim() || !dto.password) throw new BadRequestException(MESSAGES.credentialsRequired);
        } else if ((dto.note?.trim().length ?? 0) < FULFILL_NOTE_MIN) {
            throw new BadRequestException(MESSAGES.noteRequired);
        }
    }

    private async storeCredentials(manager: import('typeorm').EntityManager, eform: EFormRequest, actor: FlowActor, dto: FulfillDto): Promise<void> {
        const user = this.credentialCrypto.encrypt(dto.username!.trim());
        const pass = this.credentialCrypto.encrypt(dto.password!);
        await manager.save(EFormCredential, manager.create(EFormCredential, {
            eformRequestId: eform.id,
            encryptedUsername: user.ciphertext, iv: user.iv, authTag: user.authTag,
            encryptedPassword: pass.ciphertext, passwordIv: pass.iv, passwordAuthTag: pass.authTag,
            // An e-mail account has no server to hand over.
            vpnServer: eform.formType === EFormType.EMAIL ? '' : dto.server ?? '',
            notes: dto.note ?? '',
            provisionedById: actor.userId,
            accessCreatedAt: new Date(),
        }));
    }

    /** The legacy keys the e-form pages and the PDF read; earlier values of a retried fulfilment are dropped. */
    private fulfilledFormData(current: Record<string, unknown> | null, dto: FulfillDto): Record<string, unknown> {
        const { fulfillmentNotes: _notes, fulfilledAccountName: _account, ...rest } = current ?? {};
        const withoutCredentials = dto.mode === 'NO_CREDENTIALS';
        return {
            ...rest,
            ...(withoutCredentials ? { fulfillmentNotes: dto.note } : {}),
            ...(dto.accountName ? { fulfilledAccountName: dto.accountName } : {}),
            fulfilledWithoutCredentials: withoutCredentials,
        };
    }
}
