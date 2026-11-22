import { EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import type { ApprovalRoute } from './approval-route';
import { activeStep } from './approval-phase';
import type { RequestKind } from './request-kind';
import { Logger } from '@nestjs/common';

/** The stage a request ticket is in, as the ticket page and lists show it (mockups/ticket-unify.js `PHASE_SUB`). */
export type FlowPhase =
    | 'review' | 'appr_mgr' | 'appr_gm' | 'procure' | 'delivery' | 'schedule' | 'install' | 'fulfill' | 'confirm' | 'done' | 'rejected';

export const PHASE_LABEL: Record<FlowPhase, string> = {
    review: 'Review IT',
    appr_mgr: 'Menunggu Atasan',
    appr_gm: 'Menunggu GM',
    procure: 'Pengadaan',
    delivery: 'Menunggu barang tiba',
    schedule: 'Penjadwalan instalasi',
    install: 'Instalasi',
    fulfill: 'Pemenuhan akses',
    confirm: 'Menunggu konfirmasi pemohon',
    done: 'Selesai',
    rejected: 'Ditolak',
};

/** Phases where IT waits on someone else: the ticket's SLA does not run. */
const SLA_PAUSED_PHASES: readonly FlowPhase[] = ['appr_mgr', 'appr_gm', 'procure', 'delivery'];

export const isSlaPausedPhase = (phase: FlowPhase): boolean => SLA_PAUSED_PHASES.includes(phase);

export interface PhaseContext {
    /** A schedule IT and the requester agreed on exists (confirmed or running). */
    hasOpenSchedule: boolean;
    route?: ApprovalRoute | null;
    signed?: { manager: boolean; gm: boolean };
    /** Set while the request is back with IT after an approver returned it. */
    returnedReason?: string | null;
}

/** Enum value Task 7 adds to the e-form statuses; mapped as a string until then. */
const EFORM_AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION';

const HARDWARE_PHASE: Partial<Record<string, FlowPhase>> = {
    [RequestStatus.SUBMITTED]: 'review',
    [RequestStatus.APPROVED]: 'procure',
    [RequestStatus.PROCUREMENT]: 'procure',
    [RequestStatus.AWAITING_DELIVERY]: 'delivery',
    [RequestStatus.AWAITING_USER_CONFIRMATION]: 'confirm',
    [RequestStatus.COMPLETED]: 'done',
    [RequestStatus.CLOSED]: 'done',
    [RequestStatus.REJECTED]: 'rejected',
    [RequestStatus.CANCELLED]: 'rejected',
};

const EFORM_PHASE: Partial<Record<string, FlowPhase>> = {
    [EFormStatus.PENDING_REVIEW]: 'review',
    [EFormStatus.PENDING_MANAGER]: 'appr_mgr',
    [EFormStatus.PENDING_GM]: 'appr_gm',
    [EFormStatus.PENDING_ICT]: 'fulfill',
    [EFORM_AWAITING_CONFIRMATION]: 'confirm',
    [EFormStatus.CONFIRMED]: 'done',
    [EFormStatus.REJECTED]: 'rejected',
    [EFormStatus.CANCELLED]: 'rejected',
};

/** A hardware request under review stays UNDER_REVIEW through IT's review and the approvals; route and signatures tell them apart. */
function underReview(ctx: PhaseContext): FlowPhase {
    if (!ctx.route || ctx.returnedReason) return 'review';
    const step = activeStep(ctx.route, ctx.signed ?? { manager: false, gm: false });
    if (step === 'MANAGER') return 'appr_mgr';
    return step === 'GM' ? 'appr_gm' : 'review';
}

const logger = new Logger('FlowPhase');
const warnedStatuses = new Set<string>();

/** A status the map does not know falls back to `review` (IT looks at it), logged once per kind and status. */
function unknownStatus(kind: RequestKind, status: string): FlowPhase {
    const key = `${kind}:${status}`;
    if (!warnedStatuses.has(key)) {
        warnedStatuses.add(key);
        logger.warn(`Unknown ${kind} status "${status}": showing it as review`);
    }
    return 'review';
}

export function phaseOf(kind: RequestKind, status: string, ctx: PhaseContext): FlowPhase {
    if (kind === 'EFORM') return EFORM_PHASE[status] ?? unknownStatus(kind, status);
    if (status === RequestStatus.UNDER_REVIEW) return underReview(ctx);
    if (status === RequestStatus.INSTALLATION) return ctx.hasOpenSchedule ? 'install' : 'schedule';
    return HARDWARE_PHASE[status] ?? unknownStatus(kind, status);
}
