import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { PicPicker } from './PicPicker';
import { SurveyFlow, type SurveyFlowProps } from './SurveyFlow';

/** Picked PICs are kept per account + period (like the answer draft), so a refresh resumes where it stopped. */
const PICK_KEY = (userId: string, periodId: string) => `csi-picks:v1:${userId}:${periodId}`;

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
        localStorage.removeItem(PICK_KEY(userId, periodId));
    } catch {
        // see savePicks
    }
};

/**
 * HC per PIC ("respondentPicks"): step 0 picks the PICs, then the normal flow (identity → one screen per picked PIC
 * → review) runs on a form narrowed to them. ICT and periods without picking use SurveyFlow unchanged.
 */
export function PicSurveyFlow(props: SurveyFlowProps) {
    const { form, userId, mode = 'live', onSubmit } = props;
    const live = mode === 'live';
    const key = live && userId ? PICK_KEY(userId, form.id) : null;
    const valid = useMemo(() => new Set(form.ratees.map((ratee) => ratee.periodRateeId)), [form.ratees]);
    const [selected, setSelected] = useState<Set<string>>(() => loadPicks(key, valid));
    const [rating, setRating] = useState(() => selected.size > 0);
    const narrowed: CsiOpenForm = useMemo(() => ({ ...form, ratees: form.ratees.filter((ratee) => selected.has(ratee.periodRateeId)) }), [form, selected]);
    const choose = (ids: Set<string>) => {
        setSelected(ids);
        savePicks(key, ids);
    };
    if (!rating || !narrowed.ratees.length) {
        return <PicPicker ratees={form.ratees} selected={selected} onChange={choose} onNext={() => setRating(true)} />;
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
