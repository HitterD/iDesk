/** Create-ticket form rules. Limits mirror the backend CreateTicketDto (title 5..200, description ..5000);
 *  the description minimum (10) and the critical reason are stricter client-side rules. */
export const TITLE_MIN = 5;
export const TITLE_MAX = 200;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 5000;

export type TicketField = 'title' | 'description' | 'criticalReason';
export type TicketFormErrors = Partial<Record<TicketField, string>>;

export interface TicketFormValues {
    title: string;
    description: string;
    priority: string;
    criticalReason?: string;
}

/** Order the fields appear in, so the first invalid one is the one focused. */
export const FIELD_ORDER: readonly TicketField[] = ['title', 'description', 'criticalReason'];

export const FIELD_LABEL: Record<TicketField, string> = {
    title: 'Judul',
    description: 'Detail masalah',
    criticalReason: 'Alasan prioritas Blocker',
};

export function titleError(value: string, required: boolean): string | undefined {
    const length = value.trim().length;
    if (length === 0) return required ? 'Judul tiket wajib diisi' : undefined;
    if (length < TITLE_MIN) return `Judul tiket minimal ${TITLE_MIN} karakter`;
    return undefined;
}

export function descriptionError(value: string, required: boolean): string | undefined {
    const length = value.trim().length;
    if (length === 0) return required ? 'Detail masalah wajib diisi' : undefined;
    if (length < DESCRIPTION_MIN) return `Deskripsi tiket minimal ${DESCRIPTION_MIN} karakter`;
    return undefined;
}

export function criticalReasonError(values: TicketFormValues, required: boolean): string | undefined {
    if (values.priority !== 'CRITICAL' || !required) return undefined;
    return values.criticalReason?.trim() ? undefined : 'Jelaskan kenapa tiket ini Blocker';
}

/**
 * Full check. `required` is false while the user has not tried to submit yet: empty fields are not
 * flagged then (only too-short text), so nobody is scolded for a form they have not finished.
 */
export function validateTicketForm(values: TicketFormValues, required = true): TicketFormErrors {
    const errors: TicketFormErrors = {
        title: titleError(values.title, required),
        description: descriptionError(values.description, required),
        criticalReason: criticalReasonError(values, required),
    };
    return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as TicketFormErrors;
}

export const invalidFields = (errors: TicketFormErrors): TicketField[] => FIELD_ORDER.filter((field) => errors[field]);

/** Server rejection -> a field error when the message names a field, else one message for the banner. */
export function mapSubmitError(error: unknown): { fields: TicketFormErrors; message: string } {
    const err = error as { response?: { status?: number; data?: { message?: unknown } }; code?: string; message?: string };
    const status = err?.response?.status;
    if (!err?.response) {
        return { fields: {}, message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu kirim ulang. Isian Anda tetap tersimpan.' };
    }
    if (status === 413) {
        return { fields: {}, message: 'Lampiran terlalu besar. Kurangi ukuran atau jumlah file, lalu kirim ulang.' };
    }
    const raw = err.response.data?.message;
    const messages = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === 'string' && m.length > 0);
    const fields: TicketFormErrors = {};
    for (const message of messages) {
        if (/^title\b/i.test(message)) fields.title = `Judul tidak valid: ${message}`;
        else if (/^description\b/i.test(message)) fields.description = `Detail masalah tidak valid: ${message}`;
    }
    if (status !== undefined && status >= 500) {
        return { fields, message: 'Server sedang bermasalah. Coba kirim ulang sebentar lagi. Isian Anda tetap tersimpan.' };
    }
    return { fields, message: messages.length ? `Gagal membuat tiket: ${messages.join(', ')}` : 'Gagal membuat tiket. Periksa kembali formulir Anda.' };
}
