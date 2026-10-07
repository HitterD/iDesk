// The off-by-one only shows east of UTC: pin the worker to WIB before any Date is built.
process.env.TZ = 'Asia/Jakarta';

import { describe, it, expect } from 'vitest';
import { buildSlotRange } from '../schedule-slot.util';

describe('buildSlotRange', () => {
    it('keeps the picked calendar day in WIB (date picker gives local midnight)', () => {
        const pickedLocalMidnight = new Date(2026, 9, 10); // 10 Okt 2026 00:00 WIB = 9 Okt 17:00 UTC

        const { start, end } = buildSlotRange(pickedLocalMidnight, '09:00', 3);

        expect(start.toISOString()).toBe('2026-10-10T02:00:00.000Z'); // 10 Okt 09:00 WIB
        expect(end.toISOString()).toBe('2026-10-10T05:00:00.000Z'); // 10 Okt 12:00 WIB
    });

    it('ignores the time-of-day carried by the picked date', () => {
        const presetWithClock = new Date(2026, 9, 12, 6, 30); // quick preset uses "now"

        const { start } = buildSlotRange(presetWithClock, '13:00', 1);

        expect(start.toISOString()).toBe('2026-10-12T06:00:00.000Z'); // 12 Okt 13:00 WIB
    });

    it('supports minutes in the time chip', () => {
        const { start, end } = buildSlotRange(new Date(2026, 9, 10), '14:30', 2);

        expect(start.getHours()).toBe(14);
        expect(start.getMinutes()).toBe(30);
        expect(end.getHours()).toBe(16);
    });
});
