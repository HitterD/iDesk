import { useMemo } from 'react';
import type { ZoomAccount } from '../types';

/**
 * Pick the most-free account from a list, given a meetings-per-account map.
 * Tie-breaker: account id ascending (deterministic).
 * Returns `undefined` when accounts is empty.
 */
export function useMostFreeAccount(
    accounts: ZoomAccount[],
    meetingsPerAccount: Map<string, number>,
): ZoomAccount | undefined {
    return useMemo(() => {
        if (accounts.length === 0) return undefined;
        const sorted = [...accounts].sort((a, b) => {
            const countA = meetingsPerAccount.get(a.id) ?? 0;
            const countB = meetingsPerAccount.get(b.id) ?? 0;
            if (countA !== countB) return countA - countB;
            return a.id.localeCompare(b.id);
        });
        return sorted[0];
    }, [accounts, meetingsPerAccount]);
}
