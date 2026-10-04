import { describe, it, expect } from 'vitest';
import { nextPollDelay } from '../useDesktopNotifierSync';

describe('desktop notifier polling backoff', () => {
    it('backs off exponentially while the notifier is unreachable, capped at 60s', () => {
        let delay = 1_000;
        const seen: number[] = [];
        for (let i = 0; i < 8; i++) {
            delay = nextPollDelay(delay, false);
            seen.push(delay);
        }
        expect(seen).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
    });

    it('returns to fast polling as soon as the notifier answers', () => {
        expect(nextPollDelay(60_000, true)).toBe(1_000);
    });
});
