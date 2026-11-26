import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { DataSource, EntityManager, Like, MoreThan, Repository } from 'typeorm';
import { EFormApproval } from '../../eform-request/entities/eform-approval.entity';
import { EFormRequest, EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { isUUID } from 'class-validator';
import { HR_EVT } from '../../hardware-request/domain/events/hardware-request.events';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { assertSiteAccess, resolveSiteScope } from '../../../shared/core/utils/site-scope.util';
import { validateFileMagicBytes } from '../../../shared/core/validators/magic-bytes.validator';
import { canChangeRoute, type ApprovalRoute } from '../domain/approval-route';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { ROUTE_LABEL, SOURCE_LABEL, STEP_LABEL } from '../domain/approval-phase';
import { RequestFlow } from '../entities/request-flow.entity';
import { documentQrText } from '../pdf/hardware-request-pdf';
import type { ApproveDto } from '../dto/approve.dto';
import type { ReviewDto } from '../dto/review.dto';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowNotifier } from './request-flow-notifier';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';
import { RequestFlowStepper } from './request-flow-stepper';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';

/** Folder (under `uploads/`) for scanned paper signatures. The /uploads handler refuses it: files leave only through the API. */
export const REQUEST_SCANS_DIR = 'request-scans';
export const SCAN_ALLOWED_EXTENSIONS: readonly string[] = ['.pdf', '.jpg', '.jpeg', '.png'];
export const SCAN_MAX_BYTES = 10 * 1024 * 1024;
/** One reminder per request per hour. */
export const REMIND_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_TEXT_PREFIX = 'System: Pengingat';
const SCAN_DIR_PATH = join(process.cwd(), 'uploads', REQUEST_SCANS_DIR);
const QR_PATTERN = /^.+\/v\d+$/;

/** multer filter: only PDF/JPG/PNG scans are stored at all (content is checked again once the file is read). */
export function scanFileFilter(
    _req: unknown, file: { originalname?: string }, callback: (error: Error | null, accept: boolean) => void,
): void {
    const ext = extname(file.originalname ?? '').toLowerCase();
    if (SCAN_ALLOWED_EXTENSIONS.includes(ext)) callback(null, true);
    else callback(new BadRequestException('Berkas harus PDF, JPG, atau PNG yang valid (maks. 10 MB)'), false);
}

export interface FlowActor { userId: string; role: UserRole; siteId: string | null; fullName: string }

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    badQr: 'QR tidak valid. Pastikan Anda mengunggah dokumen hasil unduhan iDesk.',
    managerSigned: 'Atasan sudah menandatangani; atasan tidak bisa diganti',
    gmSigned: 'GM sudah menandatangani; GM tidak bisa diganti',
    wrongPhase: 'Permintaan ini tidak sedang menunggu tinjauan IT',
    notApproval: 'Permintaan ini tidak sedang menunggu persetujuan',
    cancelDenied: 'Hanya pemohon atau tim IT yang dapat membatalkan permintaan ini',
    cancelLate: 'Permintaan sudah diproses IT dan tidak bisa dibatalkan pemohon. Hubungi IT.',
    cancelFinished: 'Permintaan ini sudah selesai atau ditutup, tidak bisa dibatalkan lagi.',
    notYourTurn: 'Bukan giliran Anda untuk menyetujui permintaan ini',
    managerRequired: 'Pilih atasan penyetuju',
    gmRequired: 'Pilih GM penyetuju',
    sourceRequired: 'Pilih sumber barang',
    managerSelf: 'Atasan tidak boleh pemohon sendiri',
    gmSelf: 'GM tidak boleh pemohon sendiri',
    sameSigner: 'Atasan dan GM harus orang yang berbeda',
    inactive: 'Atasan atau GM yang dipilih tidak ditemukan atau tidak aktif',
    routeLocked: 'Persetujuan yang sudah ditandatangani tidak bisa dihapus atau diturunkan',
    signatureRequired: 'Tanda tangan wajib diisi',
    reasonRequired: 'Alasan wajib diisi (minimal 5 karakter)',
    reminded: 'Pengingat sudah dikirim kurang dari 1 jam lalu',
    fileRequired: 'Pilih berkas scan (PDF, JPG, atau PNG)',
    fileInvalid: 'Berkas harus PDF, JPG, atau PNG yang valid (maks. 10 MB)',
} as const;
const REASON_MIN = 5;
const EFORM_FINISHED: readonly EFormStatus[] = [EFormStatus.CONFIRMED, EFormStatus.REJECTED, EFormStatus.CANCELLED];
/** Hardware states the flow lets each side cancel from: the requester until IT has chosen the route and it is signed, IT any time before it is installed. */
const REQUESTER_CANCEL_STATES: readonly RequestStatus[] = [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW];
const IT_CANCEL_STATES: readonly RequestStatus[] = [
    RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED, RequestStatus.PROCUREMENT, RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION,
];

