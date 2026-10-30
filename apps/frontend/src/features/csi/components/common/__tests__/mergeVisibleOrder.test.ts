import { describe, expect, it } from 'vitest';
import { mergeVisibleOrder } from '../mergeVisibleOrder';

describe('mergeVisibleOrder', () => {
    it('keeps hidden ids at their positions and fills the visible slots in the new order', () => {
        expect(mergeVisibleOrder(['a', 'x', 'b', 'y', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'x', 'a', 'y', 'b']);
    });

    it('returns the visible order when nothing is hidden', () => {
        expect(mergeVisibleOrder(['a', 'b', 'c'], ['b', 'c', 'a'])).toEqual(['b', 'c', 'a']);
    });

    it('always contains every id exactly once and does not mutate its input', () => {
        const all = ['a', 'x', 'b'];
        const result = mergeVisibleOrder(all, ['b', 'a']);
        expect([...result].sort()).toEqual(['a', 'b', 'x']);
        expect(all).toEqual(['a', 'x', 'b']);
    });

    it('ignores visible ids that are unknown', () => {
        expect(mergeVisibleOrder(['a', 'b'], ['b', 'zzz', 'a'])).toEqual(['b', 'a']);
    });
});
