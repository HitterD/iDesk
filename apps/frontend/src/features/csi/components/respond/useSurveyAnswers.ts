import { useEffect, useRef, useState } from 'react';
import type { CsiOpenForm, SaveCsiDraft } from '../../types';
import { isAnswered, isCommentFilled, missingRequired, type CsiAnswer, type CsiAnswers, type CsiComments } from '../../lib/csiForm';
import { draftKey, fromServerDraft, loadDraft, saveDraft, toServerDraft, type SurveyDraft } from '../../lib/surveyDraft';

const SAVE_DEBOUNCE_MS = 300;
const SERVER_SAVE_DEBOUNCE_MS = 600;
export type SaveDraftHandler = (payload: SaveCsiDraft) => Promise<unknown> | void;

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
function initialState(form: CsiOpenForm, key: string | null, live: boolean, lockedDepartment: string | null): {
    draft: SurveyDraft;
    resumed: boolean;
    fromServer: boolean;
} {
    const local = key ? loadDraft(key, form) : null;
    const server = live && form.draft ? fromServerDraft(form.draft, form) : null;
    const localTime = Date.parse(local?.updatedAt ?? '') || 0;
    const serverTime = Date.parse(server?.updatedAt ?? '') || 0;
    const pickServer = Boolean(server && (!local || serverTime > localTime));
    const stored = pickServer ? server : local;
    if (!stored) return { draft: emptyDraft(form.respondent.fullName, lockedDepartment ?? ''), resumed: false, fromServer: false };
    const draft = { ...stored, respondentName: form.respondent.fullName, departmentId: lockedDepartment ?? stored.departmentId };
    return { draft: { ...draft, position: resumePosition(form, draft) }, resumed: true, fromServer: pickServer };
}

/** Debounced autosave (localStorage + server); flushed on visibility hide, `beforeunload`, `pagehide`, and unmount. */
function useDraftAutosave(key: string | null, form: CsiOpenForm, draft: SurveyDraft, onSaveDraft?: SaveDraftHandler) {
    const latest = useRef({ key, form, draft, onSaveDraft });
    const localPending = useRef(false);
    const serverPending = useRef(false);

    const flushLocal = useRef(() => {
        const { key: target, draft: current } = latest.current;
        if (!target || !localPending.current) return;
        localPending.current = false;
        saveDraft(target, current);
    });

    const flushServer = useRef(() => {
        const { key: target, form: currentForm, draft: current, onSaveDraft: persist } = latest.current;
        if (!target || !persist || !serverPending.current) return;
        serverPending.current = false;
        const picks = currentForm.respondentPicks ? currentForm.ratees.map((ratee) => ratee.periodRateeId) : undefined;
        void Promise.resolve(persist(toServerDraft(current, currentForm, picks))).catch(() => undefined);
    });

    useEffect(() => {
        latest.current = { key, form, draft, onSaveDraft };
    }, [key, form, draft, onSaveDraft]);

    useEffect(() => {
        const saveAll = () => {
            flushLocal.current();
            flushServer.current();
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') saveAll();
        };
        window.addEventListener('pagehide', saveAll);
        window.addEventListener('beforeunload', saveAll);
        document.addEventListener('visibilitychange', onVisibility);
        // In-app navigation (back link, route change) inside the debounce window keeps the last answer.
        return () => {
            window.removeEventListener('pagehide', saveAll);
            window.removeEventListener('beforeunload', saveAll);
            document.removeEventListener('visibilitychange', onVisibility);
            saveAll();
        };
    }, []);

    const schedule = () => {
        localPending.current = true;
        serverPending.current = Boolean(latest.current.onSaveDraft);
    };

    useEffect(() => {
        if (!localPending.current) return undefined;
        const timer = window.setTimeout(flushLocal.current, SAVE_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [draft]);

    useEffect(() => {
        if (!serverPending.current || !onSaveDraft) return undefined;
        const timer = window.setTimeout(flushServer.current, SERVER_SAVE_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [draft, onSaveDraft]);

    return {
        schedule,
        /** Cancel pending server upsert right before submit (submit endpoint deletes the draft atomically). */
        settle: () => {
            serverPending.current = false;
            flushLocal.current();
        },
    };
}

/**
 * Respondent answers + current screen. In live mode every change is autosaved (debounced) to
 * `localStorage` and synced to the server when `onSaveDraft` is provided; preview mode never persists.
 */
export function useSurveyAnswers(
    form: CsiOpenForm,
    userId: string,
    live: boolean,
    lockedDepartment: string | null = null,
    onSaveDraft?: SaveDraftHandler,
) {
    const key = live && userId ? draftKey(userId, form.id) : null;
    const [{ draft: initial, resumed, fromServer }] = useState(() => initialState(form, key, live, lockedDepartment));
    const [draft, setDraft] = useState<SurveyDraft>(initial);
    const autosave = useDraftAutosave(key, form, draft, onSaveDraft);

    useEffect(() => {
        if (fromServer && key) saveDraft(key, initial);
    }, [fromServer, key, initial]);

    const update = (patch: (previous: SurveyDraft) => SurveyDraft) => {
        autosave.schedule();
        setDraft((previous) => ({ ...patch(previous), updatedAt: new Date().toISOString() }));
    };
    return {
        draft,
        resumed,
        /** Writes any pending local change now (before submit) so nothing is left to save after the page clears the draft. */
        settle: autosave.settle,
        setDepartment: (departmentId: string) => update((previous) => ({ ...previous, departmentId })),
        setAnswer: (dimensionId: string, answer: CsiAnswer) =>
            update((previous) => ({ ...previous, answers: { ...previous.answers, [dimensionId]: answer } })),
        setComment: (rateeId: string, text: string) =>
            update((previous) => ({ ...previous, comments: { ...previous.comments, [rateeId]: text } })),
        setPosition: (position: number) => update((previous) => ({ ...previous, position })),
    };
}

export type SurveyAnswers = ReturnType<typeof useSurveyAnswers>;
