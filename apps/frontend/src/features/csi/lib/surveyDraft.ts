import { createModuleLogger } from '@/lib/logger';
import type { CsiOpenForm, CsiServerDraft, SaveCsiDraft } from '../types';
import { CSI_COMMENT_MAX, isNameValid, normalizeAnswer, type CsiAnswer, type CsiAnswers, type CsiComments } from './csiForm';

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
    updatedAt?: string;
}

/** `v2` = typed answers; v1 drafts (stars only) live under the old key and are never read. */
const KEY_PREFIX = 'csi-draft:v2';
const PICK_KEY_PREFIX = 'csi-picks:v1';
const log = createModuleLogger('csi-draft');

export const draftKey = (userId: string, periodId: string) => `${KEY_PREFIX}:${userId}:${periodId}`;
export const pickKey = (userId: string, periodId: string) => `${PICK_KEY_PREFIX}:${userId}:${periodId}`;

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
    const updatedAt = typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : undefined;
    return {
        respondentName: isNameValid(name) ? name : form.respondent.fullName,
        departmentId: form.departments.some((department) => department.id === raw.departmentId) ? String(raw.departmentId) : '',
        answers: sanitizeAnswers(raw.answers, form),
        comments: sanitizeComments(raw.comments, rateeIds),
        position: Math.min(Math.max(position, 0), form.ratees.length + 1),
        ...(updatedAt ? { updatedAt } : {}),
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

export function hasPicks(userId: string, periodId: string): boolean {
    return attempt('check-picks', () => {
        const raw = localStorage.getItem(pickKey(userId, periodId));
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.some((id) => typeof id === 'string' && id.length > 0);
    }, false);
}

export function hasDraft(userId: string, periodId: string): boolean {
    return attempt('check', () => localStorage.getItem(draftKey(userId, periodId)) !== null, false)
        || hasPicks(userId, periodId);
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

function answerPrimitive(dimension: CsiOpenForm['ratees'][number]['dimensions'][number], answer: CsiAnswer | undefined): number | string | null {
    if (!answer) return null;
    if (dimension.type === 'STAR') return typeof answer.score === 'number' ? answer.score : null;
    if (dimension.type === 'TEXT') return answer.text?.trim() ? answer.text : null;
    return typeof answer.optionIndex === 'number' ? answer.optionIndex : null;
}

/** Converts client draft state into the compact server draft payload (`answers[rateeId][dimensionId]`). */
export function toServerDraft(draft: SurveyDraft, form: CsiOpenForm, picks?: string[] | null): SaveCsiDraft {
    const answers: Record<string, Record<string, number | string>> = {};
    for (const ratee of form.ratees) {
        const perRatee: Record<string, number | string> = {};
        for (const dimension of ratee.dimensions) {
            const primitive = answerPrimitive(dimension, draft.answers[dimension.periodRateeDimensionId]);
            if (primitive !== null) perRatee[dimension.periodRateeDimensionId] = primitive;
        }
        if (Object.keys(perRatee).length) answers[ratee.periodRateeId] = perRatee;
    }
    const comments = Object.fromEntries(
        Object.entries(draft.comments).filter(([, text]) => text.trim().length > 0),
    );
    return {
        departmentId: draft.departmentId || null,
        position: draft.position,
        answers,
        comments,
        ...(picks !== undefined ? { picks } : {}),
    };
}

/** Converts a server draft row back into a sanitized `SurveyDraft` matching the active form. */
export function fromServerDraft(server: CsiServerDraft, form: CsiOpenForm): SurveyDraft | null {
    const dimensions = new Map(
        form.ratees.flatMap((ratee) => ratee.dimensions.map((dimension) => [dimension.periodRateeDimensionId, dimension] as const)),
    );
    const rawAnswers: Record<string, CsiAnswer> = {};
    for (const byDim of Object.values(server.answers ?? {})) {
        if (!isRecord(byDim)) continue;
        for (const [dimId, value] of Object.entries(byDim)) {
            const dim = dimensions.get(dimId);
            if (!dim) continue;
            if (dim.type === 'STAR' && typeof value === 'number') rawAnswers[dimId] = { score: value };
            else if (dim.type === 'TEXT' && typeof value === 'string') rawAnswers[dimId] = { text: value };
            else if ((dim.type === 'SCALE' || dim.type === 'CHOICE') && typeof value === 'number') rawAnswers[dimId] = { optionIndex: value };
        }
    }
    return sanitize({
        respondentName: form.respondent.fullName,
        departmentId: server.departmentId ?? '',
        answers: rawAnswers,
        comments: server.comments ?? {},
        position: server.position ?? 0,
        updatedAt: server.updatedAt,
    }, form);
}
