import type { CsiRespondents, CsiSla } from '../../../types';

const PERCENT = 100;

export type PersonFilter = 'all' | 'todo' | 'done';
export interface PersonRow {
    key: string;
    /** Account user id; reminders target it (LISTED pending rows only). */
    userId: string | null;
    name: string;
    detail: string;
    siteId: string | null;
    done: boolean;
    responseId: string | null;
    submittedAt: string | null;
}

export interface Progress { done: number; total: number; target: number; pct: number; reached: boolean }

export const targetOf = (total: number, targetPct: number) => Math.ceil((total * targetPct) / PERCENT);

export function progressOf(done: number, total: number, targetPct: number): Progress {
    const target = targetOf(total, targetPct);
    return { done, total, target, pct: total > 0 ? Math.min(PERCENT, (done / total) * PERCENT) : 0, reached: total > 0 && done >= target };
}

/**
 * LISTED: registered raters (answered + not yet) against the period target.
 * OPEN: the SLA basis (ticket reporters) and its target; there is no rater list.
 */
export function overallProgress(data: CsiRespondents, sla: CsiSla): Progress {
    if (data.mode === 'OPEN') return progressOf(sla.responses, sla.basis, sla.targetPct);
    return progressOf(data.totals.submitted, data.totals.submitted + (data.totals.pending ?? 0), sla.targetPct);
}

/** Not-yet rows first (by name), then answers in submit order. */
export function personRows(data: CsiRespondents): PersonRow[] {
    const pending: PersonRow[] = (data.pending ?? []).map((person) => ({
        key: `u:${person.userId}`, userId: person.userId, name: person.fullName, detail: person.department ?? '',
        siteId: person.siteId, done: false, responseId: null, submittedAt: null,
    }));
    const submitted: PersonRow[] = data.submitted.map((item) => ({
        key: `r:${item.responseId}`, userId: item.userId, name: item.respondentName,
        detail: `${item.departmentName} · Akun: ${item.accountName}`, siteId: item.siteId, done: true,
        responseId: item.responseId, submittedAt: item.submittedAt,
    }));
    return [...pending, ...submitted];
}

export function filterRows(rows: readonly PersonRow[], { site, search }: { site: string | null; search: string }) {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => (site === null || row.siteId === site)
        && (!term || row.name.toLowerCase().includes(term) || row.detail.toLowerCase().includes(term)));
}

export const countByFilter = (rows: readonly PersonRow[]): Record<PersonFilter, number> => ({
    all: rows.length, todo: rows.filter((row) => !row.done).length, done: rows.filter((row) => row.done).length,
});

export const matchesFilter = (filter: PersonFilter) => (row: PersonRow) => filter === 'all' || (filter === 'done') === row.done;
