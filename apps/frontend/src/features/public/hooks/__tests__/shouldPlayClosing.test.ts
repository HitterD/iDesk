import { describe, expect, it } from 'vitest';
import { shouldPlayClosing, toDateKey } from '../shouldPlayClosing';

const at = (iso: string) => new Date(iso);

describe('toDateKey', () => {
    it('formats a local date as YYYY-MM-DD with zero padding', () => {
        expect(toDateKey(at('2026-03-07T17:00:00'))).toBe('2026-03-07');
    });
});

describe('shouldPlayClosing', () => {
    it('never fires when no closing time is configured', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:00'), null, null)).toBe(false);
    });

    it('fires when the clock matches and it has not fired today', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:30'), '17:00', null)).toBe(true);
    });

    it('does not fire twice within the same minute', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:45'), '17:00', '2026-07-26')).toBe(false);
    });

    it('fires again the next day', () => {
        expect(shouldPlayClosing(at('2026-07-27T17:00:00'), '17:00', '2026-07-26')).toBe(true);
    });

    it('stays silent outside the configured minute', () => {
        expect(shouldPlayClosing(at('2026-07-26T16:59:59'), '17:00', null)).toBe(false);
        expect(shouldPlayClosing(at('2026-07-26T17:01:00'), '17:00', null)).toBe(false);
    });

    it('fires on weekends too', () => {
        expect(shouldPlayClosing(at('2026-07-25T17:00:00'), '17:00', null)).toBe(true);
        expect(shouldPlayClosing(at('2026-07-26T17:00:00'), '17:00', null)).toBe(true);
    });
});
