/** Name key for matching people across files without a NIK: upper case, single spaces, no dots or commas. */
export function normalizeName(value: string | null | undefined): string {
    return (value ?? '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The single candidate whose name matches, 'ambiguous' when several do, null when none does. */
export function matchByName<T>(name: string, candidates: readonly T[], nameOf: (row: T) => string): T | 'ambiguous' | null {
    const key = normalizeName(name);
    if (!key) return null;
    const hits = candidates.filter((row) => normalizeName(nameOf(row)) === key);
    if (hits.length > 1) return 'ambiguous';
    return hits[0] ?? null;
}

/** Name → the single matching row, 'ambiguous' or null; each candidate name is normalised once (large lists). */
export function buildNameIndex<T>(candidates: readonly T[], nameOf: (row: T) => string): (name: string) => T | 'ambiguous' | null {
    const index = new Map<string, T | 'ambiguous'>();
    candidates.forEach((row) => {
        const key = normalizeName(nameOf(row));
        if (key) index.set(key, index.has(key) ? 'ambiguous' : row);
    });
    return (name) => index.get(normalizeName(name)) ?? null;
}
