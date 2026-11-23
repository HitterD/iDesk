import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EFormApproval } from '../../eform-request/entities/eform-approval.entity';
import { EFormRequest, EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { EFormSignature } from '../../eform-request/entities/eform-signature.entity';
import { eformCode } from '../../eform-request/ticket-link/eform-ticket.util';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { ActivityAction } from '../../hardware-request/domain/enums/activity-action.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketLinkedRequestService } from '../../ticketing/services/ticket-linked-request.service';
import { EFormTicketPhase, HardwareTicketPhase, TicketSystemEvent } from '../../ticketing/utils/ticket-activity.util';
import { activeStep, STEP_LABEL, type ApprovalStep, type SignatureHow } from '../domain/approval-phase';
import { stepSignatureMetadata } from '../domain/hardware-signatures';
import { RequestDocumentService } from './request-document.service';
import type { FlowContext, SignedSteps } from './request-flow-reader';

/** Approval rows the e-form already uses: the manager is step 2, the GM step 3. */
const STEP_SEQUENCE: Record<ApprovalStep, number> = { MANAGER: 2, GM: 3 };
const EFORM_STATUS_OF_STEP: Record<ApprovalStep, EFormStatus> = { MANAGER: EFormStatus.PENDING_MANAGER, GM: EFormStatus.PENDING_GM };
const PENDING = 'PENDING';
const PAPER_NOTE = 'Tanda tangan kertas';

export interface SignInput {
    signer: { id: string; name: string };
    /** Who did it in iDesk: the signer, or IT importing a paper signature. */
    actorId: string;
    how: SignatureHow;
    /** PNG data URL, for a digital signature. */
    signature?: string;
    /** Stored scan (relative to `uploads/`), for a paper signature. */
    scanPath?: string;
}

export interface SignResult { step: ApprovalStep; next: ApprovalStep | null; version: number }

export interface TellInput {
    actorId: string | null;
    text: string;
    phase: 'REVIEWED' | 'SIGNED' | 'RETURNED' | 'REMINDED' | 'INSTALLED' | 'FULFILLED' | 'CONFIRMED' | 'COMPLETED' | 'ISSUE_REPORTED';
    target?: TicketStatus;
    /** Only with target IN_PROGRESS: take a RESOLVED ticket back (the requester reported an issue). */
    reopenResolved?: boolean;
    reason?: string | null;
}

/**
 * Moves a request along its approval route: where it waits next, what a signature changes, and what the ticket's chat
 * says. Used by IT's review, the approver's decision and the paper-signature import alike.
 */
@Injectable()
export class RequestFlowStepper {
    constructor(
        private readonly hardware: HardwareRequestCommandService,
        private readonly documents: RequestDocumentService,
        private readonly linked: TicketLinkedRequestService,
    ) {}

    /**
     * Decides where the request waits after the route (or a signature) changed: for the next unsigned step of the
     * route, or, when none is left, as approved. Returns the step it now waits on (null when approved).
     */
    async advance(manager: EntityManager, ctx: FlowContext, signed: SignedSteps, actorId: string): Promise<ApprovalStep | null> {
        const route = ctx.flow.route!;
        const next = activeStep(route, signed);
        if (next) await this.waitFor(manager, ctx, next);
        else await this.approveAll(manager, ctx, actorId);
        return next;
    }

    /** Records the signature of the active step, adds its revision and advances. */
    async sign(manager: EntityManager, ctx: FlowContext, input: SignInput): Promise<SignResult> {
        const step = ctx.step!;
        await this.saveSignature(manager, ctx, step, input);
        const label = input.how === 'paper'
            ? `Impor scan TTD basah — ${STEP_LABEL[step]} (${input.signer.name})`
            : `TTD ${STEP_LABEL[step]} (digital) — ${input.signer.name}`;
        const version = await this.documents.bump(ctx.flow.id, input.how === 'paper' ? 'IMP' : 'DIG', label, input.actorId, manager);
        if (input.scanPath) await this.documents.attachScan(ctx.flow.id, version, input.scanPath, manager);
        const signed = { ...ctx.signed, [step === 'MANAGER' ? 'manager' : 'gm']: true };
        const next = await this.advance(manager, ctx, signed, input.actorId);
        return { step, next, version };
    }

    /**
     * Where the ticket goes once a step is done: held (WAITING_VENDOR) while an approver is awaited and, for hardware
     * that has to be bought, through procurement and delivery; otherwise IT carries on (IN_PROGRESS).
     */
    holdTarget(ctx: FlowContext, next: ApprovalStep | null): TicketStatus {
        const buying = Boolean(ctx.hardware) && ctx.flow.hardwareSource !== 'IT_STOCK';
        return next || buying ? TicketStatus.WAITING_VENDOR : TicketStatus.IN_PROGRESS;
    }

    /** The structured twin of a system message: who did it and which request card it belongs to. */
    eventOf(ctx: FlowContext, actor: { userId: string; fullName: string } | null, phase: TellInput['phase'], reason?: string | null): TicketSystemEvent {
        const base = { v: 1 as const, actor: actor ? { id: actor.userId, name: actor.fullName } : null, changes: [], ...(reason ? { reason } : {}) };
        return ctx.hardware
            ? { ...base, hardwareRequest: { id: ctx.hardware.id, number: ctx.hardware.requestNumber, phase: phase as HardwareTicketPhase } }
            : { ...base, eformRequest: { id: ctx.eform!.id, code: eformCode(ctx.eform!.id), formType: ctx.eform!.formType, phase: phase as EFormTicketPhase } };
    }

    /** One system message on the ticket, with the structured event the chat renders as a card. */
    async tell(ctx: FlowContext, input: TellInput): Promise<void> {
        const eventBase = input.reason ? { reason: input.reason } : {};
        await this.linked.record({
            ticketId: ctx.ticket.id,
            actorId: input.actorId,
            target: input.target,
            ...(input.reopenResolved ? { reopenResolved: true as const } : {}),
            text: input.text,
            event: ctx.hardware
                ? { ...eventBase, hardwareRequest: { id: ctx.hardware.id, number: ctx.hardware.requestNumber, phase: input.phase as HardwareTicketPhase } }
                : { ...eventBase, eformRequest: { id: ctx.eform!.id, code: eformCode(ctx.eform!.id), formType: ctx.eform!.formType, phase: input.phase as EFormTicketPhase } },
        });
    }

    private async saveSignature(manager: EntityManager, ctx: FlowContext, step: ApprovalStep, input: SignInput): Promise<void> {
        const { signer, how, signature } = input;
        if (ctx.hardware) {
            await manager.save(HardwareRequestActivity, manager.create(HardwareRequestActivity, {
                requestId: ctx.hardware.id,
                actorId: signer.id,
                action: ActivityAction.UPDATED,
                fromStatus: RequestStatus.UNDER_REVIEW,
                toStatus: RequestStatus.UNDER_REVIEW,
                metadata: stepSignatureMetadata(step, signer.id, signer.name, how, signature),
            }));
            return;
        }
        const eformId = ctx.eform!.id;
        await manager.save(EFormSignature, manager.create(EFormSignature, {
            eformRequestId: eformId, signerId: signer.id, signerName: signer.name, signatureData: signature ?? '', signerRole: step,
        }));
        await manager.update(EFormApproval, { eformRequestId: eformId, role: step, action: PENDING }, {
            action: 'APPROVED', actionAt: new Date(), ...(how === 'paper' ? { notes: PAPER_NOTE } : {}),
        });
        if (step === 'GM') await manager.update(EFormRequest, { id: eformId }, { gmApprovedAt: new Date() });
    }

    /** Hardware just stays UNDER_REVIEW; an e-form is handed to the step's approver with one pending approval row. */
    private async waitFor(manager: EntityManager, ctx: FlowContext, step: ApprovalStep): Promise<void> {
        if (!ctx.eform) return;
        const { flow } = ctx;
        const approverId = step === 'MANAGER' ? flow.managerId! : flow.gmId!;
        await manager.update(EFormRequest, { id: ctx.eform.id }, {
            status: EFORM_STATUS_OF_STEP[step],
            currentApproverId: approverId,
            requiresGm: flow.route === 'MANAGER_GM',
            gmApproverId: flow.route === 'MANAGER_GM' ? flow.gmId : null,
        });
        await manager.delete(EFormApproval, { eformRequestId: ctx.eform.id, action: PENDING });
        await manager.save(EFormApproval, manager.create(EFormApproval, {
            eformRequestId: ctx.eform.id, approverId, role: step, action: PENDING, sequence: STEP_SEQUENCE[step],
        }));
    }

    /** Nothing is left to sign: hardware is approved (and starts procurement or installation), e-form goes to IT. */
    private async approveAll(manager: EntityManager, ctx: FlowContext, actorId: string): Promise<void> {
        if (ctx.hardware) {
            await this.hardware.approveAndStartWith(manager, actorId, ctx.hardware.id, { fromStock: ctx.flow.hardwareSource === 'IT_STOCK' });
            return;
        }
        await manager.delete(EFormApproval, { eformRequestId: ctx.eform!.id, action: PENDING });
        await manager.update(EFormRequest, { id: ctx.eform!.id }, {
            status: EFormStatus.PENDING_ICT,
            currentApproverId: null,
            requiresGm: ctx.flow.route === 'MANAGER_GM',
            gmApproverId: ctx.flow.route === 'MANAGER_GM' ? ctx.flow.gmId : null,
        });
    }
}
