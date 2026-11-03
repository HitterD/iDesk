import { describe, expect, it } from 'vitest';
import { builtInSignoff, emptySlot, moveSlot, signoffTypeOf, withSignoff } from './signoff';

describe('signoff helpers', () => {
    it('recognises the three report PDFs and nothing else', () => {
        expect(signoffTypeOf('/reports/export/pdf/monthly?month=10&year=2026')).toBe('monthly');
        expect(signoffTypeOf('/reports/export/pdf/agent-performance?startDate=a')).toBe('agent-performance');
        expect(signoffTypeOf('/reports/export/pdf/ticket-volume')).toBe('ticket-volume');
        expect(signoffTypeOf('/tickets/123/pdf')).toBeNull();
    });

    it('appends the one-off layout to the URL', () => {
        const layout = builtInSignoff('monthly');
        const url = withSignoff('/reports/export/pdf/monthly?month=10', layout);
        expect(url.startsWith('/reports/export/pdf/monthly?month=10&signoff=')).toBe(true);
        expect(JSON.parse(decodeURIComponent(url.split('signoff=')[1]))).toEqual(layout);
        expect(withSignoff('/reports/export/pdf/monthly', layout)).toContain('?signoff=');
        expect(withSignoff('/reports/export/pdf/monthly?month=10', null)).toBe('/reports/export/pdf/monthly?month=10');
    });

    it('starts from what the PDF already prints', () => {
        expect(builtInSignoff('agent-performance').slots.map((s) => s.name)).toEqual(['IT Service Lead', 'Head of ICT']);
    });

    it('moves a slot without mutating the original', () => {
        const slots = ['A', 'B', 'C'].map((name) => ({ ...emptySlot(), name }));
        expect(moveSlot(slots, 0, 2).map((s) => s.name)).toEqual(['B', 'C', 'A']);
        expect(slots.map((s) => s.name)).toEqual(['A', 'B', 'C']);
        expect(moveSlot(slots, 0, -1)).toBe(slots);
        expect(moveSlot(slots, 2, 3)).toBe(slots);
    });
});
