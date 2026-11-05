/** Why a ticket was cancelled. Same list for requesters and agents; OTHER needs a written note. */
export enum TicketCancelReasonCode {
    DUPLICATE = 'DUPLICATE',
    SELF_RESOLVED = 'SELF_RESOLVED',
    WRONG_SUBMISSION = 'WRONG_SUBMISSION',
    NO_RESPONSE = 'NO_RESPONSE',
    NOT_NEEDED = 'NOT_NEEDED',
    OTHER = 'OTHER',
}

export const TICKET_CANCEL_REASON_LABELS: Record<TicketCancelReasonCode, string> = {
    [TicketCancelReasonCode.DUPLICATE]: 'Duplikat tiket lain',
    [TicketCancelReasonCode.SELF_RESOLVED]: 'Masalah sudah teratasi sendiri',
    [TicketCancelReasonCode.WRONG_SUBMISSION]: 'Salah kirim / salah kategori',
    [TicketCancelReasonCode.NO_RESPONSE]: 'Tidak ada respon dari pemohon',
    [TicketCancelReasonCode.NOT_NEEDED]: 'Tidak lagi dibutuhkan',
    [TicketCancelReasonCode.OTHER]: 'Lainnya',
};

/** Longest cancel note (column length and DTO limit). */
export const TICKET_CANCEL_NOTE_MAX_LENGTH = 500;
/** Shortest note accepted when the reason is OTHER. */
export const TICKET_CANCEL_NOTE_MIN_LENGTH = 5;

/** "Label" or "Label: note" — one line for system messages, audit and email. */
export function formatCancelReason(code: TicketCancelReasonCode, note?: string | null): string {
    const label = TICKET_CANCEL_REASON_LABELS[code];
    const trimmed = note?.trim();
    return trimmed ? `${label}: ${trimmed}` : label;
}
