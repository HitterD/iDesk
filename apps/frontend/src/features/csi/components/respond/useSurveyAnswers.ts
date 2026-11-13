import { useEffect, useRef, useState } from 'react';
import type { CsiOpenForm } from '../../types';
import { isAnswered, isCommentFilled, missingRequired, type CsiAnswer, type CsiAnswers, type CsiComments } from '../../lib/csiForm';
import { draftKey, loadDraft, saveDraft, type SurveyDraft } from '../../lib/surveyDraft';

const SAVE_DEBOUNCE_MS = 300;

type Ratee = CsiOpenForm['ratees'][number];

/** Index of the first ratee with an unanswered required question, or -1 when all are complete. */
export const firstIncomplete = (form: CsiOpenForm, answers: CsiAnswers) =>
    form.ratees.findIndex((ratee) => missingRequired(ratee, answers).length > 0);

/** Chip tick: the screen was visited and every required question on it is answered. */
export const isRateeComplete = (ratee: Ratee, answers: CsiAnswers, visited: boolean) =>
    visited && missingRequired(ratee, answers).length === 0;

/** Screens a restored draft already answered or commented on count as visited. */
export const answeredScreens = (form: CsiOpenForm, answers: CsiAnswers, comments: CsiComments = {}): number[] =>
    form.ratees.flatMap((ratee, index) => (
        ratee.dimensions.some((dimension) => isAnswered(dimension, answers)) || isCommentFilled(comments[ratee.periodRateeId]) ? [index] : []
    ));

/** A restored draft must not land past a screen whose prerequisites are gone (department removed, new questions). */
function resumePosition(form: CsiOpenForm, draft: SurveyDraft): number {
    if (!draft.departmentId) return 0;
    const reviewPosition = form.ratees.length + 1;
    if (draft.position < reviewPosition) return draft.position;
    const pending = firstIncomplete(form, draft.answers);
    return pending === -1 ? reviewPosition : pending + 1;
}

const emptyDraft = (respondentName: string, departmentId: string): SurveyDraft =>
    ({ respondentName, departmentId, answers: {}, comments: {}, position: 0 });

/** The identity always follows the account; a locked department wins over whatever a draft remembered. */
function initialState(form: CsiOpenForm, key: string | null, lockedDepartment: string | null): { draft: SurveyDraft; resumed: boolean } {
    const stored = key ? loadDraft(key, form) : null;
    if (!stored) return { draft: emptyDraft(form.respondent.fullName, lockedDepartment ?? ''), resumed: false };
    const draft = { ...stored, respondentName: form.respondent.fullName, departmentId: lockedDepartment ?? stored.departmentId };
    return { draft: { ...draft, position: resumePosition(form, draft) }, resumed: true };
}

/** Debounced autosave; also flushed on `pagehide`, on unmount, and right before submit. */
function useDraftAutosave(key: string | null, draft: SurveyDraft) {
    const latest = useRef({ key, draft });
    const pending = useRef(false);
    const flush = useRef(() => {
        const { key: target, draft: answers } = latest.current;
        if (!target || !pending.current) return;
        pending.current = false;
        saveDraft(target, answers);
    });

    useEffect(() => {
        latest.current = { key, draft };
    }, [key, draft]);
    useEffect(() => {
        const save = flush.current;
        window.addEventListener('pagehide', save);
        // In-app navigation (back link, route change) inside the debounce window keeps the last answer.
        return () => {
            window.removeEventListener('pagehide', save);
            save();
        };
    }, []);
    const schedule = () => {
        pending.current = true;
    };
    useEffect(() => {
        if (!pending.current) return undefined;
        const timer = window.setTimeout(flush.current, SAVE_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [draft]);
    return { schedule, flush: () => flush.current() };
}

/**
 * Respondent answers + current screen. In live mode every change is autosaved (debounced) to
 * `localStorage`; preview mode never reads or writes storage.
 */
export function useSurveyAnswers(form: CsiOpenForm, userId: string, live: boolean, lockedDepartment: string | null = null) {
    const key = live && userId ? draftKey(userId, form.id) : null;
    const [{ draft: initial, resumed }] = useState(() => initialState(form, key, lockedDepartment));
    const [draft, setDraft] = useState<SurveyDraft>(initial);
    const autosave = useDraftAutosave(key, draft);

    const update = (patch: (previous: SurveyDraft) => SurveyDraft) => {
        autosave.schedule();
        setDraft(patch);
    };
    return {
        draft,
        resumed,
        /** Writes any pending change now (before submit) so nothing is left to save after the page clears the draft. */
        settle: autosave.flush,
        setDepartment: (departmentId: string) => update((previous) => ({ ...previous, departmentId })),
        setAnswer: (dimensionId: string, answer: CsiAnswer) =>
            update((previous) => ({ ...previous, answers: { ...previous.answers, [dimensionId]: answer } })),
        setComment: (rateeId: string, text: string) =>
            update((previous) => ({ ...previous, comments: { ...previous.comments, [rateeId]: text } })),
        setPosition: (position: number) => update((previous) => ({ ...previous, position })),
    };
}

export type SurveyAnswers = ReturnType<typeof useSurveyAnswers>;
