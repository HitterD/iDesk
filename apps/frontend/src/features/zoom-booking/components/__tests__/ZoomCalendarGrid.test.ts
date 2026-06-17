import { describe, it, expect } from 'vitest';
import { processBookingsForDayV2, MAX_VISIBLE_ROWS } from '../ZoomCalendarGrid';
import type { CalendarDay } from '../../types';

function mkDay(
    bookings: Array<{ id: string; startIdx: number; span: number; isMine?: boolean }>,
): CalendarDay {
    const slots = Array.from({ length: 24 }, (_, i) => ({
        date: '2026-06-11',
        time: `${8 + Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
        endTime: `${8 + Math.floor((i + 1) / 2)}:${(i + 1) % 2 === 0 ? '00' : '30'}`,
        status: 'available' as const,
    }));
    bookings.forEach((b) => {
        for (let i = 0; i < b.span; i++) {
            const idx = b.startIdx + i;
            slots[idx] = {
                ...slots[idx],
                status: b.isMine ? 'my_booking' : 'booked',
                booking: {
                    id: b.id,
                    title: b.id,
                    bookedBy: 'X',
                    durationMinutes: b.span * 30,
                    startTime: slots[b.startIdx].time,
                    endTime: 'X',
                    isExternal: false,
                },
            };
        }
    });
    return {
        date: '2026-06-11',
        dayOfWeek: 3,
        isWorkingDay: true,
        isBlocked: false,
        slots,
    };
}

describe('processBookingsForDayV2', () => {
    it('returns one entry per booking', () => {
        const day = mkDay([
            { id: 'a', startIdx: 0, span: 2 },
            { id: 'b', startIdx: 4, span: 2 },
        ]);
        const result = processBookingsForDayV2(day);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('a');
        expect(result[1].id).toBe('b');
    });

    it('stacks overlapping bookings in different rows', () => {
        // Two bookings, distinct starts but overlapping windows
        const day = mkDay([
            { id: 'a', startIdx: 0, span: 4 },
            { id: 'b', startIdx: 2, span: 4 },
        ]);
        const result = processBookingsForDayV2(day);
        expect(result).toHaveLength(2);
        const a = result.find((r) => r.id === 'a')!;
        const b = result.find((r) => r.id === 'b')!;
        expect(a.rowIndex).not.toBe(b.rowIndex);
        expect(a.totalRows).toBe(2);
        expect(b.totalRows).toBe(2);
    });

    it('caps totalRows to MAX_VISIBLE_ROWS and tracks overflowCount', () => {
        // 10 distinct bookings, each at a unique start slot but all overlap a common anchor
        const many = Array.from({ length: 10 }, (_, i) => ({
            id: `b${i}`,
            startIdx: i,
            span: 20, // long enough that all overlap
        }));
        const day = mkDay(many);
        const result = processBookingsForDayV2(day);
        expect(result).toHaveLength(10);
        expect(result[0].totalRows).toBe(MAX_VISIBLE_ROWS);
        const overflow = result.find((r) => r.overflowCount > 0);
        expect(overflow?.overflowCount).toBe(10 - MAX_VISIBLE_ROWS);
    });

    it('puts my-bookings first in row order', () => {
        // 'other' occupies slots 0-1; 'mine' occupies slots 2-3 (overlap via long spans)
        const day = mkDay([
            { id: 'other', startIdx: 0, span: 4 },
            { id: 'mine', startIdx: 2, span: 4, isMine: true },
        ]);
        const result = processBookingsForDayV2(day);
        expect(result).toHaveLength(2);
        const mine = result.find((r) => r.id === 'mine')!;
        const other = result.find((r) => r.id === 'other')!;
        // mine should get a lower rowIndex than other (my-bookings win)
        expect(mine.rowIndex).toBeLessThan(other.rowIndex);
    });

    it('returns empty array for empty day', () => {
        const day = mkDay([]);
        expect(processBookingsForDayV2(day)).toEqual([]);
    });
});
