import { EntityManager } from 'typeorm';

/**
 * Shared daily ticket-number generator.
 *
 * The number is per-day and monotonically increasing: `DDMMYY-DIV-0001`, one sequence shared by every division.
 * It MUST be called inside a transaction: it takes a transaction-scoped advisory lock for the day, so concurrent
 * creations serialize and never reuse a number (PROD-19).
 */

/** Namespace for pg_advisory_xact_lock so ticket numbering never collides with other locks. */
const NUMBERING_LOCK_KEY = 'ticket-number';

export const TICKET_NUMBER_WIDTH = 4;

/** `DDMMYY` segment of a ticket number. */
export function dateSegment(now: Date): string {
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
}

/** Builds a full ticket number from its parts. */
export function formatTicketNumber(dateStr: string, division: string, sequence: number): string {
    return `${dateStr}-${division}-${sequence.toString().padStart(TICKET_NUMBER_WIDTH, '0')}`;
}

/**
 * Returns the next ticket number for today in a race-safe fashion.
 *
 * `division` is the 3-letter department code (callers already compute their
 * own default — e.g. 'GEN' for the web path).
 *
 * @param manager the transaction's EntityManager (the lock is transaction-scoped!)
 * @param division 3-letter department code
 * @param now optional clock override (tests/determinism); defaults to `new Date()`
 */
export async function generateNextTicketNumber(
    manager: EntityManager,
    division: string,
    now: Date = new Date(),
): Promise<string> {
    const dateStr = dateSegment(now);
    // An advisory lock, not FOR UPDATE on the newest row: that row lock neither covers the first ticket of the day
    // (no row to lock) nor lets a waiter see the row its predecessor inserted, so both read the same "latest".
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${NUMBERING_LOCK_KEY}:${dateStr}`]);
    // Raw SQL on purpose: the unique constraint still holds soft-deleted tickets, but the entity query hid them, so
    // deleting today's newest ticket made every later creation reuse its number ("already exists") until midnight.
    // MAX over the number itself, not the newest createdAt, so any row of today counts regardless of insert order.
    const rows: { maxSeq: string | null }[] = await manager.query(
        `SELECT MAX(CAST(SUBSTRING("ticketNumber" FROM '[0-9]+$') AS INTEGER)) AS "maxSeq"
           FROM tickets
          WHERE "ticketNumber" LIKE $1 AND "ticketNumber" ~ '^[0-9]{6}-[A-Za-z0-9]+-[0-9]+$'`,
        [`${dateStr}-%`],
    );
    return formatTicketNumber(dateStr, division, Number(rows[0]?.maxSeq ?? 0) + 1);
}
