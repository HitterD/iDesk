import { describe, expect, it, vi } from 'vitest';
import { FANFARE_NOTES, initialsOf, minutesLabel, playFanfare, themeForDate, titleName } from '../tvLeaderboard';

describe('themeForDate', () => {
    it('picks one theme per working day, Monday to Friday', () => {
        // 2026-11-09 is a Monday.
        expect(['09', '10', '11', '12', '13'].map((d) => themeForDate(`2026-11-${d}`)))
            .toEqual(['confetti', 'spotlight', 'fireworks', 'shootingStars', 'goldRibbon']);
    });

    it('is the same theme for the same date on every TV', () => {
        expect(themeForDate('2026-11-06')).toBe(themeForDate('2026-11-06'));
        expect(themeForDate('2026-11-06')).toBe('goldRibbon'); // Friday
    });
});

describe('labels', () => {
    it('formats minutes, initials and names for the board', () => {
        expect(minutesLabel(45)).toBe('45m');
        expect(minutesLabel(135)).toBe('2j 15m');
        expect(minutesLabel(null)).toBe('—');
        expect(initialsOf('Budi Santoso Putra')).toBe('BS');
        expect(titleName('YOHANES OCTAVIAN')).toBe('Yohanes Octavian');
    });
});

describe('playFanfare', () => {
    const fakeContext = (state: AudioContextState) => {
        const node = () => ({ connect: vi.fn(function (this: unknown, n: unknown) { return n; }), gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } });
        const oscillators: Array<{ start: ReturnType<typeof vi.fn> }> = [];
        return {
            oscillators,
            ctx: {
                state, currentTime: 10, destination: {},
                createGain: vi.fn(node),
                createOscillator: vi.fn(() => {
                    const osc = { ...node(), type: '', frequency: { value: 0 }, start: vi.fn(), stop: vi.fn() };
                    oscillators.push(osc);
                    return osc;
                }),
            } as unknown as AudioContext,
        };
    };

    it('schedules every note on an unlocked context', () => {
        const { ctx, oscillators } = fakeContext('running');
        expect(playFanfare(ctx)).toBe(true);
        expect(oscillators).toHaveLength(FANFARE_NOTES.length);
    });

    it('does nothing while the browser still blocks audio', () => {
        const { ctx, oscillators } = fakeContext('suspended');
        expect(playFanfare(ctx)).toBe(false);
        expect(oscillators).toHaveLength(0);
        expect(playFanfare(null)).toBe(false);
    });
});
