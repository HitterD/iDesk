import { useEffect, useRef, useState } from 'react';
import type { CsiOpenForm } from '../../types';
import { draftKey, loadDraft, saveDraft, type SurveyDraft } from '../../lib/surveyDraft';

const SAVE_DEBOUNCE_MS = 300;
const EMPTY: SurveyDraft = { departmentId: '', scores: {}, comments: {}, position: 0 };

type Ratee = CsiOpenForm['ratees'][number];

export const isRateeComplete = (ratee: Ratee, scores: SurveyDraft['scores']) =>
    ratee.dimensions.every((dimension) => (scores[dimension.periodRateeDimensionId] ?? 0) > 0);

/** Index of the first ratee with a missing star, or -1 when everything is rated. */
export const firstIncomplete = (form: CsiOpenForm, scores: SurveyDraft['scores']) =>
    form.ratees.findIndex((ratee) => !isRateeComplete(ratee, scores));

/** A restored draft must not land past a screen whose prerequisites are gone (department removed, new dimensions). */
function resumePosition(form: CsiOpenForm, draft: SurveyDraft): number {
    if (!draft.departmentId) return 0;
    const reviewPosition = form.ratees.length + 1;
    if (draft.position < reviewPosition) return draft.position;
    const pending = firstIncomplete(form, draft.scores);
    return pending === -1 ? reviewPosition : pending + 1;
}

function initialState(form: CsiOpenForm, key: string | null): { draft: SurveyDraft; resumed: boolean } {
    const stored = key ? loadDraft(key, form) : null;
    if (!stored) return { draft: EMPTY, resumed: false };
    return { draft: { ...stored, position: resumePosition(form, stored) }, resumed: true };
}

/**
 * Respondent answers + current screen. In live mode every change is autosaved (debounced) to
 * `localStorage`; preview mode never reads or writes storage.
 */
export function useSurveyAnswers(form: CsiOpenForm, userId: string, live: boolean) {
    const key = live && userId ? draftKey(userId, form.id) : null;
    const [{ draft: initial, resumed }] = useState(() => initialState(form, key));
    const [draft, setDraft] = useState<SurveyDraft>(initial);
    const dirty = useRef(false);

    useEffect(() => {
        if (!key || !dirty.current) return undefined;
        const save = () => saveDraft(key, draft);
        const timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
        // A refresh/close inside the debounce window still keeps the last answer.
        window.addEventListener('pagehide', save);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('pagehide', save);
        };
    }, [key, draft]);

    const update = (patch: (previous: SurveyDraft) => SurveyDraft) => {
        dirty.current = true;
        setDraft(patch);
    };
    return {
        draft,
        resumed,
        setDepartment: (departmentId: string) => update((previous) => ({ ...previous, departmentId })),
        setScore: (dimensionId: string, score: number) =>
            update((previous) => ({ ...previous, scores: { ...previous.scores, [dimensionId]: score } })),
        setComment: (rateeId: string, text: string) =>
            update((previous) => ({ ...previous, comments: { ...previous.comments, [rateeId]: text } })),
        setPosition: (position: number) => update((previous) => ({ ...previous, position })),
    };
}
