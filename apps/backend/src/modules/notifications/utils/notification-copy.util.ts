/** Ticket status in notification sentences ("Status: Selesai → Ditutup"). */
const STATUS_LABEL: Record<string, string> = {
    TODO: 'Baru', IN_PROGRESS: 'Dikerjakan', WAITING_VENDOR: 'Menunggu Vendor',
    RESOLVED: 'Selesai', CLOSED: 'Ditutup', CANCELLED: 'Dibatalkan',
};
export const PRIORITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Normal', HIGH: 'Urgent', CRITICAL: 'Blocker' };

/** Splits "A, B" between change entries only, never inside a name such as "Beny Saputra, S.Kom". */
const CHANGE_SEPARATOR = /,\s*(?=(?:Status|Priority|Category|Ticket |Assigned to|SLA |Janji vendor|Keterangan vendor|Menunggu konfirmasi)\b)/;
/** "Status changed from A to B", optionally with a note "(otomatis, …)"; bulk edits write "Status: A → B". */
const STATUS = /^Status(?: changed from|:) ([A-Z_]+) (?:to|→) ([A-Z_]+)(?:\s*\((.+)\))?$/i;
const PRIORITY = /^Priority(?: changed from|:) ([A-Z_]+) (?:to|→) ([A-Z_]+)$/i;
const CATEGORY = /^Category(?: changed from|:) (.+) (?:to|→) (.+)$/i;
const REASSIGNED = /^(?:Ticket (?:re)?assigned to|Assigned to:) (.+?)(?:\s*\(was .+?\))?(?: by .+?)?(?:\.? ?\(?Alasan: [\s\S]+?\)?)?$/i;
/** Bookkeeping the requester does not need in a notification (SLA timers, the raw confirmation deadline). */
const HIDDEN = /^(?:SLA |Menunggu konfirmasi pemohon)/i;

/** The resolution flow's notes on a status change, as the sentence the requester reads. */
const STATUS_NOTE: ReadonlyArray<[RegExp, string]> = [
    [/otomatis, batas konfirmasi terlewati/i, 'Ditutup otomatis: tidak dikonfirmasi dalam batas waktu'],
    [/dikonfirmasi pemohon/i, 'Ditutup: penyelesaian dikonfirmasi pemohon'],
    [/ditandai selesai oleh pemohon/i, 'Ditutup: ditandai selesai oleh pemohon'],
    [/disanggah pemohon/i, 'Dibuka kembali: penyelesaian disanggah pemohon'],
];

const label = (status: string): string => STATUS_LABEL[status.toUpperCase()] ?? status;

/**
 * The ticket-updated change list ("Status changed from TODO to IN_PROGRESS, Ticket reassigned to B (was A)")
 * as one Indonesian sentence for a notification: "Status: Baru → Dikerjakan; PIC kini B". Unknown entries stay
 * as written.
 */
export function describeTicketChanges(changes: string): string {
    const parts = changes.split(CHANGE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
    const lines = parts.flatMap((part): string[] => {
        let m = part.match(STATUS);
        if (m) {
            const note = m[3] && STATUS_NOTE.find(([pattern]) => pattern.test(m![3]));
            return [note ? note[1] : `Status: ${label(m[1])} → ${label(m[2])}`];
        }
        m = part.match(PRIORITY);
        if (m) return [`Prioritas: ${PRIORITY_LABEL[m[1]] ?? m[1]} → ${PRIORITY_LABEL[m[2]] ?? m[2]}`];
        m = part.match(CATEGORY);
        if (m) return [`Kategori: ${m[1]} → ${m[2]}`];
        m = part.match(REASSIGNED);
        if (m) return [`PIC kini ${m[1]}`];
        if (HIDDEN.test(part)) return [];
        return [part];
    });
    return lines.join('; ');
}

/** People a ticket notification can name. */
export interface TicketPeople {
    /** Problem title of the ticket, used as the notification title. */
    title?: string | null;
    /** PIC (shown to the requester side). */
    assigneeName?: string | null;
    /** Requester (shown to agents). */
    requesterName?: string | null;
}

/** "<sentence> · <who>", leaving out an empty part. */
export function withWho(sentence: string, who: string | null | undefined): string {
    return who ? `${sentence} · ${who}` : sentence;
}

/** The "who" part for the requester side: the PIC, unless the sentence already names the new PIC. */
export function picOf(sentence: string, assigneeName: string | null | undefined): string | null {
    return assigneeName && !sentence.includes('PIC kini') ? `PIC ${assigneeName}` : null;
}

/**
 * The new status when the change list moved the ticket to another status, else null. Emails about a ticket go out
 * only for these; priority, category and SLA edits stay in-app.
 */
export function statusChangeOf(changes: string[]): string | null {
    for (const entry of changes.flatMap((change) => change.split(CHANGE_SEPARATOR))) {
        const m = entry.trim().match(STATUS);
        if (m && m[1].toUpperCase() !== m[2].toUpperCase()) return m[2].toUpperCase();
    }
    return null;
}
