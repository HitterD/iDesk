import { EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import type { ApprovalRoute } from './approval-route';
import type { HardwareSource, RequestKind } from './request-kind';

export type ApprovalStep = 'MANAGER' | 'GM';

/** `review`: IT picks the route; `approval`: the manager/GM sign; `other`: not decided here (approved, running, over). */
export type FlowPhase = 'review' | 'approval' | 'other';

export const ROUTE_LABEL: Record<ApprovalRoute, string> = {
    NONE: 'Tanpa persetujuan',
    MANAGER: 'Atasan saja',
    MANAGER_GM: 'Atasan + GM',
};

export const SOURCE_LABEL: Record<HardwareSource, string> = {
    ANNUAL_BUDGET: 'Budget Tahunan',
    NON_BUDGET: 'Non-Budget',
    IT_STOCK: 'Stok IT',
};

const STEPS: Record<ApprovalRoute, ApprovalStep[]> = { NONE: [], MANAGER: ['MANAGER'], MANAGER_GM: ['MANAGER', 'GM'] };

/** The first step of the route nobody has signed yet; null when none is left. */
export function activeStep(route: ApprovalRoute, signed: { manager: boolean; gm: boolean }): ApprovalStep | null {
    return STEPS[route].find((step) => !(step === 'MANAGER' ? signed.manager : signed.gm)) ?? null;
}

/**
 * Where a request stands. A hardware request returned to IT stays UNDER_REVIEW (its state machine has no way back), so
 * `returnedReason` marks it as back in review until IT sets the route again.
 */
export function approvalPhaseOf(kind: RequestKind, status: string, route: ApprovalRoute | null, returnedReason: string | null): FlowPhase {
    if (kind === 'EFORM') {
        if (status === EFormStatus.PENDING_REVIEW) return 'review';
        return status === EFormStatus.PENDING_MANAGER || status === EFormStatus.PENDING_GM ? 'approval' : 'other';
    }
    if (status === RequestStatus.SUBMITTED) return 'review';
    if (status !== RequestStatus.UNDER_REVIEW) return 'other';
    return route && !returnedReason ? 'approval' : 'review';
}

export const STEP_LABEL: Record<ApprovalStep, string> = { MANAGER: 'Atasan', GM: 'GM' };

/** How a signature on the document was given. */
export type SignatureHow = 'digital' | 'paper';
