/** Pure rules of the "Perangkat & Akses" pages: catalog editing, and how the install week is laid out. */
export interface CatalogField { key: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options?: string[] }

export interface CatalogDraft {
    code: string;
    name: string;
    category: string;
    spec: string;
    active: boolean;
    displayOrder: number;
    fields: CatalogField[];
}

/** The code is typed freely and forced into one shape: uppercase, underscores for spaces, nothing else. */
export const catalogCode = (raw: string): string => raw.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

/** What is wrong with a catalog item, in the words the form shows (empty = can be saved). */
export function catalogErrors(draft: CatalogDraft, existing: Array<{ id: string; code: string }>, editingId?: string): string[] {
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push('Nama barang wajib diisi');
    if (!draft.code.trim()) errors.push('Kode wajib diisi');
    else if (existing.some((item) => item.code === draft.code.trim() && item.id !== editingId)) errors.push('Kode sudah dipakai barang lain');
    draft.fields.forEach((field, index) => {
        if (!field.label.trim()) errors.push(`Isian tambahan ${index + 1} belum diberi nama`);
        else if (field.type === 'select' && (field.options ?? []).filter(Boolean).length === 0) errors.push(`Isian "${field.label}" bertipe Pilihan butuh minimal satu opsi`);
    });
    return errors;
}

const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;
const WEEK_DAYS = 7;

const wibDate = (at: Date): string => new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

/** The Monday (YYYY-MM-DD) of the week the given day falls in. */
export function mondayOf(isoDay: string): string {
    const date = new Date(`${isoDay}T00:00:00Z`);
    const sinceMonday = (date.getUTCDay() + 6) % 7;
    return new Date(date.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

export interface WeekEvent { scheduleId: string; start: string | null }

/** Seven days from Monday, each with its events in time order; an event belongs to its WIB day. */
export function groupWeek<T extends WeekEvent>(weekStart: string, events: T[]): Array<{ date: string; events: T[] }> {
    const first = new Date(`${weekStart}T00:00:00Z`).getTime();
    const days = Array.from({ length: WEEK_DAYS }, (_, i) => ({ date: new Date(first + i * DAY_MS).toISOString().slice(0, 10), events: [] as T[] }));
    for (const event of [...events].sort((a, b) => String(a.start).localeCompare(String(b.start)))) {
        if (!event.start) continue;
        const day = days.find((d) => d.date === wibDate(new Date(event.start!)));
        day?.events.push(event);
    }
    return days;
}

/** A technician with this many installs in the week is flagged busy. */
const BUSY_INSTALLS = 3;
export const techLoadClass = (count: number): '' | 'hot' => (count >= BUSY_INSTALLS ? 'hot' : '');
