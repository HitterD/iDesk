import { describe, expect, it, vi } from 'vitest';
import { FANFARE_NOTES, LEADERBOARD_THEMES, fanfareWave, initialsOf, isPixelTheme, minutesLabel, playFanfare, themeForDate, titleName } from '../tvLeaderboard';

describe('themeForDate', () => {
    it('gives each of the nine looks its own working day, in turn', () => {
        // 2026-11-09 is a Monday; two working weeks cover all nine and start over.
        const days = ['09', '10', '11', '12', '13', '16', '17', '18', '19', '20'].map((d) => themeForDate(`2026-11-${d}`));
        expect(new Set(days.slice(0, 9)).size).toBe(9);
        expect(days[9]).toBe(days[0]);
        expect(LEADERBOARD_THEMES).toHaveLength(9);
    });

    it("does not repeat last week's Monday look", () => {
        expect(themeForDate('2026-11-16')).not.toBe(themeForDate('2026-11-09'));
    });

    it("is the same look for the same date on every TV, and a weekend keeps Friday's", () => {
        expect(themeForDate('2026-11-06')).toBe(themeForDate('2026-11-06'));
        expect(themeForDate('2026-11-07')).toBe(themeForDate('2026-11-06'));
        expect(themeForDate('2026-11-08')).toBe(themeForDate('2026-11-06'));
    });

    it('plays the 8-bit fanfare only on the pixel looks', () => {
        expect(fanfareWave('arcadeMaze')).toBe('square');
        expect(fanfareWave('racing')).toBe('triangle');
        expect(isPixelTheme('pixelForest')).toBe(true);
        expect(isPixelTheme('hexTech')).toBe(false);
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
