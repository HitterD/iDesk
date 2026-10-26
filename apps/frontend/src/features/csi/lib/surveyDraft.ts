import { createModuleLogger } from '@/lib/logger';
import type { CsiOpenForm } from '../types';
import type { CsiComments, CsiScores } from './csiForm';

/**
 * Respondent answers kept in `localStorage` so a refresh or closed tab does not lose them.
 * `position`: 0 = intro, 1..n = ratee screens, n + 1 = review.
 */
export interface SurveyDraft {
    departmentId: string;
    scores: CsiScores;
    comments: CsiComments;
    position: number;
}

const KEY_PREFIX = 'csi-draft';
const MIN_SCORE = 1;
const MAX_SCORE = 5;
const log = createModuleLogger('csi-draft');

export const draftKey = (userId: string, periodId: string) => `${KEY_PREFIX}:${userId}:${periodId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isScore = (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= MIN_SCORE && (value as number) <= MAX_SCORE;

function pick<T>(source: unknown, allowed: ReadonlySet<string>, accept: (value: unknown) => value is T): Record<string, T> {
    if (!isRecord(source)) return {};
    return Object.fromEntries(Object.entries(source).filter(([id, value]) => allowed.has(id) && accept(value))) as Record<string, T>;
}

/** Keeps only answers that still match the form (ratees/dimensions may change while the period is open). */
function sanitize(raw: unknown, form: CsiOpenForm): SurveyDraft | null {
    if (!isRecord(raw)) return null;
    const dimensionIds = new Set(form.ratees.flatMap((ratee) => ratee.dimensions.map((dimension) => dimension.periodRateeDimensionId)));
    const rateeIds = new Set(form.ratees.map((ratee) => ratee.periodRateeId));
    const departmentId = form.departments.some((department) => department.id === raw.departmentId) ? String(raw.departmentId) : '';
    const position = Number.isFinite(raw.position) ? Math.trunc(raw.position as number) : 0;
    return {
        departmentId,
        scores: pick(raw.scores, dimensionIds, isScore),
        comments: pick(raw.comments, rateeIds, (value): value is string => typeof value === 'string'),
        position: Math.min(Math.max(position, 0), form.ratees.length + 1),
    };
}

/** Storage can throw (quota, private mode, disabled); a draft is a convenience, so failures only warn. */
function attempt<T>(action: string, run: () => T, fallback: T): T {
    try {
        return run();
    } catch (error) {
        log.warn(`Draft ${action} failed`, error);
        return fallback;
    }
}

export function loadDraft(key: string, form: CsiOpenForm): SurveyDraft | null {
    return attempt('load', () => {
        const stored = localStorage.getItem(key);
        return stored === null ? null : sanitize(JSON.parse(stored), form);
    }, null);
}

export function saveDraft(key: string, draft: SurveyDraft): void {
    attempt('save', () => localStorage.setItem(key, JSON.stringify(draft)), undefined);
}

export function clearDraft(key: string): void {
    attempt('clear', () => localStorage.removeItem(key), undefined);
}
