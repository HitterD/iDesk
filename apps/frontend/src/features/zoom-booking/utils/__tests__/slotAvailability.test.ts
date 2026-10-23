import { describe, expect, it } from 'vitest';
import type { CalendarSlot } from '../../types';
import { clashWith, durationLabel, endsBeforeMidnight, occupants, parseTypedTime } from '../slotAvailability';

const slot = (time: string, status: CalendarSlot['status'], booking?: CalendarSlot['booking']): CalendarSlot =>
    ({ date: '2026-10-23', time, endTime: '', status, booking });
const meeting = { id: 'b-1', title: 'Diskusi Air', bookedBy: 'A', durationMinutes: 120, startTime: '14:00', endTime: '16:00' };

describe('slot availability', () => {
    const slots = [
        slot('13:30', 'available'),
        slot('14:00', 'booked', meeting),
        slot('14:30', 'booked', meeting),
        slot('15:00', 'booked', meeting),
        slot('16:00', 'available'),
    ];

    it('lists a multi-slot booking once with its real range', () => {
        expect(occupants(slots)).toEqual([{ title: 'Diskusi Air', start: 840, end: 960, blocked: false }]);
    });

    it('finds overlaps, touching edges are not a clash', () => {
        const list = occupants(slots);
        expect(clashWith(list, '15:00', 60)?.title).toBe('Diskusi Air');
        expect(clashWith(list, '13:30', 60)?.title).toBe('Diskusi Air');
        expect(clashWith(list, '13:00', 60)).toBeUndefined();
        expect(clashWith(list, '16:00', 30)).toBeUndefined();
    });

    it('does not count the booking being rescheduled against itself', () => {
        expect(occupants(slots, 'b-1')).toEqual([]);
    });

    it('labels durations and keeps meetings within the day', () => {
        expect(durationLabel(30)).toBe('30 mnt');
        expect(durationLabel(90)).toBe('1,5 jam');
        expect(endsBeforeMidnight('23:00', 60)).toBe(true);
        expect(endsBeforeMidnight('23:30', 60)).toBe(false);
    });

    it('reads a typed time however it is written', () => {
        expect(['9', '09', '930', '0930', '9.30', '9:30', '14', '1430', ' 14.30 '].map(parseTypedTime))
            .toEqual(['09:00', '09:00', '09:30', '09:30', '09:30', '09:30', '14:00', '14:30', '14:30']);
        expect(['', 'abc', '24', '1260', '9.7', '12345'].map(parseTypedTime)).toEqual([null, null, null, null, null, null]);
    });
});
