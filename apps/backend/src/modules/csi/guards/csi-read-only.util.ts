/** Read-only viewers see counts and per-department totals, never who the raters are. */
type NamedRater = { user?: unknown; userId?: string; answered?: boolean };

export function redactRaters<T extends NamedRater>(raters: T[]) {
    return raters.map((rater, index) => ({
        ...rater, userId: `anon-${index}`, user: { id: `anon-${index}`, fullName: 'Penilai (disembunyikan)', email: null, jobTitle: null },
    }));
}

type RespondentsResult = {
    submitted: Array<Record<string, unknown>>;
    pending: Array<Record<string, unknown>> | null;
};

/**
 * One row per rater stays (site and answered/pending status feed the per-site progress cards), but every identifying
 * field is blanked: names, account, user id, response id and department.
 */
export function redactRespondents<T extends RespondentsResult>(result: T): T {
    return {
        ...result,
        submitted: result.submitted.map((row, index) => ({
            ...row, responseId: `anon-r-${index}`, userId: `anon-s-${index}`, respondentName: 'Penilai', accountName: '', departmentName: '',
        })),
        pending: result.pending === null ? null : result.pending.map((row, index) => ({
            ...row, userId: `anon-p-${index}`, fullName: 'Penilai', department: null,
        })),
    };
}
