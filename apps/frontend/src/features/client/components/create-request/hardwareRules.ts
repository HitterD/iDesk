import { basketErrors, toItemLines, type BasketLine } from '@/features/ticket-board/components/request-flow/picker/basket';

/** The Hardware request form: items in a basket, who they are for, why, and the requester's signature. */
export interface HardwareForm {
    title: string;
    justification: string;
    division: string;
    recipients: string[];
    managerId: string;
    lines: BasketLine[];
    signature: string | null;
}

const TITLE_FALLBACK = 'Permintaan Hardware';

/** The first thing still missing, in the words the form shows; empty when it can be sent. */
export function hardwareMissing(form: HardwareForm): string {
    if (form.lines.length === 0) return 'Pilih minimal satu barang';
    for (const line of form.lines) {
        const missing = line.requiredFields.find((field) => field.required && !filled(line.fields[field.key]));
        if (missing) return `Lengkapi ${line.name}: ${missing.label}`;
    }
    if (!form.justification.trim()) return 'Isi alasan permintaan';
    if (!form.division.trim()) return 'Isi divisi penerima';
    if (form.recipients.filter((name) => name.trim()).length === 0) return 'Isi minimal satu penerima';
    if (form.recipients.length > 1) {
        const unassigned = form.lines.find((line) => !line.recipient?.trim());
        if (unassigned) return `Pilih untuk siapa ${unassigned.name}`;
    }
    if (!form.signature) return 'Tanda tangan dulu';
    return basketErrors(form.lines)[0] ?? '';
}

const filled = (value: string | number | undefined): boolean => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');

/** The ticket title follows the first item, so the list says what was asked for. */
export function hardwareTitle(form: HardwareForm): string {
    const first = form.lines[0];
    if (!first) return TITLE_FALLBACK;
    const more = form.lines.length - 1;
    return `${first.name}${more > 0 ? ` +${more} barang lain` : ''}`;
}

/** The body of POST /request-flow/hardware. */
export function toHardwarePayload(form: HardwareForm): Record<string, unknown> {
    const recipients = form.recipients.map((name) => name.trim()).filter(Boolean);
    const single = recipients.length === 1 ? recipients[0] : null;
    const items = toItemLines(form.lines.map((line) => ({ ...line, recipient: single ?? line.recipient })));
    return {
        title: form.title.trim() || hardwareTitle(form),
        justification: form.justification.trim(),
        division: form.division.trim(),
        recipients,
        ...(form.managerId ? { managerId: form.managerId } : {}),
        items,
        signatureData: form.signature,
    };
}
