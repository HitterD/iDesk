import { createModuleLogger } from '@/lib/logger';
import type { CsiOpenForm } from '../types';
import { CSI_COMMENT_MAX, isNameValid, normalizeAnswer, type CsiAnswers, type CsiComments } from './csiForm';

/**
 * Respondent answers kept in `localStorage` so a refresh or closed tab does not lose them.
 * `position`: 0 = intro, 1..n = ratee screens, n + 1 = review.
 */
export interface SurveyDraft {
    respondentName: string;
    departmentId: string;
    answers: CsiAnswers;
    comments: CsiComments;
    position: number;
}

/** `v2` = typed answers; v1 drafts (stars only) live under the old key and are never read. */
const KEY_PREFIX = 'csi-draft:v2';
const log = createModuleLogger('csi-draft');

export const draftKey = (userId: string, periodId: string) => `${KEY_PREFIX}:${userId}:${periodId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** A tampered draft must not restore more text than the textarea (and backend) accept. */
function sanitizeComments(source: unknown, rateeIds: ReadonlySet<string>): CsiComments {
    if (!isRecord(source)) return {};
    return Object.fromEntries(Object.entries(source)
        .filter((entry): entry is [string, string] => rateeIds.has(entry[0]) && typeof entry[1] === 'string')
        .map(([id, text]) => [id, text.slice(0, CSI_COMMENT_MAX)]));
}

function sanitizeAnswers(source: unknown, form: CsiOpenForm): CsiAnswers {
    if (!isRecord(source)) return {};
    const entries = form.ratees.flatMap((ratee) => ratee.dimensions).flatMap((dimension) => {
        const answer = normalizeAnswer(dimension, source[dimension.periodRateeDimensionId]);
        return answer ? [[dimension.periodRateeDimensionId, answer] as const] : [];
    });
    return Object.fromEntries(entries);
}

/** Keeps only answers that still match the form (ratees/questions may change while the period is open). */
function sanitize(raw: unknown, form: CsiOpenForm): SurveyDraft | null {
    if (!isRecord(raw)) return null;
    const rateeIds = new Set(form.ratees.map((ratee) => ratee.periodRateeId));
    const name = typeof raw.respondentName === 'string' ? raw.respondentName.trim() : '';
    const position = Number.isFinite(raw.position) ? Math.trunc(raw.position as number) : 0;
    return {
        respondentName: isNameValid(name) ? name : form.respondent.fullName,
        departmentId: form.departments.some((department) => department.id === raw.departmentId) ? String(raw.departmentId) : '',
        answers: sanitizeAnswers(raw.answers, form),
        comments: sanitizeComments(raw.comments, rateeIds),
        position: Math.min(Math.max(position, 0), form.ratees.length + 1),
    };
}

let warned = false;

/**
 * Storage can throw (quota, private mode, disabled); a draft is a convenience, so failures only warn,
 * and only once per session because autosave would otherwise repeat the same warning on every change.
 */
function attempt<T>(action: string, run: () => T, fallback: T): T {
    try {
        return run();
    } catch (error) {
        if (!warned) {
            warned = true;
            log.warn(`Draft ${action} failed; further storage errors are silenced`, error);
        }
        return fallback;
    }
}

export function hasDraft(userId: string, periodId: string): boolean {
    return attempt('check', () => localStorage.getItem(draftKey(userId, periodId)) !== null, false);
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
