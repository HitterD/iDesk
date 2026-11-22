import { EntityManager } from 'typeorm';
import { EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { EFORM_ACCESS_LABEL, eformCode } from '../../eform-request/ticket-link/eform-ticket.util';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HandlingTeam, TicketStatus } from '../../ticketing/entities/ticket.entity';
import { departmentDivision, generateNextTicketNumber } from '../../ticketing/utils/ticket-number-generator';
import type { ApprovalRoute } from '../domain/approval-route';
import { HardwareSource, RequestKind, ticketTypeOf } from '../domain/request-kind';

/**
 * One-off backfill: every existing hardware / e-form request becomes (or joins) a ticket with a `request_flows` row.
 *
 * Raw SQL with explicit columns on purpose: it runs from a migration, so it must not depend on entity metadata that
 * later migrations change. No events or notifications are sent. Idempotent: requests that already have a flow are left
 * alone. Must run inside a transaction (the ticket-number generator takes a transaction-scoped lock).
 */

export interface BackfillResult { created: number; linked: number; skipped: number }

const DIVISION_FALLBACK = 'GEN';
const FIRST_REVISION = { version: 1, kind: 'GEN', label: 'Dibuat dari data lama' } as const;
const NOT_STARTED: ReadonlyArray<string> = [RequestStatus.DRAFT, RequestStatus.CANCELLED];

/** Justification prefixes the old hardware form wrote for its request type. */
const HARDWARE_SOURCE_PREFIXES: ReadonlyArray<[string, HardwareSource]> = [
    ['[BUDGET TAHUNAN]', 'ANNUAL_BUDGET'],
    ['[NON-BUDGET]', 'NON_BUDGET'],
    ['[PENJADWALAN PEMASANGAN]', 'IT_STOCK'],
];

const HARDWARE_TICKET_STATUS: Partial<Record<RequestStatus, TicketStatus>> = {
    [RequestStatus.COMPLETED]: TicketStatus.CLOSED,
    [RequestStatus.CLOSED]: TicketStatus.CLOSED,
    [RequestStatus.REJECTED]: TicketStatus.CANCELLED,
    [RequestStatus.CANCELLED]: TicketStatus.CANCELLED,
};

const EFORM_TICKET_STATUS: Partial<Record<EFormStatus, TicketStatus>> = {
    [EFormStatus.CONFIRMED]: TicketStatus.CLOSED,
    [EFormStatus.REJECTED]: TicketStatus.CANCELLED,
};

const REQUESTER_JOINS = `
    LEFT JOIN "users" u ON u."id"::text = r."requesterId"::text
    LEFT JOIN "departments" d ON d."id"::text = u."departmentId"
    LEFT JOIN "tickets" t ON t."id" = r."sourceTicketId"`;

