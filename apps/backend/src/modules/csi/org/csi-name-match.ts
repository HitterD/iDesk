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