/** QR mismatch: the scan was signed on an older version of the document. */
export const staleScanMessage = (scanned: string, latest: number): string => {
    const old = /\/v(\d+)$/.exec(scanned)?.[1];
    return `Dokumen versi lama (v${old ?? '?'}). Unduh versi terbaru (v${latest}) lalu minta tanda tangan ulang.`;
};

/**
 * IT's review of a request, the approver's decision and the paper-signature import. Each runs in one transaction on the
 * locked flow, then tells the ticket's chat and the people concerned (those never fail the step).
 */
@Injectable()
export class RequestFlowReviewService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly stepper: RequestFlowStepper,
        private readonly documents: RequestDocumentService,
        private readonly notifier: RequestFlowNotifier,
        private readonly hardware: HardwareRequestCommandService,
        private readonly emitter: EventEmitter2,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) {}

    async review(actor: FlowActor, ticketId: string, dto: ReviewDto): Promise<{ version: number }> {
        this.assertIct(actor);
        this.assertTicketId(ticketId);
        const { ctx, version, next, publish } = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            if (ctx.phase !== 'review') throw new ConflictException(MESSAGES.wrongPhase);
            await this.validateReview(ctx, dto);

            if (ctx.hardware && ctx.hardware.status === 'SUBMITTED') await this.hardware.reviewWith(manager, actor.userId, ctx.hardware.id);
            Object.assign(ctx.flow, {
                route: dto.route,
                managerId: dto.route === 'NONE' ? ctx.flow.managerId : dto.managerId ?? null,
                gmId: dto.route === 'MANAGER_GM' ? dto.gmId ?? null : null,
                hardwareSource: ctx.hardware ? dto.hardwareSource ?? null : null,
                reviewedById: actor.userId,
                reviewedAt: new Date(),
                returnedReason: null,
            });
            await manager.save(RequestFlow, ctx.flow);
            if (dto.message) await this.saveMessage(manager, ctx, actor.userId, dto.message);

            const source = ctx.flow.hardwareSource ? ` · ${SOURCE_LABEL[ctx.flow.hardwareSource]}` : '';
            const version = await this.documents.bump(ctx.flow.id, 'GEN', `Ditinjau IT: ${ROUTE_LABEL[dto.route]}${source}`, actor.userId, manager);
            const next = await this.stepper.advance(manager, ctx, ctx.signed, actor.userId);
            // The ticket moves in the same commit as the request: a ticket that changed meanwhile rolls the review back.
            const publish = await this.stepper.tellWithin(manager, ctx, {
                actorId: actor.userId,
                phase: 'REVIEWED',
                text: `${actor.fullName} meninjau permintaan. Persetujuan: ${ROUTE_LABEL[dto.route]}${ctx.flow.hardwareSource ? ` · ${SOURCE_LABEL[ctx.flow.hardwareSource]}` : ''}.`,
                // Waiting on an approver (or on goods to be bought) holds the ticket's SLA; otherwise IT carries on.
                target: this.stepper.holdTarget(ctx, next),
            });
            return { ctx, version, next, publish };
        });
        await publish();
        const approverId = next === 'MANAGER' ? ctx.flow.managerId : next === 'GM' ? ctx.flow.gmId : null;
        if (next && approverId) await this.notifier.askApprover(ctx, next, approverId);
        return { version };
    }

    async decide(actor: FlowActor, ticketId: string, dto: ApproveDto): Promise<{ version?: number }> {
        this.assertTicketId(ticketId);
        const outcome = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            if (ctx.phase !== 'approval' || !ctx.step) throw new ConflictException(MESSAGES.notApproval);
            if (ctx.approverId !== actor.userId) throw new ForbiddenException(MESSAGES.notYourTurn);
            if (dto.decision === 'APPROVE') return { ctx, ...(await this.approve(manager, ctx, actor, dto)) };
            const reason = dto.note?.trim() ?? '';
            if (reason.length < REASON_MIN) throw new BadRequestException(MESSAGES.reasonRequired);
            return { ctx, ...(dto.decision === 'RETURN' ? await this.sendBack(manager, ctx, actor, reason) : await this.refuse(manager, ctx, actor, reason)) };
        });
        await this.afterDecision(actor, dto, outcome);
        return { version: outcome.version };
    }

    /** IT refuses a request still in review (nothing was approved or bought yet); the reason goes to the requester. */
    async rejectByIt(actor: FlowActor, ticketId: string, reason: string): Promise<void> {
        this.assertIct(actor);
        this.assertTicketId(ticketId);
        const text = reason?.trim() ?? '';
        if (text.length < REASON_MIN) throw new BadRequestException(MESSAGES.reasonRequired);
        const outcome = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            if (ctx.phase !== 'review') throw new ConflictException(MESSAGES.wrongPhase);
            return { ctx, ...(await this.refuse(manager, ctx, actor, text)) };
        });
        await this.afterDecision(actor, { decision: 'REJECT', note: text } as ApproveDto, outcome);
    }

    /**
     * Withdraws a request: the requester while it is still in review or waiting for a signature, IT any time before it
     * is installed. The request is cancelled, the final document locks and the ticket is cancelled in the same commit.
     */
    async cancel(actor: FlowActor, ticketId: string): Promise<void> {
        this.assertTicketId(ticketId);
        const done = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            const scope = resolveSiteScope(actor);
            const hasSiteAccess = scope.mode === 'all' || (scope.mode === 'site' && scope.siteId === ctx.ticket.siteId);
            const isIt = REQUEST_PROCESSOR_ROLES.includes(actor.role) && hasSiteAccess;
            if (!isIt && actor.userId !== ctx.requesterId) {
                if (REQUEST_PROCESSOR_ROLES.includes(actor.role)) assertSiteAccess(actor, ctx.ticket.siteId);
                throw new ForbiddenException(MESSAGES.cancelDenied);
            }
            if (!isIt && ctx.phase === 'other') throw new ConflictException(MESSAGES.cancelLate);

            let announce: () => void = () => undefined;
            if (ctx.hardware) {
                announce = (await this.hardware.cancelWith(manager, { id: actor.userId, role: isIt ? 'ICT_STAFF' : 'USER' }, ctx.hardware.id, { allowed: isIt ? IT_CANCEL_STATES : REQUESTER_CANCEL_STATES })).announce;
            } else {
                if (EFORM_FINISHED.includes(ctx.eform!.status)) throw new ConflictException(MESSAGES.cancelFinished);
                await manager.update(EFormRequest, { id: ctx.eform!.id }, { status: EFormStatus.CANCELLED, currentApproverId: null, resolvedAt: new Date() });
                await manager.update(EFormApproval, { eformRequestId: ctx.eform!.id, action: 'PENDING' }, { action: 'REJECTED', actionAt: new Date(), notes: 'Dibatalkan' });
            }
            await this.documents.bump(ctx.flow.id, 'FIN', `Dibatalkan oleh ${actor.fullName} · terkunci`, actor.userId, manager);
            const publish = await this.stepper.tellWithin(manager, ctx, {
                actorId: actor.userId, phase: 'WITHDRAWN', target: TicketStatus.CANCELLED, text: `${actor.fullName} membatalkan permintaan ini`,
            });
            return { announce, publish };
        });
        done.announce();
        await done.publish();
    }

    /**
     * The flow row is locked first, so two reminders cannot both pass the hour check; the marker (a system message
     * with its card event) is written in the same transaction, and only the call that wrote it notifies.
     */
    async remind(actor: FlowActor, ticketId: string): Promise<void> {
        this.assertIct(actor);
        this.assertTicketId(ticketId);
        const ctx = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            if (ctx.phase !== 'approval' || !ctx.step || !ctx.approverId) throw new ConflictException(MESSAGES.notApproval);
            const recent = await manager.findOne(TicketMessage, {
                where: { ticketId, isSystemMessage: true, content: Like(`${REMINDER_TEXT_PREFIX}%`), createdAt: MoreThan(new Date(Date.now() - REMIND_INTERVAL_MS)) },
            });
            if (recent) throw new ConflictException(MESSAGES.reminded);
            const approver = await manager.findOne(User, { where: { id: ctx.approverId }, select: ['id', 'fullName'] });
            await manager.save(TicketMessage, manager.create(TicketMessage, {
                ticketId,
                senderId: actor.userId,
                isSystemMessage: true,
                content: `${REMINDER_TEXT_PREFIX} persetujuan dikirim ke ${approver?.fullName ?? STEP_LABEL[ctx.step]}`,
                systemEvent: this.stepper.eventOf(ctx, actor, 'REMINDED'),
            }));
            return ctx;
        });
        await this.notifier.askApprover(ctx, ctx.step!, ctx.approverId!, true);
    }

    /** IT imports the scanned paper signature of the active step; the QR must name the latest version of the document. */
    async paperSign(actor: FlowActor, ticketId: string, file: Express.Multer.File | undefined, qr: string): Promise<{ version: number }> {
        try {
            this.assertIct(actor);
            this.assertTicketId(ticketId);
            this.assertScan(file);
            const stored = file!.filename ? `${REQUEST_SCANS_DIR}/${file!.filename}` : undefined;
            const outcome = await this.dataSource.transaction(async (manager) => {
                const ctx = await this.reader.load(ticketId, manager, true);
                assertSiteAccess(actor, ctx.ticket.siteId);
                if (ctx.phase !== 'approval' || !ctx.step || !ctx.approverId) throw new ConflictException(MESSAGES.notApproval);
                if (!QR_PATTERN.test(qr.trim())) throw new BadRequestException(MESSAGES.badQr);
                if (qr.trim() !== documentQrText(ctx.ticket.ticketNumber, ctx.flow.documentVersion)) {
                    throw new ConflictException(staleScanMessage(qr.trim(), ctx.flow.documentVersion));
                }
                const signer = await this.userRepo.findOne({ where: { id: ctx.approverId }, select: ['id', 'fullName'] });
                const result = await this.stepper.sign(manager, ctx, {
                    signer: { id: ctx.approverId, name: signer?.fullName ?? STEP_LABEL[ctx.step] },
                    actorId: actor.userId, how: 'paper', scanPath: stored,
                });
                const signerName = signer?.fullName ?? STEP_LABEL[ctx.step];
                const publish = await this.tellSigned(manager, ctx, actor, result.next, `${signerName} menyetujui (dokumen kertas diimpor oleh ${actor.fullName})`);
                return { ctx, signerName, ...result, publish };
            });
            await outcome.publish();
            await this.notifyAfterSign(outcome.ctx, outcome.next);
            return { version: outcome.version };
        } catch (err) {
            // Nothing points at a refused upload; drop it instead of leaving an orphan on disk.
            await this.removeScan(file);
            throw err;
        }
    }

    private assertIct(actor: FlowActor): void {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
    }

    private assertTicketId(ticketId: string): void {
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
    }

    private assertScan(file: Express.Multer.File | undefined): void {
        if (!file) throw new BadRequestException(MESSAGES.fileRequired);
        const ext = extname(file.originalname ?? '').toLowerCase();
        if (!SCAN_ALLOWED_EXTENSIONS.includes(ext) || file.size > SCAN_MAX_BYTES || !validateFileMagicBytes(file)) {
            throw new BadRequestException(MESSAGES.fileInvalid);
        }
    }

    /** Deletes the stored upload (whatever its extension) from the scan folder; never anything outside it. */
    private async removeScan(file: Express.Multer.File | undefined): Promise<void> {
        const name = file?.filename ?? (file?.path ? basename(file.path) : undefined);
        if (!name) return;
        await fs.unlink(join(SCAN_DIR_PATH, basename(name))).catch(() => undefined);
    }

    private async validateReview(ctx: FlowContext, dto: ReviewDto): Promise<void> {
        if (ctx.hardware && !dto.hardwareSource) throw new BadRequestException(MESSAGES.sourceRequired);
        const previous = ctx.flow.route;
        if (previous && !canChangeRoute(previous, dto.route, ctx.signed)) throw new BadRequestException(MESSAGES.routeLocked);
        // A signature belongs to the person who gave it: the signed manager / GM cannot be swapped out.
        if (ctx.signed.manager && dto.managerId !== ctx.flow.managerId) throw new BadRequestException(MESSAGES.managerSigned);
        if (ctx.signed.gm && dto.gmId !== ctx.flow.gmId) throw new BadRequestException(MESSAGES.gmSigned);
        if (dto.route === 'NONE') return;
        if (!dto.managerId) throw new BadRequestException(MESSAGES.managerRequired);
        if (dto.managerId === ctx.requesterId) throw new BadRequestException(MESSAGES.managerSelf);
        const ids = [dto.managerId];
        if (dto.route === 'MANAGER_GM') {
            if (!dto.gmId) throw new BadRequestException(MESSAGES.gmRequired);
            if (dto.gmId === ctx.requesterId) throw new BadRequestException(MESSAGES.gmSelf);
            if (dto.gmId === dto.managerId) throw new BadRequestException(MESSAGES.sameSigner);
            ids.push(dto.gmId);
        }
        for (const id of ids) {
            if (!(await this.userRepo.exists({ where: { id, isActive: true } }))) throw new BadRequestException(MESSAGES.inactive);
        }
    }

    private async saveMessage(manager: EntityManager, ctx: FlowContext, senderId: string, content: string): Promise<void> {
        await manager.save(TicketMessage, manager.create(TicketMessage, { ticketId: ctx.ticket.id, senderId, content }));
    }

    private async approve(manager: EntityManager, ctx: FlowContext, actor: FlowActor, dto: ApproveDto) {
        if (!dto.signatureData) throw new BadRequestException(MESSAGES.signatureRequired);
        const result = await this.stepper.sign(manager, ctx, {
            signer: { id: actor.userId, name: actor.fullName }, actorId: actor.userId, how: 'digital', signature: dto.signatureData,
        });
        const text = `${actor.fullName} menyetujui & menandatangani${dto.note ? `: ${dto.note}` : ''}`;
        const publish = await this.tellSigned(manager, ctx, actor, result.next, text);
        return { kind: 'APPROVE' as const, ...result, signerName: actor.fullName, publish };
    }

    /** Back to IT with the signatures kept; hardware stays UNDER_REVIEW (marked by `returnedReason`), an e-form goes back to PENDING_REVIEW. */
    private async sendBack(manager: EntityManager, ctx: FlowContext, actor: FlowActor, reason: string) {
        ctx.flow.returnedReason = reason;
        await manager.save(RequestFlow, ctx.flow);
        if (ctx.eform) {
            await manager.delete(EFormApproval, { eformRequestId: ctx.eform.id, action: 'PENDING' });
            await manager.update(EFormRequest, { id: ctx.eform.id }, { status: EFormStatus.PENDING_REVIEW, currentApproverId: null });
        }
        const publish = await this.stepper.tellWithin(manager, ctx, {
            actorId: actor.userId, phase: 'RETURNED', reason,
            text: `${actor.fullName} mengembalikan ke IT untuk diubah`, target: TicketStatus.IN_PROGRESS,
        });
        return { kind: 'RETURN' as const, reason, version: undefined, signerName: actor.fullName, publish };
    }

    private async refuse(manager: EntityManager, ctx: FlowContext, actor: FlowActor, reason: string) {
        if (ctx.hardware) {
            await this.hardware.rejectWith(manager, actor.userId, ctx.hardware.id, { reason });
        } else {
            const eformId = ctx.eform!.id;
            await manager.update(EFormRequest, { id: eformId }, {
                status: EFormStatus.REJECTED, rejectionReason: reason, currentApproverId: null, resolvedAt: new Date(),
            });
            await manager.update(EFormApproval, { eformRequestId: eformId, action: 'PENDING' }, { action: 'REJECTED', actionAt: new Date(), notes: reason });
        }
        const version = await this.documents.bump(ctx.flow.id, 'FIN', `Ditolak oleh ${actor.fullName} · terkunci`, actor.userId, manager);
        const publish = await this.stepper.tellWithin(manager, ctx, {
            actorId: actor.userId, phase: 'REJECTED', target: TicketStatus.CANCELLED, reason,
            text: `${actor.fullName} menolak permintaan ini: ${reason}`,
        });
        return { kind: 'REJECT' as const, reason, version, signerName: actor.fullName, publish };
    }

    private async afterDecision(actor: FlowActor, dto: ApproveDto, outcome: { ctx: FlowContext; kind: string; reason?: string; next?: 'MANAGER' | 'GM' | null; step?: 'MANAGER' | 'GM'; signerName: string; version?: number; publish?: () => Promise<void> }): Promise<void> {
        const { ctx } = outcome;
        if (outcome.kind === 'APPROVE') {
            await outcome.publish!();
            await this.notifyAfterSign(ctx, outcome.next ?? null);
            return;
        }
        if (outcome.kind === 'RETURN') {
            await outcome.publish!();
            await this.notifyIct(ctx, outcome.reason!);
            return;
        }
        if (outcome.publish) await outcome.publish();
        // Notify requester via existing notification listeners; sync listeners skip request-flow rows.
        if (ctx.hardware) {
            this.emitter.emit(HR_EVT.REJECTED, { requestId: ctx.hardware.id, actorId: actor.userId, occurredAt: new Date(), requesterId: ctx.requesterId, reason: outcome.reason });
        } else {
            const request = await this.dataSource.manager.findOne(EFormRequest, { where: { id: ctx.eform!.id } });
            this.emitter.emit('eform.rejected', { request, userId: actor.userId });
        }
    }

    /** The ticket's "signed" step, inside the caller's transaction (a step still to go, or goods to buy, keeps the SLA held; otherwise it is released). */
    private tellSigned(manager: EntityManager, ctx: FlowContext, actor: FlowActor, next: 'MANAGER' | 'GM' | null, text: string): Promise<() => Promise<void>> {
        return this.stepper.tellWithin(manager, ctx, { actorId: actor.userId, phase: 'SIGNED', text, target: this.stepper.holdTarget(ctx, next) });
    }

    /** After the commit: ask the next signer, or tell the requester it is approved. */
    private async notifyAfterSign(ctx: FlowContext, next: 'MANAGER' | 'GM' | null): Promise<void> {
        const nextApprover = next === 'GM' ? ctx.flow.gmId : next === 'MANAGER' ? ctx.flow.managerId : null;
        if (next && nextApprover) await this.notifier.askApprover(ctx, next, nextApprover);
        if (!next) await this.notifier.tellRequester(ctx, 'Permintaan disetujui', `Permintaan Anda (${ctx.ticket.ticketNumber}) sudah disetujui dan diproses IT.`);
    }

    /** IT hears a request came back, reusing the "request needs attention" type of its kind. */
    private async notifyIct(ctx: FlowContext, reason: string): Promise<void> {
        if (!ctx.flow.reviewedById) return;
        await this.notifier.tellUser(ctx, ctx.flow.reviewedById, 'Permintaan dikembalikan ke IT', `${ctx.ticket.ticketNumber}: ${reason}`);
    }
}
