import type { TicketSystemEvent } from './ActivityEvent';

type Change = TicketSystemEvent['changes'][number];

const SYSTEM_PREFIX = /^System:\s*/i;
const REASON_SUFFIX = /\.\s*Alasan:\s*([\s\S]+)$/i;
const BULK = /^Bulk update by (.+?) - ([\s\S]+)$/i;
const CANCELLED = /^Ticket cancelled by (.+?)(?::\s*([\s\S]+))?$/i;
const ACTOR_SEPARATOR = ' by ';
/** Splits "A, B" between changes only, never inside a name such as "Beny Saputra, S.Kom". */
const CHANGE_SEPARATOR = /,\s*(?=(?:Status|Priority|Category|Ticket |Assigned to|SLA )\b)/;
const UNASSIGNED_NAMES = new Set(['none', 'unassigned']);

const STATUS = /^Status(?: changed from |:\s*)([A-Z_]+)(?: to |\s*→\s*)([A-Z_]+)$/i;
const PRIORITY = /^Priority(?: changed from |:\s*)([A-Z_]+)(?: to |\s*→\s*)([A-Z_]+)$/i;
const CATEGORY = /^Category(?: changed from |:\s*)(.+?)(?: to |\s*→\s*)(.+)$/i;
const ASSIGNED = /^Ticket (?:re)?assigned to (.+?)(?:\s*\(was (.+?)\))?(?:\s*\(Alasan: ([\s\S]+)\))?$/i;
const BULK_ASSIGNED = /^Assigned to:\s*(.+?)(?:\s*\(Alasan: ([\s\S]+)\))?$/i;
const UNASSIGNED = /^Ticket unassigned \(was (.+?)\)$/i;
/** SLA bookkeeping that older messages appended to the changes; the activity card does not show it. */
const SLA_NOTE = /^SLA /i;

const person = (name: string | undefined): string | null =>
    name && !UNASSIGNED_NAMES.has(name.trim().toLowerCase()) ? name.trim() : null;

interface ParsedPart { change?: Change; reason?: string }

function parsePart(part: string): ParsedPart | null {
    let m = part.match(STATUS);
    if (m) return { change: { field: 'status', from: m[1].toUpperCase(), to: m[2].toUpperCase() } };
    m = part.match(PRIORITY);
    if (m) return { change: { field: 'priority', from: m[1].toUpperCase(), to: m[2].toUpperCase() } };
    m = part.match(CATEGORY);
    if (m) return { change: { field: 'category', from: m[1].trim(), to: m[2].trim() } };
    m = part.match(ASSIGNED);
    if (m) return { change: { field: 'assignee', from: person(m[2]), to: m[1].trim() }, reason: m[3]?.trim() };
    m = part.match(BULK_ASSIGNED);
    if (m) return { change: { field: 'assignee', from: null, to: m[1].trim() }, reason: m[2]?.trim() };
    m = part.match(UNASSIGNED);
    if (m) return { change: { field: 'assignee', from: m[1].trim(), to: null } };
    if (SLA_NOTE.test(part)) return {};
    return null;
}

const event = (actor: string | null, changes: Change[], reason?: string | null): TicketSystemEvent => ({
    v: 1,
    actor: actor ? { id: '', name: actor } : null,
    changes,
    ...(reason ? { reason } : {}),
});

/**
 * Activity written before system messages carried a structured `systemEvent` was a single English sentence
 * ("System: Status changed from TODO to IN_PROGRESS, Ticket reassigned to B (was A) by C. Alasan: ...").
 * Rebuilds the same structure from that sentence so old and new history look alike. Returns null for any
 * message it does not fully understand, which then keeps its previous rendering.
 */
export function legacyActivityEvent(content: string): TicketSystemEvent | null {
    if (!SYSTEM_PREFIX.test(content)) return null;
    let body = content.replace(SYSTEM_PREFIX, '').trim();

    const cancelled = body.match(CANCELLED);
    if (cancelled) return event(cancelled[1].trim(), [{ field: 'status', from: null, to: 'CANCELLED' }], cancelled[2]?.trim());

    let reason: string | undefined;
    const reasonMatch = body.match(REASON_SUFFIX);
    if (reasonMatch) {
        reason = reasonMatch[1].trim();
        body = body.slice(0, reasonMatch.index).trim();
    }

    let actor: string | null = null;
    const bulk = body.match(BULK);
    if (bulk) {
        actor = bulk[1].trim();
        body = bulk[2].trim();
    } else {
        const at = body.lastIndexOf(ACTOR_SEPARATOR);
        if (at > 0) {
            actor = body.slice(at + ACTOR_SEPARATOR.length).trim();
            body = body.slice(0, at).trim();
        }
    }

    const changes: Change[] = [];
    for (const part of body.split(CHANGE_SEPARATOR).map((p) => p.trim()).filter(Boolean)) {
        const parsed = parsePart(part);
        if (!parsed) return null;
        if (parsed.change) changes.push(parsed.change);
        reason ??= parsed.reason;
    }
    return changes.length > 0 ? event(actor, changes, reason) : null;
}
