import type { Ticket } from '../entities/ticket.entity';

/** Fields the activity log reports, in the order they are shown. */
export type TicketActivityField = 'status' | 'assignee' | 'priority' | 'category' | 'vendorVisit';

export interface TicketActivityChange {
    field: TicketActivityField;
    from: string | null;
    to: string | null;
}

/**
 * Structured twin of a system message's text: who did it, what changed (old -> new) and why. The chat
 * renders this instead of parsing the English sentence in `content`, which stays for email and search.
 */
/** Steps of a hardware request proposed from the ticket, as told in the ticket's chat. */
/** Steps of an e-form access request proposed from a ticket, as the ticket shows them. */
export type EFormTicketPhase =
    | 'PROPOSED' | 'DECLINED' | 'WITHDRAWN' | 'SUBMITTED' | 'MANAGER_APPROVED' | 'GM_APPROVED' | 'GRANTED' | 'REJECTED';

export type HardwareTicketPhase =
    | 'PROPOSED' | 'SUBMITTED' | 'DECLINED' | 'WITHDRAWN' | 'APPROVED' | 'REJECTED' | 'PROCUREMENT_DONE'
    | 'SCHEDULE_PROPOSED' | 'SCHEDULED' | 'INSTALLED' | 'ISSUE_REPORTED' | 'COMPLETED' | 'CANCELLED';

export interface TicketSystemEvent {
    v: 1;
    actor: { id: string; name: string } | null;
    changes: TicketActivityChange[];
    reason?: string | null;
    /** Set on messages about a hardware request linked to this ticket; the chat renders it as a card. */
    hardwareRequest?: { id: string; number: string; phase: HardwareTicketPhase; at?: string | null };
    eformRequest?: { id: string; code: string; formType: string; phase: EFormTicketPhase };
}

export type TicketActivitySnapshot = Record<TicketActivityField, string | null>;

type SnapshotSource = Pick<Ticket, 'status' | 'priority' | 'category' | 'vendorVisitAt'> & {
    assignedTo?: { fullName?: string | null } | null;
};

const FIELDS: TicketActivityField[] = ['status', 'assignee', 'priority', 'category', 'vendorVisit'];

export function snapshotTicket(ticket: SnapshotSource): TicketActivitySnapshot {
    return {
        status: ticket.status ?? null,
        assignee: ticket.assignedTo?.fullName ?? null,
        priority: (ticket.priority as string | undefined) ?? null,
        category: ticket.category ?? null,
        vendorVisit: ticket.vendorVisitAt ? new Date(ticket.vendorVisitAt).toISOString() : null,
    };
}

export function diffActivity(before: TicketActivitySnapshot, after: TicketActivitySnapshot): TicketActivityChange[] {
    return FIELDS
        .filter((field) => before[field] !== after[field])
        .map((field) => ({ field, from: before[field], to: after[field] }));
}

export function systemEvent(
    actor: { id: string; fullName: string } | null, changes: TicketActivityChange[], reason?: string | null,
): TicketSystemEvent {
    return { v: 1, actor: actor ? { id: actor.id, name: actor.fullName } : null, changes, ...(reason ? { reason } : {}) };
}
