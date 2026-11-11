import { normalizeName } from './csi-name-match';

export type SuggestCandidate = {
    id: string; fullName: string; email: string; employeeId: string | null;
    siteId: string | null; siteCode: string | null; department: string | null;
};
export type AccountSuggestion = SuggestCandidate & { score: number };
const MIN_SCORE = 0.35;
const SITE_BOOST = 0.15;
const DEFAULT_LIMIT = 8;
const BIGRAM_WEIGHT = 0.5;

function bigrams(name: string): string[] {
    return Array.from({ length: Math.max(0, name.length - 1) }, (_, index) => name.slice(index, index + 2));
}

/** Count repeated bigrams too: Dice compares multisets rather than dropping repeated letters. */
function dice(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const left = bigrams(a);
    const right = bigrams(b);
    const counts = new Map<string, number>();
    right.forEach((pair) => counts.set(pair, (counts.get(pair) ?? 0) + 1));
    let intersection = 0;
    for (const pair of left) {
        const count = counts.get(pair) ?? 0;
        if (count) { intersection += 1; counts.set(pair, count - 1); }
    }
    return left.length + right.length ? 2 * intersection / (left.length + right.length) : 0;
}

/** Suggestions only, never identity resolution: token Jaccard plus space-insensitive bigram Dice. */
export function nameSimilarity(a: string, b: string): number {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right) return 0;
    const leftTokens = new Set(left.split(' '));
    const rightTokens = new Set(right.split(' '));
    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return intersection / union + BIGRAM_WEIGHT * dice(left.replace(/ /g, ''), right.replace(/ /g, ''));
}

export function suggestAccounts(name: string, accounts: SuggestCandidate[], opts: { siteId?: string | null; limit?: number }): AccountSuggestion[] {
    if (!normalizeName(name)) return [];
    return accounts.map((account) => ({
        ...account, score: nameSimilarity(name, account.fullName) + (opts.siteId != null && account.siteId === opts.siteId ? SITE_BOOST : 0),
    })).filter((account) => account.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
        .slice(0, opts.limit ?? DEFAULT_LIMIT);
}
