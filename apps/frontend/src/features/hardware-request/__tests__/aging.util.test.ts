import { describe, it, expect } from 'vitest';
import { agingTone, daysSince } from '../utils/aging.util';
describe('aging', () => {
    it('none under 3 days', () => expect(agingTone(2)).toBe('none'));
    it('yellow 3-7', () => expect(agingTone(5)).toBe('yellow'));
    it('red >7', () => expect(agingTone(8)).toBe('red'));
});
