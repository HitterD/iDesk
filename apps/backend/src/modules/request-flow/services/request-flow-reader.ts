import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EFormApproval } from '../../eform-request/entities/eform-approval.entity';
import { EFormRequest } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { activeStep, approvalPhaseOf, type ApprovalStep, type FlowPhase } from '../domain/approval-phase';
import { signedSlots } from '../domain/hardware-signatures';
import type { RequestKind } from '../domain/request-kind';
import { RequestFlow } from '../entities/request-flow.entity';

export interface SignedSteps { manager: boolean; gm: boolean }

/** A request flow with everything the review and approval steps decide from. */
export interface FlowContext {
    flow: RequestFlow;
    ticket: Ticket;
    kind: RequestKind;
    requesterId: string;
    requesterName: string;
    /** Hardware request number, or the e-form's document number. */
    number: string;
    hardware: HardwareRequest | null;
    eform: EFormRequest | null;
    signed: SignedSteps;
    phase: FlowPhase;
    /** The approval step waiting for a signature under the current route, if any. */
    step: ApprovalStep | null;
    /** Who must sign that step. */
    approverId: string | null;
}

const MANAGER_ROLE = 'MANAGER';
const GM_ROLE = 'GM';
const APPROVED = 'APPROVED';

/** Loads a request ticket's flow, its hardware or e-form request, and where the approval stands. */
@Injectable()
export class RequestFlowReader {
    constructor(private readonly dataSource: DataSource) {}

    /** `lock` row-locks the flow for the rest of the caller's transaction so two decisions cannot both pass. */
    async load(ticketId: string, manager: EntityManager = this.dataSource.manager, lock = false): Promise<FlowContext> {
        const flow = await manager.findOne(RequestFlow, { where: { ticketId }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
        const ticket = flow ? await manager.findOne(Ticket, { where: { id: ticketId } }) : null;
        if (!flow || !ticket) throw new NotFoundException('Permintaan tidak ditemukan');
        return flow.kind === 'HARDWARE' ? this.forHardware(manager, flow, ticket) : this.forEform(manager, flow, ticket);
    }

    private async forHardware(manager: EntityManager, flow: RequestFlow, ticket: Ticket): Promise<FlowContext> {
        const hardware = flow.hardwareRequestId
            ? await manager.findOne(HardwareRequest, { where: { id: flow.hardwareRequestId }, relations: { items: true, requester: true } })
            : null;
        if (!hardware) throw new NotFoundException('Permintaan hardware tidak ditemukan');
        const activities = await manager.find(HardwareRequestActivity, { where: { requestId: hardware.id }, order: { createdAt: 'ASC' } });
        const slots = signedSlots(activities, '');
        return this.build(flow, ticket, {
            requesterId: hardware.requesterId,
            requesterName: hardware.requester?.fullName ?? '',
            number: hardware.requestNumber,
            status: hardware.status,
            signed: { manager: Boolean(slots.MANAGER), gm: Boolean(slots.GM) },
            hardware,
            eform: null,
        });
    }

    private async forEform(manager: EntityManager, flow: RequestFlow, ticket: Ticket): Promise<FlowContext> {
        const eform = flow.eformRequestId ? await manager.findOne(EFormRequest, { where: { id: flow.eformRequestId } }) : null;
        if (!eform) throw new NotFoundException('Pengajuan akses tidak ditemukan');
        const approvals = await manager.find(EFormApproval, { where: { eformRequestId: eform.id } });
        const signedBy = (role: string) => approvals.some((a) => a.role === role && a.action === APPROVED);
        return this.build(flow, ticket, {
            requesterId: eform.requesterId,
            requesterName: eform.requesterName,
            number: eform.documentNumber ?? '',
            status: eform.status,
            signed: { manager: signedBy(MANAGER_ROLE), gm: signedBy(GM_ROLE) || Boolean(eform.gmApprovedAt) },
            hardware: null,
            eform,
        });
    }

    private build(
        flow: RequestFlow, ticket: Ticket,
        parts: Pick<FlowContext, 'requesterId' | 'requesterName' | 'number' | 'signed' | 'hardware' | 'eform'> & { status: string },
    ): FlowContext {
        const { status, ...rest } = parts;
        const phase = approvalPhaseOf(flow.kind, status, flow.route, flow.returnedReason);
        const step = phase === 'approval' && flow.route ? activeStep(flow.route, rest.signed) : null;
        const approverId = step === 'MANAGER' ? flow.managerId : step === 'GM' ? flow.gmId : null;
        return { flow, ticket, kind: flow.kind, ...rest, phase, step, approverId };
    }
}
