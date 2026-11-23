import type { EntityManager } from 'typeorm';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { UserRole } from '../../users/enums/user-role.enum';
import type { ApprovalRoute } from '../domain/approval-route';
import { PHASE_LABEL, isSlaPausedPhase, phaseOf, type FlowPhase } from '../domain/flow-phase';
import type { RequestKind } from '../domain/request-kind';

/** What a ticket list row needs to show the type tag, the phase chip and the "your turn" marker. */
export interface FlowListFields {
    requestKind: RequestKind | null;
    flowPhase: FlowPhase | null;
    flowPhaseLabel: string | null;
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
}

export interface ListViewer { userId: string; role: UserRole | string }

const NO_FLOW: FlowListFields = { requestKind: null, flowPhase: null, flowPhaseLabel: null, flowPaused: false, needsMyAction: false };
/** Phases where the next move is IT's. */
const IT_PHASES: readonly FlowPhase[] = ['review', 'procure', 'delivery', 'schedule', 'install', 'fulfill'];

function needsAction(row: FlowListRow, phase: FlowPhase, viewer: ListViewer): boolean {
    if (phase === 'appr_mgr') return viewer.userId === row.managerId;
    if (phase === 'appr_gm') return viewer.userId === row.gmId;
    if (phase === 'confirm') return viewer.userId === row.requesterId;
    return IT_PHASES.includes(phase) && REQUEST_PROCESSOR_ROLES.includes(viewer.role as UserRole);
}

export function listFieldsOf(row: FlowListRow, viewer: ListViewer): FlowListFields {
    const flowPhase = phaseOf(row.kind, row.status, {
        hasOpenSchedule: row.hasOpenSchedule, route: row.route, signed: row.signed, returnedReason: row.returnedReason,
    });
    return {
        requestKind: row.kind, flowPhase, flowPhaseLabel: PHASE_LABEL[flowPhase],
        flowPaused: isSlaPausedPhase(flowPhase), needsMyAction: needsAction(row, flowPhase, viewer),
    };
}

/** One query for the whole page, and none when the page has no request ticket. */
const FLOW_LIST_SQL = `
    SELECT f."ticketId", f."kind", f."route", f."returnedReason", f."managerId", f."gmId",
        COALESCE(h."status"::text, e."status"::text) AS "status",
        COALESCE(h."requesterId"::text, e."requesterId"::text) AS "requesterId",
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

export async function loadFlowListFields(
    manager: Pick<EntityManager, 'query'>, tickets: { id: string; ticketType?: string | null }[], viewer: ListViewer,
): Promise<Map<string, FlowListFields>> {
    const result = new Map<string, FlowListFields>(tickets.map((t) => [t.id, NO_FLOW]));
    const ids = tickets.map((t) => t.id);
    if (ids.length === 0) return result;
    const rows: (Omit<FlowListRow, 'signed'> & { managerSigned: boolean; gmSigned: boolean })[] = await manager.query(FLOW_LIST_SQL, [ids]);
    for (const { managerSigned, gmSigned, ...rest } of rows) {
        result.set(rest.ticketId, listFieldsOf({ ...rest, signed: { manager: managerSigned, gm: gmSigned } }, viewer));
    }
    return result;
}