/** Every statement the backfill runs, exported so tests can answer them by identity. */
export const BACKFILL_SQL = {
    selectHardware: `SELECT r."id", r."requestNumber", r."requesterId", r."siteId", r."justification", r."status"::text AS "status",
        r."sourceTicketId", r."createdAt", COALESCE(r."completedAt", r."updatedAt") AS "doneAt",
        d."code" AS "deptCode", d."name" AS "deptName", u."siteId" AS "userSiteId", t."id" IS NOT NULL AS "sourceTicketExists"
        FROM "hardware_requests" r${REQUESTER_JOINS}
        ORDER BY r."createdAt" ASC`,
    selectEform: `SELECT r."id", r."formType"::text AS "formType", r."documentNumber", r."requesterId", r."siteId",
        COALESCE(r."formData"->>'alasan', r."networkPurpose") AS "reason", r."requiresGm", r."status"::text AS "status",
        r."sourceTicketId", r."createdAt", COALESCE(r."resolvedAt", r."updatedAt") AS "doneAt",
        d."code" AS "deptCode", d."name" AS "deptName", u."siteId" AS "userSiteId", t."id" IS NOT NULL AS "sourceTicketExists"
        FROM "eform_requests" r${REQUESTER_JOINS}
        ORDER BY r."createdAt" ASC`,
    selectFlows: `SELECT "hardwareRequestId", "eformRequestId" FROM "request_flows"`,
    insertTicket: `INSERT INTO "tickets"
        ("ticketNumber", "title", "description", "status", "ticketType", "handlingTeam", "userId", "siteId", "createdAt", "closedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING "id"`,
    linkHardware: `UPDATE "hardware_requests" SET "sourceTicketId" = $1 WHERE "id" = $2`,
    linkEform: `UPDATE "eform_requests" SET "sourceTicketId" = $1 WHERE "id" = $2`,
    insertFlow: `INSERT INTO "request_flows" ("ticketId", "kind", "hardwareRequestId", "eformRequestId", "route", "hardwareSource")
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
    insertRevision: `INSERT INTO "request_document_revisions" ("flowId", "version", "kind", "label") VALUES ($1, $2, $3, $4)`,
} as const;

interface RequesterRow {
    id: string;
    requesterId: string;
    siteId: string | null;
    status: string;
    sourceTicketId: string | null;
    sourceTicketExists: boolean;
    createdAt: Date;
    doneAt: Date | null;
    deptCode: string | null;
    deptName: string | null;
    userSiteId: string | null;
}
interface HardwareRow extends RequesterRow { requestNumber: string; justification: string | null }
interface EformRow extends RequesterRow { formType: EFormType; documentNumber: string | null; reason: string | null; requiresGm: boolean }

/** What a legacy request becomes: its ticket fields and its flow. */
interface Plan {
    kind: RequestKind;
    row: RequesterRow;
    title: string;
    description: string;
    status: TicketStatus;
    route: ApprovalRoute;
    hardwareSource: HardwareSource | null;
}

export function hardwareSourceOf(justification: string | null): HardwareSource | null {
    const text = justification ?? '';
    return HARDWARE_SOURCE_PREFIXES.find(([prefix]) => text.includes(prefix))?.[1] ?? null;
}

function hardwarePlan(row: HardwareRow): Plan {
    const title = `Hardware Request ${row.requestNumber}`;
    return {
        kind: 'HARDWARE', row, title, description: row.justification || title,
        status: HARDWARE_TICKET_STATUS[row.status as RequestStatus] ?? TicketStatus.IN_PROGRESS,
        route: 'MANAGER', hardwareSource: hardwareSourceOf(row.justification),
    };
}

function eformRoute(row: EformRow): ApprovalRoute {
    if (row.requiresGm) return 'MANAGER_GM';
    return row.formType === EFormType.SYNOLOGY_NAS ? 'NONE' : 'MANAGER';
}

function eformPlan(row: EformRow): Plan {
    const label = EFORM_ACCESS_LABEL[row.formType] ?? 'akses';
    const title = `${label.charAt(0).toUpperCase()}${label.slice(1)} — ${row.documentNumber ?? eformCode(row.id)}`;
    return {
        kind: 'EFORM', row, title, description: row.reason || title,
        status: EFORM_TICKET_STATUS[row.status as EFormStatus] ?? TicketStatus.IN_PROGRESS,
        route: eformRoute(row), hardwareSource: null,
    };
}

async function insertFlow(manager: EntityManager, ticketId: string, plan: Plan): Promise<void> {
    const isHardware = plan.kind === 'HARDWARE';
    const [flow]: { id: string }[] = await manager.query(BACKFILL_SQL.insertFlow, [
        ticketId, plan.kind, isHardware ? plan.row.id : null, isHardware ? null : plan.row.id, plan.route, plan.hardwareSource,
    ]);
    await manager.query(BACKFILL_SQL.insertRevision, [flow.id, FIRST_REVISION.version, FIRST_REVISION.kind, FIRST_REVISION.label]);
}

/** Creates the parent ticket for a standalone request; false when it has no site to file it under. */
async function createParent(manager: EntityManager, plan: Plan, now: Date): Promise<boolean> {
    const { row } = plan;
    const siteId = row.siteId ?? row.userSiteId;
    if (!siteId) return false;
    const division = departmentDivision({ code: row.deptCode, name: row.deptName }, DIVISION_FALLBACK);
    const ticketNumber = await generateNextTicketNumber(manager, division, new Date(row.createdAt));
    const closedAt = plan.status === TicketStatus.CLOSED ? row.doneAt ?? now : null;
    const [ticket]: { id: string }[] = await manager.query(BACKFILL_SQL.insertTicket, [
        ticketNumber, plan.title, plan.description, plan.status, ticketTypeOf(plan.kind), HandlingTeam.OPS_SUPPORT,
        row.requesterId, siteId, row.createdAt, closedAt,
    ]);
    await manager.query(plan.kind === 'HARDWARE' ? BACKFILL_SQL.linkHardware : BACKFILL_SQL.linkEform, [ticket.id, row.id]);
    await insertFlow(manager, ticket.id, plan);
    return true;
}

function requestsPerTicket(plans: Plan[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { row } of plans) {
        if (row.sourceTicketId) counts.set(row.sourceTicketId, (counts.get(row.sourceTicketId) ?? 0) + 1);
    }
    return counts;
}

/** `now` only stands in for a missing completion time; ticket numbers follow each request's own createdAt. */
export async function backfillRequestFlows(manager: EntityManager, now: Date = new Date()): Promise<BackfillResult> {
    const hardware: HardwareRow[] = await manager.query(BACKFILL_SQL.selectHardware);
    const eforms: EformRow[] = await manager.query(BACKFILL_SQL.selectEform);
    const flows: { hardwareRequestId: string | null; eformRequestId: string | null }[] = await manager.query(BACKFILL_SQL.selectFlows);
    const hasFlow = new Set(flows.flatMap((f) => [f.hardwareRequestId, f.eformRequestId]).filter(Boolean));

    const plans = [...hardware.map(hardwarePlan), ...eforms.map(eformPlan)];
    // Counted over every request (any status) so a ticket that ever raised several keeps the old cards.
    const perTicket = requestsPerTicket(plans);
    const legacySkipped = new Set<string>();
    const result: BackfillResult = { created: 0, linked: 0, skipped: 0 };

    for (const plan of plans) {
        const { row } = plan;
        if (hasFlow.has(row.id) || NOT_STARTED.includes(row.status)) continue;
        if (!row.sourceTicketId) {
            if (await createParent(manager, plan, now)) result.created += 1;
            else result.skipped += 1;
        } else if (perTicket.get(row.sourceTicketId) === 1 && row.sourceTicketExists) {
            await insertFlow(manager, row.sourceTicketId, plan);
            result.linked += 1;
        } else if (!legacySkipped.has(row.sourceTicketId)) {
            legacySkipped.add(row.sourceTicketId);
            result.skipped += 1;
        }
    }
    return result;
}
