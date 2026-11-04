import type { CsiFormDimension, CsiFormRatee, CsiOpenForm, SubmitCsiItem, SubmitCsiResponse } from '../types';

/** Mirror backend limits; the backend stays the authority. */
export const CSI_COMMENT_MAX = 1000;
export const CSI_ANSWER_TEXT_MAX = 1000;
export const CSI_NAME_MIN = 2;
export const CSI_NAME_MAX = 150;
export const CSI_SCORE_MIN = 1;
export const CSI_SCORE_MAX = 5;

export const CSI_HTTP_NOT_FOUND = 404;
export const CSI_HTTP_CONFLICT = 409;
export const CSI_HTTP_GONE = 410;

export const CSI_MESSAGES = {
    notFound: 'Survei tidak ditemukan',
    alreadySubmitted: 'Anda sudah mengisi survei ini',
    ended: 'Periode penilaian sudah berakhir',
    submitFailed: 'Gagal mengirim survei. Silakan coba lagi.',
} as const;

/** One answer: which field is set depends on the question type. */
export interface CsiAnswer { score?: number; optionIndex?: number; text?: string }
/** Answer per `periodRateeDimensionId`; absent means not answered. */
export type CsiAnswers = Readonly<Record<string, CsiAnswer>>;
/** Free-text suggestion per `periodRateeId`. */
export type CsiComments = Readonly<Record<string, string>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** The valid part of an answer for this question, or null when nothing usable is there (also used to sanitise drafts). */
export function normalizeAnswer(dimension: CsiFormDimension, raw: unknown): CsiAnswer | null {
    if (!isRecord(raw)) return null;
    if (dimension.type === 'STAR') {
        const { score } = raw;
        return Number.isInteger(score) && (score as number) >= CSI_SCORE_MIN && (score as number) <= CSI_SCORE_MAX ? { score: score as number } : null;
    }
    if (dimension.type === 'TEXT') {
        const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, CSI_ANSWER_TEXT_MAX) : '';
        return text ? { text } : null;
    }
    const { optionIndex } = raw;
    return Number.isInteger(optionIndex) && (optionIndex as number) >= 0 && (optionIndex as number) < dimension.options.length
        ? { optionIndex: optionIndex as number } : null;
}

export const isAnswered = (dimension: CsiFormDimension, answers: CsiAnswers) =>
    normalizeAnswer(dimension, answers[dimension.periodRateeDimensionId]) !== null;

/** Required questions of a ratee that still lack an answer. */
export const missingRequired = (ratee: CsiFormRatee, answers: CsiAnswers) =>
    ratee.dimensions.filter((dimension) => dimension.required && !isAnswered(dimension, answers));

export const hasRequired = (ratee: CsiFormRatee) => ratee.dimensions.some((dimension) => dimension.required);

/** Questions across all screens (drives the time estimate). */
export const countDimensions = (form: CsiOpenForm): number =>
    form.ratees.reduce((total, ratee) => total + ratee.dimensions.length, 0);

/** The team section always comes first; everything else keeps the server order. */
export const orderRatees = (ratees: CsiFormRatee[]): CsiFormRatee[] =>
    [...ratees.filter((ratee) => ratee.kind === 'TEAM'), ...ratees.filter((ratee) => ratee.kind !== 'TEAM')];

/** 1-5 value of a STAR/SCALE answer; CHOICE and TEXT are never scored. */
function scoreOf(dimension: CsiFormDimension, answers: CsiAnswers): number | null {
    const answer = normalizeAnswer(dimension, answers[dimension.periodRateeDimensionId]);
    if (!answer) return null;
    if (dimension.type === 'STAR') return answer.score ?? null;
    if (dimension.type === 'SCALE') return dimension.options[answer.optionIndex ?? -1]?.points ?? null;
    return null;
}

/** Average of the scored (STAR + SCALE) answers; null when there are none. */
export function rateeAverage(ratee: CsiFormRatee, answers: CsiAnswers): number | null {
    const scores = ratee.dimensions.map((dimension) => scoreOf(dimension, answers)).filter((value): value is number => value !== null);
    return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}

/** Answered CHOICE/TEXT questions: shown as a count on the review screen. */
export const otherAnswerCount = (ratee: CsiFormRatee, answers: CsiAnswers): number =>
    ratee.dimensions.filter((dimension) => (dimension.type === 'CHOICE' || dimension.type === 'TEXT') && isAnswered(dimension, answers)).length;

export const isNameValid = (name: string) => name.trim().length >= CSI_NAME_MIN && name.trim().length <= CSI_NAME_MAX;

/** The account already answered this survey (one answer per account). */
export const hasAnswered = (form: Pick<CsiOpenForm, 'submittedAt' | 'submittedNames'>) =>
    Boolean(form.submittedAt) || form.submittedNames.length > 0;

export interface SubmitInput { name: string; departmentId: string; answers: CsiAnswers; comments: CsiComments }

export function buildSubmitPayload(form: CsiOpenForm, input: SubmitInput): SubmitCsiResponse {
    const items = form.ratees.flatMap((ratee) => ratee.dimensions.flatMap((dimension): SubmitCsiItem[] => {
        const answer = normalizeAnswer(dimension, input.answers[dimension.periodRateeDimensionId]);
        return answer ? [{ periodRateeDimensionId: dimension.periodRateeDimensionId, ...answer }] : [];
    }));
    const filled = form.ratees.flatMap((ratee) => {
        const comment = (input.comments[ratee.periodRateeId] ?? '').trim();
        return comment ? [{ periodRateeId: ratee.periodRateeId, comment }] : [];
    });
    const base = { respondentName: input.name.trim(), departmentId: input.departmentId, items };
    return filled.length ? { ...base, comments: filled } : base;
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
