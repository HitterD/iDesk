import type { EntityManager } from 'typeorm';
import { Ticket, TicketType } from '../entities/ticket.entity';

/** Ticket types that never use SLA metrics or deadlines. */
export const NON_SLA_TICKET_TYPES: readonly TicketType[] = [
    TicketType.HARDWARE_REQUEST,
    TicketType.EFORM_REQUEST,
];

type NonSlaShape = Pick<Partial<Ticket>, 'ticketType'> & {
    requestKind?: unknown;
    isNonSla?: boolean;
};

/** Synchronous predicate from ticketType or already-loaded flow metadata. */
export function isNonSlaTicketType(ticket?: NonSlaShape | null): boolean {
    if (!ticket) return false;
    if (ticket.isNonSla === true || ticket.requestKind != null) return true;
    return Boolean(ticket.ticketType && NON_SLA_TICKET_TYPES.includes(ticket.ticketType));
}

/** SQL predicate identifying tickets excluded from SLA (by ticketType or request_flows row). */
export function nonSlaTicketSql(alias = 'ticket'): string {
    return `((${alias}."ticketType" IS NOT NULL AND ${alias}."ticketType" IN ('HARDWARE_REQUEST', 'EFORM_REQUEST')) OR EXISTS (SELECT 1 FROM request_flows rf WHERE rf."ticketId" = ${alias}.id))`;
}

/** Inverse SQL predicate identifying SLA-eligible tickets. */
export function isSlaTicketSql(alias = 'ticket'): string {
    return `(NOT EXISTS (SELECT 1 FROM request_flows rf WHERE rf."ticketId" = ${alias}.id) AND (${alias}."ticketType" IS NULL OR ${alias}."ticketType" NOT IN ('HARDWARE_REQUEST', 'EFORM_REQUEST')))`;
}

/** Returns a shallow copy with all SLA fields cleared. */
export function stripSlaFields<T extends Record<string, any>>(target: T): T {
    return {
        ...target,
        slaTarget: null,
        originalSlaTarget: null,
        slaStartedAt: null,
        firstResponseTarget: null,
        slaRemainingMinutes: null,
        firstResponseRemainingMinutes: null,
        isOverdue: false,
        isFirstResponseBreached: false,
        slaWarningSent: false,
    };
}

/** Clears SLA fields on a Ticket entity in place prior to persisting. */
export function clearTicketSlaColumns(ticket: Partial<Ticket>): void {
    ticket.slaTarget = null;
    ticket.originalSlaTarget = null;
    ticket.slaStartedAt = null;
    ticket.firstResponseTarget = null;
    ticket.slaRemainingMinutes = null;
    ticket.firstResponseRemainingMinutes = null;
    ticket.isOverdue = false;
    ticket.isFirstResponseBreached = false;
    ticket.slaWarningSent = false;
}

/** Authoritative check: ticketType OR a persisted request_flows row (covers legacy SERVICE backfills). */
export async function isNonSlaTicket(
    manager: Pick<EntityManager, 'query'> | null | undefined,
    ticket?: (Pick<Partial<Ticket>, 'id' | 'ticketType'> & { requestKind?: unknown; isNonSla?: boolean }) | null,
): Promise<boolean> {
    if (!ticket) return false;
    if (isNonSlaTicketType(ticket)) return true;
    if (!manager || typeof manager.query !== 'function' || !ticket.id) return false;
    const rows = await manager
        .query(`SELECT 1 FROM request_flows WHERE "ticketId" = $1 LIMIT 1`, [ticket.id])
        .catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
}

/** Batch lookup returning the subset of ticket IDs excluded from SLA. */
export async function findNonSlaTicketIds(
    manager: Pick<EntityManager, 'query'> | null | undefined,
    tickets: ReadonlyArray<Pick<Partial<Ticket>, 'id' | 'ticketType'> & { requestKind?: unknown; isNonSla?: boolean }>,
): Promise<Set<string>> {
    const ids = new Set<string>();
    const toQuery: string[] = [];
    for (const t of tickets) {
        if (!t.id) continue;
        if (isNonSlaTicketType(t)) ids.add(t.id);
        else toQuery.push(t.id);
    }
    if (manager && typeof manager.query === 'function' && toQuery.length > 0) {
        const rows: Array<{ ticketId: string }> = await manager
            .query(`SELECT "ticketId" FROM request_flows WHERE "ticketId" = ANY($1::uuid[])`, [toQuery])
            .catch(() => []);
        for (const row of rows) {
            if (row?.ticketId) ids.add(row.ticketId);
        }
    }
    return ids;
}
