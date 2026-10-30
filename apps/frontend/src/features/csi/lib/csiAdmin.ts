import type { TicketPillTone } from '@/components/ui/ticket-pill';
import type {
    CsiPeriodDetail, CsiPeriodStatus, CsiPublishStatus, CsiRespondentMode, CsiScope, CsiScopeParam, SetCsiRatees,
} from '../types';

export const CSI_ADMIN_SCOPES = ['ict', 'hc'] as const satisfies readonly CsiScopeParam[];

/** Mirrors backend `CSI_ADMIN_PAGE_KEY`; no ADMIN bypass for these keys. */
export const CSI_ADMIN_PAGE_KEYS: Readonly<Record<CsiScopeParam, string>> = {
    ict: 'csi_admin_ict',
    hc: 'csi_admin_hc',
};
export const CSI_ADMIN_ROLES: readonly string[] = ['ADMIN', 'MANAGER'];

export const CSI_SCOPE_OF: Readonly<Record<CsiScopeParam, CsiScope>> = { ict: 'ICT', hc: 'HC' };

/** Mirrors backend `DEFAULT_RESPONDENT_MODE`. */
export const CSI_DEFAULT_MODE: Readonly<Record<CsiScopeParam, CsiRespondentMode>> = { ict: 'LISTED', hc: 'LISTED' };

export const CSI_MODE_LABELS: Readonly<Record<CsiRespondentMode, string>> = {
    OPEN: 'Semua user di site',
    LISTED: 'Hanya penilai terdaftar',
};

export const CSI_STATUS_LABELS: Readonly<Record<CsiPeriodStatus, string>> = {
    UPCOMING: 'Akan datang',
    ACTIVE: 'Aktif',
    ENDED: 'Selesai',
};
export const CSI_STATUS_TONES: Readonly<Record<CsiPeriodStatus, TicketPillTone>> = {
    UPCOMING: 'sky',
    ACTIVE: 'green',
    ENDED: 'neutral',
};

export const CSI_PUBLISH_LABELS: Readonly<Record<CsiPublishStatus, string>> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Terbit',
};
export const CSI_PUBLISH_TONES: Readonly<Record<CsiPublishStatus, TicketPillTone>> = {
    DRAFT: 'amber',
    PUBLISHED: 'navy',
};

/** Mirrors backend reset DTO bounds. */
export const CSI_RESET_REASON_MIN = 5;
export const CSI_RESET_REASON_MAX = 500;
/** Mirrors backend period DTO bounds. */
export const CSI_TITLE_MAX = 150;
export const CSI_TEXT_MAX = 2000;
export const CSI_NAME_MAX = 100;
export const CSI_DESCRIPTION_MAX = 300;
/** Mirrors backend question DTO / constants bounds. */
export const CSI_QUESTION_MAX = 300;
export const CSI_OPTION_LABEL_MAX = 200;
export const CSI_OPTIONS_MIN = 2;
export const CSI_OPTIONS_MAX = 10;
export const CSI_SCORE_MIN = 1;
export const CSI_SCORE_MAX = 5;

export const CSI_LOCKED_NOTE = 'Terkunci karena sudah ada jawaban';
export const CSI_SEARCH_DEBOUNCE_MS = 300;

export const isCsiScopeParam = (value: string | undefined): value is CsiScopeParam =>
    (CSI_ADMIN_SCOPES as readonly string[]).includes(value ?? '');

export const csiAdminPath = (basePath: string, scope: CsiScopeParam) => `${basePath}/admin/${scope}`;

/** One ratee in the local assignment draft (snapshot fields only for display). */
export interface RateeDraft {
    userId: string;
    displayName: string;
    jobTitle: string | null;
    dimensionIds: readonly string[];
}

export interface DraftUser {
    id: string;
    fullName: string;
    jobTitle: string | null;
}

export function draftFromPeriod(period: CsiPeriodDetail): RateeDraft[] {
    const people = [...period.ratees].filter((ratee) => ratee.kind === 'PERSON').sort((a, b) => a.sortOrder - b.sortOrder);
    return people.flatMap((ratee) => ratee.userId === null ? [] : [{
        userId: ratee.userId,
        displayName: ratee.displayName,
        jobTitle: ratee.jobTitle,
        dimensionIds: ratee.dimensions.map((dimension) => dimension.dimensionId),
    }]);
}

/** Orders dimension IDs by the master order; unknown IDs keep their relative order at the end. */
export function orderDimensions(ids: readonly string[], masterOrder: readonly string[]): string[] {
    const rank = (id: string) => {
        const index = masterOrder.indexOf(id);
        return index === -1 ? masterOrder.length : index;
    };
    return [...ids].sort((a, b) => rank(a) - rank(b));
}

/** Applies one dimension set to many users: existing rows get their dimensions replaced, new users are appended. */
export function mergeRatees(draft: readonly RateeDraft[], users: readonly DraftUser[], dimensionIds: readonly string[]): RateeDraft[] {
    const byUser = new Map(users.map((user) => [user.id, user]));
    const replaced = draft.map((row) => byUser.has(row.userId) ? { ...row, dimensionIds: [...dimensionIds] } : row);
    const known = new Set(draft.map((row) => row.userId));
    const added = users.filter((user) => !known.has(user.id)).map((user) => ({
        userId: user.id, displayName: user.fullName, jobTitle: user.jobTitle, dimensionIds: [...dimensionIds],
    }));
    return [...replaced, ...added];
}

export function toRateesPayload(draft: readonly RateeDraft[], masterOrder: readonly string[]): SetCsiRatees {
    return { ratees: draft.map((row) => ({ userId: row.userId, dimensionIds: orderDimensions(row.dimensionIds, masterOrder) })) };
}

export const sameIds = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export const CSI_EXPORT_FAILED = 'Gagal mengekspor laporan. Silakan coba lagi.';

/** Server message of a failed blob request (JSON error body read as text); falls back to a generic message. */
export async function blobErrorMessage(error: unknown): Promise<string> {
    const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
    if (!(data instanceof Blob)) return CSI_EXPORT_FAILED;
    try {
        const message: unknown = JSON.parse(await data.text())?.message;
        if (typeof message === 'string' && message) return message;
        if (Array.isArray(message) && message.length) return message.join(', ');
    } catch {
        // Not JSON (e.g. proxy HTML): keep the generic message.
    }
    return CSI_EXPORT_FAILED;
}

/** Starts a browser download for a blob and always releases the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Identity of the server-side ratee assignment; changes only when the saved content or lock changes. */
export const rateesSignature = (period: CsiPeriodDetail) => JSON.stringify([
    period.locked, draftFromPeriod(period).map((row) => [row.userId, row.dimensionIds]),
]);

/** Identity of the server-side period raters; changes only when the saved raters or lock changes. */
export const ratersSignature = (period: CsiPeriodDetail) => JSON.stringify([period.locked, period.raters.map((rater) => rater.userId)]);
