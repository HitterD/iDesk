import { describe, expect, it } from 'vitest';
import { catalogCode, catalogErrors, groupWeek, mondayOf, techLoadClass, type CatalogDraft } from '../rules';

const draft = (over: Partial<CatalogDraft> = {}): CatalogDraft => ({
    code: 'LAPTOP_STD', name: 'Laptop Standar', category: 'LAPTOP', spec: '', active: true, displayOrder: 10, fields: [], ...over,
});

describe('catalogCode', () => {
    it('uppercases, turns spaces into underscores and drops other characters', () => {
        expect(catalogCode('laptop std 2')).toBe('LAPTOP_STD_2');
        expect(catalogCode('Monitor-27"!')).toBe('MONITOR27');
        expect(catalogCode('  a  b ')).toBe('_A_B_');
    });
});

describe('catalogErrors', () => {
    it('a complete item has no error', () => {
        expect(catalogErrors(draft(), [])).toEqual([]);
    });

    it('needs a name and a code', () => {
        expect(catalogErrors(draft({ name: ' ' }), [])).toContain('Nama barang wajib diisi');
        expect(catalogErrors(draft({ code: '' }), [])).toContain('Kode wajib diisi');
    });

    it('refuses a code another item already uses, but not the item own code on edit', () => {
        const others = [{ id: 'a', code: 'LAPTOP_STD' }];
        expect(catalogErrors(draft(), others)).toContain('Kode sudah dipakai barang lain');
        expect(catalogErrors(draft(), others, 'a')).toEqual([]);
    });

    it('an extra field needs a name, and a choice field needs at least one option', () => {
        expect(catalogErrors(draft({ fields: [{ key: 'k', label: '', type: 'text', required: false }] }), [])).toContain('Isian tambahan 1 belum diberi nama');
        expect(catalogErrors(draft({ fields: [{ key: 'k', label: 'Warna', type: 'select', required: false, options: [] }] }), [])).toContain('Isian "Warna" bertipe Pilihan butuh minimal satu opsi');
        expect(catalogErrors(draft({ fields: [{ key: 'k', label: 'Warna', type: 'select', required: false, options: ['Hitam'] }] }), [])).toEqual([]);
    });
});

describe('mondayOf', () => {
    it('is the Monday of the week a date falls in (WIB)', () => {
        expect(mondayOf('2026-11-25')).toBe('2026-11-23');
        expect(mondayOf('2026-11-23')).toBe('2026-11-23');
        expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    });
});

describe('groupWeek', () => {
    const event = (id: string, start: string) => ({ scheduleId: id, ticketId: 't', ticketNumber: 'N', title: 'x', siteId: 's', technicianId: 'u', technicianName: 'Yudi', status: 'CONFIRMED', start, end: start });

    it('puts every event under its WIB day, seven days from Monday, in time order', () => {
        const days = groupWeek('2026-11-23', [event('b', '2026-11-24T05:00:00Z'), event('a', '2026-11-24T02:00:00Z'), event('c', '2026-11-27T02:00:00Z')]);
        expect(days.map((d) => d.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
        expect(days[1].events.map((e) => e.scheduleId)).toEqual(['a', 'b']);
        expect(days[4].events.map((e) => e.scheduleId)).toEqual(['c']);
        expect(days[0].events).toEqual([]);
    });

    it('an event just after midnight UTC+7 belongs to the next WIB day', () => {
        const days = groupWeek('2026-11-23', [event('late', '2026-11-23T18:00:00Z')]);
        expect(days[1].events.map((e) => e.scheduleId)).toEqual(['late']);
    });
});

describe('techLoadClass', () => {
    it('marks a busy technician (3 or more) hot', () => {
        expect(techLoadClass(2)).toBe('');
        expect(techLoadClass(3)).toBe('hot');
    });
});
