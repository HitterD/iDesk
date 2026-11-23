import { accessGroupOf, daysLeft, ACCESS_SOON_DAYS } from './access-groups';

const TODAY = new Date('2026-11-23T05:00:00Z');

describe('access groups', () => {
    it('daysLeft counts whole days from today (WIB date), negative once past', () => {
        expect(daysLeft('2026-11-30', TODAY)).toBe(7);
        expect(daysLeft('2026-11-23', TODAY)).toBe(0);
        expect(daysLeft('2026-11-20', TODAY)).toBe(-3);
    });

    it('permanent has no end date; soon is within 7 days; expired is before today; the rest is active', () => {
        expect(ACCESS_SOON_DAYS).toBe(7);
        expect(accessGroupOf(null, TODAY)).toBe('permanent');
        expect(accessGroupOf('', TODAY)).toBe('permanent');
        expect(accessGroupOf('2026-11-30', TODAY)).toBe('soon');
        expect(accessGroupOf('2026-11-23', TODAY)).toBe('soon');
        expect(accessGroupOf('2026-12-01', TODAY)).toBe('active');
        expect(accessGroupOf('2026-11-22', TODAY)).toBe('expired');
    });
});
