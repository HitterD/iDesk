import { EntityManager } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';

/**
 * Shared daily ticket-number generator.
 *
 * The number is per-day and monotonically increasing: `DDMMYY-DIV-0001`.
 * It MUST be called inside a transaction, and it takes a `pessimistic_write`
 * lock on the newest of today's ticket rows so concurrently-created tickets
 * (web or Telegram) serialize on the same lock and never reuse a number.
 * Previously the Telegram path used `COUNT()+1` with no lock, which raced the
 * web path (which already used this lock): two concurrent creations both read
 * the same count, and the loser hit the unique `ticketNumber` constraint with
 * a failed insert — a lost ticket for the Telegram user (PROD-19).
 */

export const TICKET_NUMBER_WIDTH = 4;

/** `DDMMYY` segment of a ticket number. */
export function dateSegment(now: Date): string {
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
}

/** Last daily sequence parsed from a ticket number (`DDMMYY-DIV-0001` → 1), or 0. */
export function lastDailySequence(ticketNumber: string | null | undefined): number {
    if (!ticketNumber) return 0;
    const parts = ticketNumber.split('-');
    if (parts.length !== 3) return 0;
    const last = parseInt(parts[2], 10);
    return Number.isNaN(last) ? 0 : last;
}

/** Builds a full ticket number from its parts. */
export function formatTicketNumber(dateStr: string, division: string, sequence: number): string {
    return `${dateStr}-${division}-${sequence.toString().padStart(TICKET_NUMBER_WIDTH, '0')}`;
}

/**
 * Returns the next ticket number for today in a race-safe fashion.
 *
 * `division` is the 3-letter department code (callers already compute their
 * own default — e.g. 'GEN' for the web path, 'TLG' for Telegram).
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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const latestTicket: Ticket | null = await manager
        .createQueryBuilder(Ticket, 'ticket')
        .where('ticket.createdAt >= :todayStart', { todayStart })
        .orderBy('ticket.createdAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

    const next = lastDailySequence(latestTicket?.ticketNumber) + 1;
    return formatTicketNumber(dateStr, division, next);
}
