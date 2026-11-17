/** Read-only viewers see counts and per-department totals, never who the raters are. */
type NamedRater = { user?: unknown; userId?: string; answered?: boolean };

export function redactRaters<T extends NamedRater>(raters: T[]) {
    return raters.map((rater) => ({ ...rater, userId: '', user: { id: '', fullName: 'Penilai (disembunyikan)', email: null, jobTitle: null } }));
}

type RespondentsResult = { submitted: unknown[]; pending: unknown[] | null };

export function redactRespondents<T extends RespondentsResult>(result: T): T {
    return { ...result, submitted: [], pending: result.pending === null ? null : [] };
}
