import { forEachWithConcurrency } from '../concurrency.util';

describe('forEachWithConcurrency', () => {
    it('never runs more than the limit at once and still processes every item', async () => {
        let running = 0;
        let peak = 0;
        const done: number[] = [];

        await forEachWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 5));
            done.push(n);
            running -= 1;
        });

        expect(peak).toBe(3);
        expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('keeps going when one item fails, so one bad recipient does not stop the rest', async () => {
        const done: number[] = [];
        await forEachWithConcurrency([1, 2, 3], 2, async (n) => {
            if (n === 2) throw new Error('boom');
            done.push(n);
        });
        expect(done.sort()).toEqual([1, 3]);
    });
});
