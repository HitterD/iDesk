import type { CsiOpenForm, SubmitCsiResponse } from '../types';

/** Mirrors backend `CSI_COMMENT_MAX`; the backend stays the authority. */
export const CSI_COMMENT_MAX = 1000;

export const CSI_HTTP_NOT_FOUND = 404;
export const CSI_HTTP_CONFLICT = 409;
export const CSI_HTTP_GONE = 410;

export const CSI_MESSAGES = {
    notFound: 'Survei tidak ditemukan',
    alreadySubmitted: 'Anda sudah mengisi survei ini',
    ended: 'Periode penilaian sudah berakhir',
    submitFailed: 'Gagal mengirim survei. Silakan coba lagi.',
} as const;

/** Score per `periodRateeDimensionId`; 0/absent means not rated yet. */
export type CsiScores = Readonly<Record<string, number>>;
/** Free-text suggestion per `periodRateeId`. */
export type CsiComments = Readonly<Record<string, string>>;

type Ratee = CsiOpenForm['ratees'][number];

export function countDimensions(form: CsiOpenForm): number {
    return form.ratees.reduce((total, ratee) => total + ratee.dimensions.length, 0);
}

export function countRated(form: CsiOpenForm, scores: CsiScores): number {
    return form.ratees.reduce((total, ratee) =>
        total + ratee.dimensions.filter((dimension) => (scores[dimension.periodRateeDimensionId] ?? 0) > 0).length, 0);
}

export function rateeAverage(ratee: Ratee, scores: CsiScores): number {
    if (!ratee.dimensions.length) return 0;
    const sum = ratee.dimensions.reduce((total, dimension) => total + (scores[dimension.periodRateeDimensionId] ?? 0), 0);
    return sum / ratee.dimensions.length;
}

const AVERAGE_FORMAT = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatAverage = (value: number) => AVERAGE_FORMAT.format(value);

export function buildSubmitPayload(form: CsiOpenForm, departmentId: string, scores: CsiScores, comments: CsiComments): SubmitCsiResponse {
    const items = form.ratees.flatMap((ratee) => ratee.dimensions.map((dimension) => ({
        periodRateeDimensionId: dimension.periodRateeDimensionId,
        score: scores[dimension.periodRateeDimensionId] ?? 0,
    })));
    const filled = form.ratees.flatMap((ratee) => {
        const comment = (comments[ratee.periodRateeId] ?? '').trim();
        return comment ? [{ periodRateeId: ratee.periodRateeId, comment }] : [];
    });
    return filled.length ? { departmentId, items, comments: filled } : { departmentId, items };
}

/** HTTP status of an axios-style error, if any. */
export function errorStatus(error: unknown): number | undefined {
    return (error as { response?: { status?: number } } | null)?.response?.status;
}

/** Server-provided message of an axios-style error, if it is a plain string. */
export function errorMessage(error: unknown): string | undefined {
    const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
    return typeof message === 'string' ? message : undefined;
}
