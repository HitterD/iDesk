/** The item basket shared by the request form (requester) and the item editor (IT): pure helpers, no UI. */
export const QUANTITY_MAX = 50;
const QUANTITY_MIN = 1;

export interface RequiredField { key: string; label: string; type: string; options?: string[]; required?: boolean }
export interface CatalogEntry { id: string; code: string; name: string; category: string; requiredFields?: RequiredField[] }

export interface BasketLine {
    /** Catalog item, or null for an item written by hand. */
    catalogId: string | null;
    name: string;
    quantity: number;
    recipient?: string;
    note?: string;
    /** Values of the item's extra fields (e.g. software seats). */
    fields: Record<string, string | number>;
    requiredFields: RequiredField[];
    /** The item this one replaces (a swap by IT). */
    replacesName?: string;
    /** Units of the request this line keeps (the editor): the rest of the quantity is new. */
    existingItemIds?: string[];
}

const clamp = (value: number): number => Math.max(QUANTITY_MIN, Math.min(QUANTITY_MAX, Math.floor(value) || QUANTITY_MIN));

const lineOf = (entry: CatalogEntry): BasketLine => ({
    catalogId: entry.id, name: entry.name, quantity: 1, fields: {}, requiredFields: entry.requiredFields ?? [],
});

/** Picking the same catalog item again adds one unit to its line. */
export function addCatalog(lines: BasketLine[], entry: CatalogEntry): BasketLine[] {
    const index = lines.findIndex((line) => line.catalogId === entry.id && !line.replacesName);
    if (index < 0) return [...lines, lineOf(entry)];
    return lines.map((line, i) => (i === index ? { ...line, quantity: clamp(line.quantity + 1) } : line));
}

export function addManual(lines: BasketLine[], name: string): BasketLine[] {
    const trimmed = name.trim();
    if (!trimmed) return lines;
    return [...lines, { catalogId: null, name: trimmed, quantity: 1, fields: {}, requiredFields: [] }];
}

export function setQuantity(lines: BasketLine[], index: number, quantity: number): BasketLine[] {
    return lines.map((line, i) => (i === index ? { ...line, quantity: clamp(quantity) } : line));
}

/** Swaps one line for another catalog item, marking what it replaces so the document can say so. */
export function replaceLine(lines: BasketLine[], index: number, entry: CatalogEntry): BasketLine[] {
    return lines.map((line, i) => (i === index ? { ...lineOf(entry), quantity: line.quantity, recipient: line.recipient, replacesName: line.replacesName ?? line.name } : line));
}

/** Why the basket cannot be sent yet (empty list = fine). */
export function basketErrors(lines: BasketLine[]): string[] {
    if (lines.length === 0) return ['Pilih minimal satu barang'];
    const errors: string[] = [];
    for (const line of lines) {
        for (const field of line.requiredFields) {
            if (!field.required) continue;
            const value = line.fields[field.key];
            const filled = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
            if (!filled) errors.push(`Isian "${field.label}" wajib untuk ${line.name}`);
        }
    }
    return errors;
}

/** A unit of a request as the view shows it. */
export interface FlowUnit { id: string; name: string; recipient: string; note: string | null; catalogId: string | null; fields: Record<string, unknown> }

const sameLineKey = (unit: FlowUnit): string =>
    JSON.stringify([unit.catalogId, unit.name, unit.recipient, unit.note ?? '', unit.fields]);

/** The editor's starting point: units alike in everything the editor can change share a line, and keep what they were. */
export function basketFromItems(units: FlowUnit[]): BasketLine[] {
    const lines = new Map<string, BasketLine>();
    for (const unit of units) {
        const key = sameLineKey(unit);
        const line = lines.get(key);
        if (line) { lines.set(key, { ...line, quantity: line.quantity + 1, existingItemIds: [...(line.existingItemIds ?? []), unit.id] }); continue; }
        lines.set(key, {
            catalogId: unit.catalogId, name: unit.name, quantity: 1, recipient: unit.recipient, ...(unit.note ? { note: unit.note } : {}),
            fields: unit.fields as Record<string, string | number>, requiredFields: [], existingItemIds: [unit.id],
        });
    }
    return [...lines.values()];
}

/** The item lines the backend takes (create ticket and item edit). */
export function toItemLines(lines: BasketLine[]): Array<Record<string, unknown>> {
    return lines.map((line) => {
        const out: Record<string, unknown> = line.catalogId ? { catalogId: line.catalogId } : { manualName: line.name };
        out.quantity = line.quantity;
        if (line.note?.trim()) out.note = line.note.trim();
        if (Object.keys(line.fields).length > 0) out.fields = line.fields;
        if (line.recipient?.trim()) out.recipientName = line.recipient.trim();
        if (line.replacesName) out.replacesName = line.replacesName;
        if (line.existingItemIds && line.existingItemIds.length > 0) out.existingItemIds = line.existingItemIds;
        return out;
    });
}
