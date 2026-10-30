import { TICKET_ACTIVE_STATUSES, TICKET_DONE_STATUSES, TICKET_INACTIVE_STATUSES, TicketStatus } from '../entities/ticket.entity';

/**
 * Comma-separated, single-quoted status list for raw SQL fragments
 * (e.g. `CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) ...`).
 * Values come from the TicketStatus enum only, never from user input.
 */
const toSqlList = (statuses: readonly TicketStatus[]): string =>
    statuses.map((s) => `'${s}'`).join(', ');

/** Ticket is "done": RESOLVED (awaiting confirmation) or CLOSED. */
export const TICKET_DONE_STATUSES_SQL = toSqlList(TICKET_DONE_STATUSES);

/** Ticket is no longer active: RESOLVED, CLOSED or CANCELLED. */
export const TICKET_INACTIVE_STATUSES_SQL = toSqlList(TICKET_INACTIVE_STATUSES);

/** Ticket still needs work: TODO, IN_PROGRESS or WAITING_VENDOR. */
export const TICKET_ACTIVE_STATUSES_SQL = toSqlList(TICKET_ACTIVE_STATUSES);
