import { describe, expect, it } from 'vitest';
import { PAUSE_MS, stepAutoScroll } from '../useColumnAutoScroll';

describe('stepAutoScroll', () => {
    it('moves through ping-pong phases and stays still when content fits', () => {
        expect(stepAutoScroll(
            { phase: 'pause-top', scrollTop: 0, elapsedMs: PAUSE_MS - 1 },
            1,
            100,
        )).toEqual({ phase: 'down', scrollTop: 0, elapsedMs: 0 });

        expect(stepAutoScroll(
            { phase: 'down', scrollTop: 99, elapsedMs: 0 },
            100,
            100,
        )).toEqual({ phase: 'pause-bottom', scrollTop: 100, elapsedMs: 0 });

        expect(stepAutoScroll(
            { phase: 'pause-bottom', scrollTop: 100, elapsedMs: PAUSE_MS - 1 },
            1,
            100,
        )).toEqual({ phase: 'up', scrollTop: 100, elapsedMs: 0 });

        expect(stepAutoScroll(
            { phase: 'up', scrollTop: 1, elapsedMs: 0 },
            100,
            100,
        )).toEqual({ phase: 'pause-top', scrollTop: 0, elapsedMs: 0 });

        expect(stepAutoScroll(
            { phase: 'down', scrollTop: 0, elapsedMs: 0 },
            16,
            0,
        )).toEqual({ phase: 'pause-top', scrollTop: 0, elapsedMs: 0 });
    });
});
