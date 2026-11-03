/** Editable sign-off block of the report PDFs: who signs, what is written above/below the line, and how the slots are laid out. */

export const MAX_SIGNOFF_SLOTS = 12;
export const MAX_SIGNOFF_COLUMNS = 4;
const MAX_TEXT = 80;
const DEFAULT_COLUMNS = 2;

export type SignoffAlign = 'left' | 'center' | 'right';
const ALIGNS: readonly SignoffAlign[] = ['left', 'center', 'right'];

export interface SignoffSlot {
    /** Written above the signing line, e.g. "Disiapkan oleh". */
    title: string;
    name: string;
    /** Job title shown under the name; empty hides it. */
    role: string;
    align: SignoffAlign;
    showDate: boolean;
}

export interface SignoffLayout {
    columns: number;
    slots: SignoffSlot[];
}

export const defaultSignoff = (preparedBy: string, approvedBy: string): SignoffLayout => ({
    columns: 2,
    slots: [
        { title: 'Disiapkan oleh', name: preparedBy, role: '', align: 'left', showDate: true },
        { title: 'Diketahui / disetujui oleh', name: approvedBy, role: '', align: 'left', showDate: true },
    ],
});

const text = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '');

const sanitizeSlot = (raw: any): SignoffSlot => ({
    title: text(raw?.title),
    name: text(raw?.name),
    role: text(raw?.role),
    align: ALIGNS.includes(raw?.align) ? raw.align : 'left',
    showDate: raw?.showDate === false ? false : true,
});

/** Turns untrusted input into a layout that is safe to draw; anything that is not a layout yields `fallback`. */
export function sanitizeSignoff<F extends SignoffLayout | undefined>(raw: any, fallback: F): SignoffLayout | F {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.slots)) return fallback;
    const columns = Math.min(MAX_SIGNOFF_COLUMNS, Math.max(1, Math.trunc(Number(raw.columns)) || fallback?.columns || DEFAULT_COLUMNS));
    return { columns, slots: raw.slots.slice(0, MAX_SIGNOFF_SLOTS).map(sanitizeSlot) };
}

/** The one-off override a user sends from the preview dialog (JSON in a query parameter). */
export function parseSignoffParam<F extends SignoffLayout | undefined>(param: string | undefined, fallback: F): SignoffLayout | F {
    if (!param) return fallback;
    try {
        return sanitizeSignoff(JSON.parse(param), fallback);
    } catch {
        return fallback;
    }
}

export const signoffRows = (layout: SignoffLayout): SignoffSlot[][] => {
    const rows: SignoffSlot[][] = [];
    for (let i = 0; i < layout.slots.length; i += layout.columns) rows.push(layout.slots.slice(i, i + layout.columns));
    return rows;
};
