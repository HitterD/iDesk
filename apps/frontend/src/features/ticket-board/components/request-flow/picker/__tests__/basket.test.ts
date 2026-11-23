import { describe, expect, it } from 'vitest';
import { addCatalog, addManual, basketErrors, replaceLine, setQuantity, toItemLines, type BasketLine, type CatalogEntry } from '../basket';

const laptop: CatalogEntry = { id: 'c-1', code: 'LAPTOP_STD', name: 'Laptop Standar', category: 'LAPTOP', requiredFields: [] };
const software: CatalogEntry = {
    id: 'c-2', code: 'SW', name: 'Lisensi Software', category: 'SOFTWARE',
    requiredFields: [{ key: 'seat', label: 'Jumlah seat', type: 'number', required: true }],
};

describe('basket', () => {
    it('adding the same catalog item again raises its quantity instead of repeating the line', () => {
        const once = addCatalog([], laptop);
        const twice = addCatalog(once, laptop);
        expect(twice).toHaveLength(1);
        expect(twice[0]).toMatchObject({ catalogId: 'c-1', name: 'Laptop Standar', quantity: 2 });
    });

    it('quantity stays between 1 and the limit', () => {
        const line = addCatalog([], laptop);
        expect(setQuantity(line, 0, 0)[0].quantity).toBe(1);
        expect(setQuantity(line, 0, 999)[0].quantity).toBe(50);
        expect(setQuantity(line, 0, 4)[0].quantity).toBe(4);
    });

    it('a manual item is its own line, named by IT or the requester', () => {
        const lines = addManual([], 'Kabel HDMI 5 meter');
        expect(lines[0]).toMatchObject({ catalogId: null, name: 'Kabel HDMI 5 meter', quantity: 1 });
        expect(addManual(lines, '  ')).toHaveLength(1);
    });

    it('replacing a line swaps the item and remembers what it replaces', () => {
        const lines = addCatalog([], software);
        const swapped = replaceLine(lines, 0, laptop);
        expect(swapped[0]).toMatchObject({ catalogId: 'c-1', name: 'Laptop Standar', replacesName: 'Lisensi Software' });
        expect(swapped[0].fields).toEqual({});
    });

    it('a required field that is empty blocks the basket and names the line', () => {
        const lines = addCatalog([], software);
        expect(basketErrors(lines)).toEqual(['Isian "Jumlah seat" wajib untuk Lisensi Software']);
        const filled = [{ ...lines[0], fields: { seat: 5 } }];
        expect(basketErrors(filled)).toEqual([]);
    });

    it('an empty basket cannot be sent', () => {
        expect(basketErrors([])).toEqual(['Pilih minimal satu barang']);
    });

    it('lines become the item payload of the backend: catalog or manual, with the kept units on an edit', () => {
        const lines: BasketLine[] = [
            { ...addCatalog([], laptop)[0], quantity: 2, recipient: 'Leony', existingItemIds: ['u-1'] },
            addManual([], 'Kabel HDMI')[0],
        ];
        expect(toItemLines(lines)).toEqual([
            { catalogId: 'c-1', quantity: 2, recipientName: 'Leony', existingItemIds: ['u-1'] },
            { manualName: 'Kabel HDMI', quantity: 1 },
        ]);
    });

    it('a replacement keeps the name it replaces in the payload', () => {
        const swapped = replaceLine(addCatalog([], software), 0, laptop);
        expect(toItemLines(swapped)[0]).toMatchObject({ catalogId: 'c-1', replacesName: 'Lisensi Software' });
    });
});
