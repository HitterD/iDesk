import type { EntityManager } from 'typeorm';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { UserRole } from '../../users/enums/user-role.enum';
import type { ApprovalRoute } from '../domain/approval-route';
import { PHASE_LABEL, isSlaPausedPhase, phaseOf, phaseSinceOf, type FlowPhase, type PhaseTimestamps } from '../domain/flow-phase';
import type { RequestKind } from '../domain/request-kind';

/** What a ticket list row needs to show the type tag, the phase chip and the "your turn" marker. */
export interface FlowListFields {
    requestKind: RequestKind | null;
    flowPhase: FlowPhase | null;
    flowPhaseLabel: string | null;
    flowPhaseSince: string | null;
    installScheduledAt: string | null;
    flowPaused: boolean;
    needsMyAction: boolean;
}

export interface FlowListRow {
    ticketId: string;
    kind: RequestKind;
    status: string;
    route: ApprovalRoute | null;
    returnedReason: string | null;
    managerId: string | null;
    gmId: string | null;
    requesterId: string;
    signed: { manager: boolean; gm: boolean };
    hasOpenSchedule: boolean;
    installScheduledAt?: Date | string | null;
    phaseTimestamps?: PhaseTimestamps;
}

export interface ListViewer { userId: string; role: UserRole | string }

const NO_FLOW: FlowListFields = {
    requestKind: null, flowPhase: null, flowPhaseLabel: null,
    flowPhaseSince: null, installScheduledAt: null, flowPaused: false, needsMyAction: false,
};
/** Phases where the next move is IT's. */
const IT_PHASES: readonly FlowPhase[] = ['review', 'procure', 'delivery', 'schedule', 'install', 'fulfill'];

