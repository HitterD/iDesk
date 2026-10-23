/** Same labels the app shows for ticket status and priority. */
const STATUS_LABEL: Record<string, string> = {
    TODO: 'Open', IN_PROGRESS: 'In Progress', WAITING_VENDOR: 'Waiting Vendor',
    RESOLVED: 'Resolved', CLOSED: 'Closed', CANCELLED: 'Dibatalkan',
};
export const PRIORITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Normal', HIGH: 'Urgent', CRITICAL: 'Blocker' };

/** Splits "A, B" between change entries only, never inside a name such as "Beny Saputra, S.Kom". */
const CHANGE_SEPARATOR = /,\s*(?=(?:Status|Priority|Category|Ticket |SLA |Janji vendor)\b)/;
const STATUS = /^Status changed from ([A-Z_]+) to ([A-Z_]+)$/i;
const PRIORITY = /^Priority changed from ([A-Z_]+) to ([A-Z_]+)$/i;
const CATEGORY = /^Category changed from (.+) to (.+)$/i;
const REASSIGNED = /^Ticket (?:re)?assigned to (.+?)(?:\s*\(was (.+?)\))?(?:\s*\(Alasan: [\s\S]+\))?$/i;
/** SLA bookkeeping the requester does not need in a notification. */
const SLA_NOTE = /^SLA /i;

/**
 * The ticket-updated change list ("Status changed from TODO to IN_PROGRESS, Ticket reassigned to B (was A)")
 * as one Indonesian line for a notification: "status Open ke In Progress; PIC kini B". Unknown entries stay as written.
 */
export function describeTicketChanges(changes: string): string {
    const parts = changes.split(CHANGE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
    const lines = parts.flatMap((part): string[] => {
        let m = part.match(STATUS);
        if (m) return [`status ${STATUS_LABEL[m[1]] ?? m[1]} ke ${STATUS_LABEL[m[2]] ?? m[2]}`];
        m = part.match(PRIORITY);
        if (m) return [`prioritas ${PRIORITY_LABEL[m[1]] ?? m[1]} ke ${PRIORITY_LABEL[m[2]] ?? m[2]}`];
        m = part.match(CATEGORY);
        if (m) return [`kategori ${m[1]} ke ${m[2]}`];
        m = part.match(REASSIGNED);
        if (m) return [`PIC kini ${m[1]}`];
        if (SLA_NOTE.test(part)) return [];
        return [part];
    });
    return lines.join('; ');
}
