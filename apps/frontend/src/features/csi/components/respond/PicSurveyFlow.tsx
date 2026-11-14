import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { draftKey, loadDraft, pickKey, toServerDraft } from '../../lib/surveyDraft';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { PicPicker } from './PicPicker';
import { SurveyFlow, type SurveyFlowProps } from './SurveyFlow';

function loadPicks(key: string | null, valid: ReadonlySet<string>): Set<string> {
    if (!key) return new Set();
    try {
        const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
        return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && valid.has(id)) : []);
    } catch {
        return new Set();
    }
}
function savePicks(key: string | null, ids: ReadonlySet<string>) {
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {
        // A pick list is a convenience; storage errors (quota, private mode) only lose the resume.
    }
}
export const clearPicks = (userId: string, periodId: string) => {
    try {
        localStorage.removeItem(pickKey(userId, periodId));
    } catch {
        // see savePicks
    }
};

function initialPicks(form: CsiOpenForm, userId: string, live: boolean, key: string | null, valid: ReadonlySet<string>) {
    const local = loadPicks(key, valid);
    const serverIds = live && Array.isArray(form.draft?.picks)
        ? form.draft.picks.filter((id) => valid.has(id))
        : [];
    if (!serverIds.length) return { selected: local, fromServer: false };
    const localDraft = live && userId ? loadDraft(draftKey(userId, form.id), form) : null;
    const localTime = Date.parse(localDraft?.updatedAt ?? '') || 0;
    const serverTime = Date.parse(form.draft?.updatedAt ?? '') || 0;
    if (!local.size || serverTime > localTime) {
        return { selected: new Set(serverIds), fromServer: true };
    }
    return { selected: local, fromServer: false };
}

/**
 * HC per PIC ("respondentPicks"): step 0 picks the PICs, then the normal flow (identity → one screen per picked PIC
 * → review) runs on a form narrowed to them. ICT and periods without picking use SurveyFlow unchanged.
 */
export function PicSurveyFlow(props: SurveyFlowProps) {
    const { form, userId, mode = 'live', onSubmit, onSaveDraft } = props;
    const live = mode === 'live';
    const key = live && userId ? pickKey(userId, form.id) : null;
    const valid = useMemo(() => new Set(form.ratees.map((ratee) => ratee.periodRateeId)), [form.ratees]);
    const [{ selected: initialSelected, fromServer }] = useState(() => initialPicks(form, userId, live, key, valid));
    const [selected, setSelected] = useState<Set<string>>(initialSelected);
    const [rating, setRating] = useState(() => initialSelected.size > 0);
    const pendingSync = useRef(false);
    const latest = useRef({ form, userId, selected, rating, onSaveDraft, live });
    latest.current = { form, userId, selected, rating, onSaveDraft, live };

    useEffect(() => {
        if (fromServer && key) savePicks(key, initialSelected);
    }, [fromServer, key, initialSelected]);

    const syncPicks = useRef(() => {
        const cur = latest.current;
        if (!cur.live || !cur.userId || !cur.onSaveDraft || !pendingSync.current || cur.rating) return;
        pendingSync.current = false;
        const stored = loadDraft(draftKey(cur.userId, cur.form.id), cur.form) ?? {
            respondentName: cur.form.respondent.fullName,
            departmentId: cur.form.respondent.departmentId ?? '',
            answers: {},
            comments: {},
            position: 0,
        };
        void Promise.resolve(cur.onSaveDraft(toServerDraft(stored, cur.form, [...cur.selected]))).catch(() => undefined);
    });

    useEffect(() => {
        if (!pendingSync.current || rating) return undefined;
        const timer = window.setTimeout(syncPicks.current, 500);
        return () => window.clearTimeout(timer);
    }, [selected, rating]);

    useEffect(() => {
        const flush = () => syncPicks.current();
        const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
        window.addEventListener('pagehide', flush);
        window.addEventListener('beforeunload', flush);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('pagehide', flush);
            window.removeEventListener('beforeunload', flush);
            document.removeEventListener('visibilitychange', onVis);
            flush();
        };
    }, []);

    const narrowed: CsiOpenForm = useMemo(() => ({ ...form, ratees: form.ratees.filter((ratee) => selected.has(ratee.periodRateeId)) }), [form, selected]);
    const choose = (ids: Set<string>) => {
        setSelected(ids);
        savePicks(key, ids);
        if (live && onSaveDraft) pendingSync.current = true;
    };
    const startRating = () => {
        pendingSync.current = false;
        if (live && onSaveDraft && selected.size) {
            const stored = loadDraft(draftKey(userId, form.id), form) ?? {
                respondentName: form.respondent.fullName,
                departmentId: form.respondent.departmentId ?? '',
                answers: {},
                comments: {},
                position: 0,
            };
            void Promise.resolve(onSaveDraft(toServerDraft(stored, form, [...selected]))).catch(() => undefined);
        }
        setRating(true);
    };
    if (!rating || !narrowed.ratees.length) {
        return <PicPicker ratees={form.ratees} selected={selected} onChange={choose} onNext={startRating} />;
    }
    return (
        <div>
            <button type="button" onClick={() => setRating(false)}
                className="mb-3 inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />{`Ubah pilihan PIC (${selected.size})`}
            </button>
            {/* Remount when the picks change so the stepper starts from the picked list. */}
            <SurveyFlow key={[...selected].sort().join(',')} {...props} form={narrowed}
                onSubmit={(payload: SubmitCsiResponse) => onSubmit?.(payload)} />
        </div>
    );
}

/** The flow to render for a form: PIC picking for HC per-PIC periods, the plain flow otherwise. */
export function RespondentFlow(props: SurveyFlowProps) {
    return props.form.respondentPicks ? <PicSurveyFlow {...props} /> : <SurveyFlow {...props} />;
}