function needsAction(row: FlowListRow, phase: FlowPhase, viewer: ListViewer): boolean {
    if (phase === 'appr_mgr') return viewer.userId === row.managerId;
    if (phase === 'appr_gm') return viewer.userId === row.gmId;
    if (phase === 'confirm') return viewer.userId === row.requesterId;
    return IT_PHASES.includes(phase) && REQUEST_PROCESSOR_ROLES.includes(viewer.role as UserRole);
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function listFieldsOf(row: FlowListRow, viewer: ListViewer): FlowListFields {
    const flowPhase = phaseOf(row.kind, row.status, {
        hasOpenSchedule: row.hasOpenSchedule, route: row.route, signed: row.signed, returnedReason: row.returnedReason,
    });
    return {
        requestKind: row.kind,
        flowPhase,
        flowPhaseLabel: PHASE_LABEL[flowPhase],
        flowPhaseSince: row.phaseTimestamps ? phaseSinceOf(flowPhase, row.phaseTimestamps) : null,
        installScheduledAt: toIsoOrNull(row.installScheduledAt),
        flowPaused: isSlaPausedPhase(flowPhase),
        needsMyAction: needsAction(row, flowPhase, viewer),
    };
}

/** One query for the whole page, and none when the page has no request ticket. */
const FLOW_LIST_SQL = `
    SELECT f."ticketId", f."kind", f."route", f."returnedReason", f."managerId", f."gmId",
        f."reviewedAt" AS "flowReviewedAt", f."createdAt" AS "flowCreatedAt", f."updatedAt" AS "flowUpdatedAt",
        COALESCE(h."status"::text, e."status"::text) AS "status",
        COALESCE(h."requesterId"::text, e."requesterId"::text) AS "requesterId",
        h."submittedAt" AS "hwSubmittedAt", h."approvedAt" AS "hwApprovedAt", h."procuredAt" AS "hwProcuredAt",
        h.install_marked_done_at AS "hwInstallDoneAt", h."completedAt" AS "hwCompletedAt", h."updatedAt" AS "hwUpdatedAt",
        e."submittedAt" AS "efSubmittedAt", e."gmApprovedAt" AS "efGmApprovedAt", e."resolvedAt" AS "efResolvedAt", e."updatedAt" AS "efUpdatedAt",
        (SELECT MAX(a."createdAt") FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'MANAGER') AS "hwMgrApprovedAt",
        (SELECT MAX(p."actionAt") FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'MANAGER' AND p."action" = 'APPROVED') AS "efMgrApprovedAt",
        (SELECT s."scheduledStart" FROM installation_schedules s WHERE s."requestId" = h."id" AND s."status"::text IN ('CONFIRMED', 'IN_PROGRESS', 'DONE') ORDER BY s."createdAt" DESC LIMIT 1) AS "installScheduledAt",
        (SELECT s."startedAt" FROM installation_schedules s WHERE s."requestId" = h."id" AND s."status"::text IN ('IN_PROGRESS', 'DONE') ORDER BY s."createdAt" DESC LIMIT 1) AS "installStartedAt",
        CASE WHEN f."kind" = 'HARDWARE'
            THEN EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'MANAGER')
            ELSE EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'MANAGER' AND p."action" = 'APPROVED') END AS "managerSigned",
        CASE WHEN f."kind" = 'HARDWARE'
            THEN EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'GM')
            ELSE (e."gmApprovedAt" IS NOT NULL OR EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'GM' AND p."action" = 'APPROVED')) END AS "gmSigned",
        EXISTS (SELECT 1 FROM installation_schedules s WHERE s."requestId" = h."id" AND s."status"::text IN ('CONFIRMED', 'IN_PROGRESS', 'DONE')) AS "hasOpenSchedule"
    FROM request_flows f
    LEFT JOIN hardware_requests h ON h."id" = f."hardwareRequestId"
    LEFT JOIN eform_requests e ON e."id" = f."eformRequestId"
    WHERE f."ticketId" = ANY($1::uuid[])`;

type RawFlowListRow = Omit<FlowListRow, 'signed' | 'phaseTimestamps'> & {
    managerSigned: boolean;
    gmSigned: boolean;
    flowReviewedAt?: Date | string | null;
    flowCreatedAt?: Date | string | null;
    flowUpdatedAt?: Date | string | null;
    hwSubmittedAt?: Date | string | null;
    hwApprovedAt?: Date | string | null;
    hwProcuredAt?: Date | string | null;
    hwInstallDoneAt?: Date | string | null;
    hwCompletedAt?: Date | string | null;
    hwUpdatedAt?: Date | string | null;
    efSubmittedAt?: Date | string | null;
    efGmApprovedAt?: Date | string | null;
    efResolvedAt?: Date | string | null;
    efUpdatedAt?: Date | string | null;
    hwMgrApprovedAt?: Date | string | null;
    efMgrApprovedAt?: Date | string | null;
    installStartedAt?: Date | string | null;
};

export async function loadFlowListFields(
    manager: Pick<EntityManager, 'query'>, tickets: { id: string; ticketType?: string | null; createdAt?: Date | string | null }[], viewer: ListViewer,
): Promise<Map<string, FlowListFields>> {
    const result = new Map<string, FlowListFields>(tickets.map((t) => [t.id, NO_FLOW]));
    const ticketCreatedMap = new Map(tickets.map((t) => [t.id, t.createdAt ?? null]));
    const ids = tickets.map((t) => t.id);
    if (ids.length === 0) return result;
    const rows: RawFlowListRow[] = await manager.query(FLOW_LIST_SQL, [ids]);
    for (const r of rows) {
        const phaseTimestamps: PhaseTimestamps = {
            ticketCreatedAt: ticketCreatedMap.get(r.ticketId) ?? null,
            flowCreatedAt: r.flowCreatedAt ?? null,
            reviewedAt: r.flowReviewedAt ?? null,
            submittedAt: r.hwSubmittedAt ?? r.efSubmittedAt ?? null,
            managerApprovedAt: r.hwMgrApprovedAt ?? r.efMgrApprovedAt ?? null,
            approvedAt: r.hwApprovedAt ?? null,
            procuredAt: r.hwProcuredAt ?? null,
            gmApprovedAt: r.efGmApprovedAt ?? null,
            installMarkedDoneAt: r.hwInstallDoneAt ?? null,
            installStartedAt: r.installStartedAt ?? null,
            completedAt: r.hwCompletedAt ?? null,
            resolvedAt: r.efResolvedAt ?? null,
            updatedAt: r.hwUpdatedAt ?? r.efUpdatedAt ?? r.flowUpdatedAt ?? null,
        };
        result.set(r.ticketId, listFieldsOf({
            ticketId: r.ticketId, kind: r.kind, status: r.status, route: r.route, returnedReason: r.returnedReason,
            managerId: r.managerId, gmId: r.gmId, requesterId: r.requesterId,
            signed: { manager: r.managerSigned, gm: r.gmSigned },
            hasOpenSchedule: r.hasOpenSchedule,
            installScheduledAt: r.installScheduledAt ?? null,
            phaseTimestamps,
        }, viewer));
    }
    return result;
}
