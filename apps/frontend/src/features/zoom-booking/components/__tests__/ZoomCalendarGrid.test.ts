import { describe, it, expect } from 'vitest';
import { processBookingsForDayV2, MAX_VISIBLE_ROWS } from '../ZoomCalendarGrid';
import type { CalendarDay } from '../../types';

function mkDay(
    bookings: Array<{ id: string; startIdx: number; span: number; isMine?: boolean }>,
): CalendarDay {
    const slots: CalendarDay['slots'] = Array.from({ length: 24 }, (_, i) => ({
        date: '2026-06-11',
        time: `${8 + Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
        endTime: `${8 + Math.floor((i + 1) / 2)}:${(i + 1) % 2 === 0 ? '00' : '30'}`,
        status: 'available',
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

    it('renders extraBookings from merged (Gabungan) slot as separate stack entries', () => {
        // Simulate a merged slot with 1 primary + 2 extras (same time, different accounts).
        // Bug repro: previously only the primary booking was rendered; extras were dropped.
        const slots: CalendarDay['slots'] = Array.from({ length: 48 }, (_, i) => ({
            date: '2026-06-11',
            time: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
            endTime: `${String(Math.floor((i + 1) / 2)).padStart(2, '0')}:${(i + 1) % 2 === 0 ? '00' : '30'}`,
            status: 'available' as const,
        }));
        // Slot index 40 = 20:00 (40 / 2 = 20 hours).
        slots[40] = {
            ...slots[40],
            status: 'booked',
            booking: {
                id: 'zoom1',
                title: 'Rapat',
                bookedBy: 'User A',
                durationMinutes: 60,
                startTime: '20:00',
                endTime: '21:00',
                isExternal: false,
            },
        };
        // Attach extras (different accounts at the same time, merged view).
        (slots[40] as any).extraBookings = [
            {
                id: 'zoom2',
                title: 'Standup',
                bookedBy: 'User B',
                durationMinutes: 60,
                startTime: '20:00',
                endTime: '21:00',
                isExternal: false,
            },
            {
                id: 'zoom3',
                title: 'Demo',
                bookedBy: 'User C',
                durationMinutes: 60,
                startTime: '20:00',
                endTime: '21:00',
                isExternal: false,
            },
        ];
        const day: CalendarDay = {
            date: '2026-06-11',
            dayOfWeek: 3,
            isWorkingDay: true,
            isBlocked: false,
            slots,
        };

        const result = processBookingsForDayV2(day);
        const ids = result.map((r) => r.id);
        expect(ids).toContain('zoom1');
        expect(ids).toContain('zoom2');
        expect(ids).toContain('zoom3');
        expect(result).toHaveLength(3);

        // All three should share the same rowStart (same time slot) so they stack vertically.
        const rowStarts = new Set(result.map((r) => r.rowStart));
        expect(rowStarts.size).toBe(1);
    });
});
