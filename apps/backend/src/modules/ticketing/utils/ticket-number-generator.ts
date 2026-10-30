import { Logger } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { DEPARTMENT_CODE_PATTERN } from '../../users/dto/create-department.dto';

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

const DIVISION_CODE_LENGTH = 3;
const NON_ALPHANUMERIC = /[^A-Z0-9]/g;
/** A department code usable as-is in a ticket number; anything else (HRIS full names, `IT-SPJ`) falls back to the name. */
const CLEAN_DEPARTMENT_CODE = DEPARTMENT_CODE_PATTERN;
const PG_UNIQUE_VIOLATION = '23505';
const TICKET_NUMBER_KEY = '("ticketNumber")';

/** Uppercased, alphanumeric-only division segment, or `fallback` when nothing is left. */
function sanitizeDivision(raw: string | null | undefined, fallback: string): string {
    return (raw ?? '').toUpperCase().replace(NON_ALPHANUMERIC, '') || fallback;
}

/**
 * Division segment derived from a department name: its first 3 characters, uppercased, alphanumeric only.
 * A raw slice of "HC Dept" gave "HC " — the space broke the sequence read below and caused "already exists".
 */
export function divisionCode(departmentName: string | null | undefined, fallback: string): string {
    return sanitizeDivision((departmentName ?? '').substring(0, DIVISION_CODE_LENGTH), fallback);
}

/** Division segment for a department: its `code` when that is clean, else derived from its name. */
export function departmentDivision(
    department: { code?: string | null; name?: string | null } | null | undefined,
    fallback: string,
): string {
    const code = department?.code?.trim().toUpperCase();
    return code && CLEAN_DEPARTMENT_CODE.test(code) ? code : divisionCode(department?.name, fallback);
}

function isTicketNumberCollision(error: unknown): boolean {
    const driverError = (error as { driverError?: { code?: string; detail?: string } })?.driverError;
    return error instanceof QueryFailedError
        && driverError?.code === PG_UNIQUE_VIOLATION
        && (driverError.detail ?? '').includes(TICKET_NUMBER_KEY);
}

/**
 * Runs a ticket-creating transaction, retrying once if its ticket number collided. The generator should make that
 * impossible, so a collision is logged as an error (a numbering bug to fix) while the user is not blocked by it.
 */
export async function withTicketNumberRetry<T>(logger: Logger, create: () => Promise<T>): Promise<T> {
    try {
        return await create();
    } catch (error) {
        if (!isTicketNumberCollision(error)) throw error;
        logger.error(`Ticket number collision, retrying once: ${(error as any).driverError.detail}`);
        return create();
    }
}

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
 * `division` is the department's division segment (see `departmentDivision`; callers pick their own
 * default — e.g. 'GEN' for the web path).
 *
 * @param manager the transaction's EntityManager (the lock is transaction-scoped!)
 * @param division division segment, sanitised to alphanumerics here
 * @param now optional clock override (tests/determinism); defaults to `new Date()`
 */
export async function generateNextTicketNumber(
    manager: EntityManager,
    division: string,
    now: Date = new Date(),
): Promise<string> {
    const dateStr = dateSegment(now);
    // Sanitised here too, so no caller can ever mint a number the sequence read cannot parse back.
    const safeDivision = sanitizeDivision(division, 'GEN');
    // An advisory lock, not FOR UPDATE on the newest row: that row lock neither covers the first ticket of the day
    // (no row to lock) nor lets a waiter see the row its predecessor inserted, so both read the same "latest".
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${NUMBERING_LOCK_KEY}:${dateStr}`]);
    // Raw SQL on purpose: the unique constraint still holds soft-deleted tickets, but the entity query hid them, so
    // deleting today's newest ticket made every later creation reuse its number ("already exists") until midnight.
    // MAX over the number itself, not the newest createdAt, so any row of today counts regardless of insert order.
    // The division part is matched loosely (`.+`) so legacy numbers with odd divisions ("HC ") still count.
    const rows: { maxSeq: string | null }[] = await manager.query(
        `SELECT MAX(CAST(SUBSTRING("ticketNumber" FROM '[0-9]+$') AS INTEGER)) AS "maxSeq"
           FROM tickets
          WHERE "ticketNumber" LIKE $1 AND "ticketNumber" ~ '^[0-9]{6}-.+-[0-9]+$'`,
        [`${dateStr}-%`],
    );
    return formatTicketNumber(dateStr, safeDivision, Number(rows[0]?.maxSeq ?? 0) + 1);
}
