import { MAX_SIGNOFF_SLOTS, defaultSignoff, parseSignoffParam, sanitizeSignoff, signoffRows } from './report-signoff';

describe('report sign-off layout', () => {
    it('defaults to the two columns every report had before', () => {
        const layout = defaultSignoff('Budi', 'Head of ICT');
        expect(layout.columns).toBe(2);
        expect(layout.slots.map((s) => [s.title, s.name])).toEqual([
            ['Disiapkan oleh', 'Budi'],
            ['Diketahui / disetujui oleh', 'Head of ICT'],
        ]);
        expect(layout.slots.every((s) => s.showDate && s.align === 'left')).toBe(true);
    });

    it('accepts more than two signers and keeps their order', () => {
        const layout = sanitizeSignoff({ columns: 3, slots: ['A', 'B', 'C', 'D'].map((name) => ({ title: 'T', name })) }, defaultSignoff('x', 'y'));
        expect(layout.slots.map((s) => s.name)).toEqual(['A', 'B', 'C', 'D']);
        expect(layout.columns).toBe(3);
    });

    it('caps slots and columns, trims text, and fixes bad values', () => {
        const slots = Array.from({ length: 20 }, (_, i) => ({ title: ` T${i} `, name: 'N', align: 'weird', showDate: 'yes' }));
        const layout = sanitizeSignoff({ columns: 9, slots }, defaultSignoff('x', 'y'));
        expect(layout.slots).toHaveLength(MAX_SIGNOFF_SLOTS);
        expect(layout.columns).toBe(4);
        expect(layout.slots[0]).toEqual({ title: 'T0', name: 'N', role: '', align: 'left', showDate: true });
    });

    it('allows no signers at all', () => {
        expect(sanitizeSignoff({ columns: 2, slots: [] }, defaultSignoff('x', 'y')).slots).toEqual([]);
    });

    it('falls back to the default when the input is not a layout', () => {
        const fallback = defaultSignoff('x', 'y');
        expect(sanitizeSignoff(null, fallback)).toEqual(fallback);
        expect(sanitizeSignoff({ slots: 'nope' }, fallback)).toEqual(fallback);
    });

    it('splits slots into rows of `columns`', () => {
        const layout = sanitizeSignoff({ columns: 3, slots: Array.from({ length: 4 }, () => ({ title: 'T', name: 'N' })) }, defaultSignoff('x', 'y'));
        expect(signoffRows(layout).map((r) => r.length)).toEqual([3, 1]);
    });

    it('reads the one-off override from a query string, ignoring junk', () => {
        const fallback = defaultSignoff('x', 'y');
        expect(parseSignoffParam(undefined, fallback)).toBe(fallback);
        expect(parseSignoffParam('{not json', fallback)).toBe(fallback);
        expect(parseSignoffParam(JSON.stringify({ columns: 1, slots: [{ title: 'T', name: 'Siti' }] }), fallback).slots[0].name).toBe('Siti');
    });
});
