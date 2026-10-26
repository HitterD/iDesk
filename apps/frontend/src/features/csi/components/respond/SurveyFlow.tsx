import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { History } from 'lucide-react';
import { buildSubmitPayload, CSI_MESSAGES, errorMessage } from '../../lib/csiForm';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { FlowChromeContext, ScreenTransition } from './FlowChrome';
import { IntroScreen } from './IntroScreen';
import { RateeScreen } from './RateeScreen';
import { ReviewScreen } from './ReviewScreen';
import { RESPOND_COPY } from './respondCopy';
import { firstIncomplete, isRateeComplete, useSurveyAnswers } from './useSurveyAnswers';

export interface SurveyFlowProps {
    form: CsiOpenForm;
    userId: string;
    mode?: 'live' | 'preview';
    onSubmit?: (payload: SubmitCsiResponse) => void;
    submitting?: boolean;
    error?: unknown;
}

type Ratee = CsiOpenForm['ratees'][number];
const NO_MISSING: ReadonlySet<string> = new Set();
/** ClientLayout's scroll area; screens start at the top like a new page. */
const SCROLL_CONTAINER_ID = 'main-scroll-container';
const scrollToTop = () => document.getElementById(SCROLL_CONTAINER_ID)?.scrollTo({ top: 0 });

const missingIn = (ratee: Ratee, scores: Readonly<Record<string, number>>) =>
    new Set(ratee.dimensions.filter((dimension) => !(scores[dimension.periodRateeDimensionId] > 0)).map((dimension) => dimension.periodRateeDimensionId));

function ResumedNote() {
    return (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12.5px] font-medium text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />{RESPOND_COPY.resumed}
        </p>
    );
}

/** Scrolls the first highlighted (missing) star row into view once it has rendered. */
function useScrollToMissing(attempt: number) {
    const reduce = useReducedMotion();
    useEffect(() => {
        if (!attempt) return;
        document.querySelector('[data-missing]')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, [attempt, reduce]);
}

/** Stepped respondent form: intro (position 0) → one screen per ratee (1..n) → review (n + 1). */
export function SurveyFlow({ form, userId, mode = 'live', onSubmit, submitting = false, error }: SurveyFlowProps) {
    const preview = mode === 'preview';
    const answers = useSurveyAnswers(form, userId, !preview);
    const { draft } = answers;
    const [flagged, setFlagged] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [chrome, setChrome] = useState({ navigated: false, direction: 1 });

    const reviewPosition = form.ratees.length + 1;
    const position = Math.min(draft.position, reviewPosition);
    const ratee = position >= 1 && position < reviewPosition ? form.ratees[position - 1] : null;
    const missing = ratee && flagged ? missingIn(ratee, draft.scores) : NO_MISSING;
    useScrollToMissing(attempt);

    const goTo = (next: number) => {
        setFlagged(false);
        setChrome({ navigated: true, direction: next >= position ? 1 : -1 });
        answers.setPosition(next);
        scrollToTop();
    };
    const flag = () => {
        setFlagged(true);
        setAttempt((count) => count + 1);
    };
    /** Chips allow skipping people, so leaving the last one (or sending) first returns to anyone still incomplete. */
    const guardComplete = () => {
        const pending = firstIncomplete(form, draft.scores);
        if (pending === -1) return true;
        if (pending + 1 !== position) goTo(pending + 1);
        flag();
        return false;
    };
    const next = () => {
        if (ratee && missingIn(ratee, draft.scores).size > 0) return flag();
        if (position === reviewPosition - 1 && !guardComplete()) return undefined;
        return goTo(position + 1);
    };
    const submit = (): void => {
        if (preview) return;
        if (!draft.departmentId) return goTo(0);
        if (!guardComplete()) return;
        onSubmit?.(buildSubmitPayload(form, draft.departmentId, draft.scores, draft.comments));
    };
    const failure = error ? (errorMessage(error) ?? CSI_MESSAGES.submitFailed) : null;
    const departmentName = form.departments.find((department) => department.id === draft.departmentId)?.name ?? null;

    return (
        <FlowChromeContext.Provider value={{ navigated: chrome.navigated, aboveBottomNav: !preview }}>
            {answers.resumed && <ResumedNote />}
            <ScreenTransition screenKey={String(position)} direction={chrome.direction}>
                {position === 0 && (
                    <IntroScreen form={form} departmentId={draft.departmentId} onDepartmentChange={answers.setDepartment}
                        canStart={preview || Boolean(draft.departmentId)} onStart={() => goTo(1)} />
                )}
                {ratee && (
                    <RateeScreen ratees={form.ratees} index={position - 1} scores={draft.scores}
                        comment={draft.comments[ratee.periodRateeId] ?? ''} missing={missing}
                        isComplete={(item) => isRateeComplete(item, draft.scores)}
                        onScore={answers.setScore} onComment={(text) => answers.setComment(ratee.periodRateeId, text)}
                        onSelect={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onNext={next} />
                )}
                {position === reviewPosition && (
                    <ReviewScreen form={form} departmentName={departmentName} scores={draft.scores} preview={preview}
                        submitting={submitting} failure={failure} onEditDepartment={() => goTo(0)}
                        onEditRatee={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onSubmit={submit} />
                )}
            </ScreenTransition>
        </FlowChromeContext.Provider>
    );
}
