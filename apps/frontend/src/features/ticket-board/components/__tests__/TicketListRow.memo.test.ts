import { describe, it, expect } from 'vitest';
import { TicketListRow } from '../TicketListRow';

// Regression guard for Task 2.5 perf fix: TicketListRow must stay memoized,
// otherwise every list-level state change re-renders all rows (measured
// ~45ms/commit in docs/superpowers/evidence/2026-08-03-frontend-profile.md).
describe('TicketListRow memoization', () => {
    it('is wrapped in React.memo', () => {
        expect((TicketListRow as unknown as { $$typeof: symbol }).$$typeof).toBe(
            Symbol.for('react.memo')
        );
    });
});
