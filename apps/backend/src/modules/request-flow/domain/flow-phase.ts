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
    [EFormStatus.AWAITING_CONFIRMATION]: 'confirm',
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

export interface PhaseTimestamps {
    ticketCreatedAt?: Date | string | null;
    flowCreatedAt?: Date | string | null;
    reviewedAt?: Date | string | null;
    submittedAt?: Date | string | null;
    managerApprovedAt?: Date | string | null;
    approvedAt?: Date | string | null;
    procuredAt?: Date | string | null;
    gmApprovedAt?: Date | string | null;
    installMarkedDoneAt?: Date | string | null;
    installStartedAt?: Date | string | null;
    completedAt?: Date | string | null;
    resolvedAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

function firstIso(...values: Array<Date | string | null | undefined>): string | null {
    for (const v of values) {
        if (!v) continue;
        const d = v instanceof Date ? v : new Date(v);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

/** Timestamp when the request entered its current stage (used for neutral age/wait indicator). */
export function phaseSinceOf(phase: FlowPhase, ts: PhaseTimestamps): string | null {
    switch (phase) {
        case 'review':
            return firstIso(ts.submittedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'appr_mgr':
            return firstIso(ts.reviewedAt, ts.submittedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'appr_gm':
            return firstIso(ts.managerApprovedAt, ts.reviewedAt, ts.submittedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'procure':
            return firstIso(ts.approvedAt, ts.gmApprovedAt, ts.managerApprovedAt, ts.reviewedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'delivery':
            return firstIso(ts.procuredAt, ts.approvedAt, ts.updatedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'schedule':
            return firstIso(ts.procuredAt, ts.approvedAt, ts.updatedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'install':
            return firstIso(ts.installStartedAt, ts.updatedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'fulfill':
            return firstIso(ts.gmApprovedAt, ts.managerApprovedAt, ts.reviewedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'confirm':
            return firstIso(ts.installMarkedDoneAt, ts.resolvedAt, ts.updatedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
        case 'done':
        case 'rejected':
            return firstIso(ts.completedAt, ts.resolvedAt, ts.updatedAt, ts.flowCreatedAt, ts.ticketCreatedAt);
    }
}
