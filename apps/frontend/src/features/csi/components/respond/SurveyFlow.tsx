import { History } from 'lucide-react';
import { CSI_MESSAGES, errorMessage } from '../../lib/csiForm';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { FlowChromeContext, ScreenTransition, type HeadingLevel } from './FlowChrome';
import { IntroScreen } from './IntroScreen';
import { RateeScreen } from './RateeScreen';
import { ReviewScreen } from './ReviewScreen';
import { RESPOND_COPY } from './respondCopy';
import { isRateeComplete, useSurveyAnswers } from './useSurveyAnswers';
import { useSurveyNavigation } from './useSurveyNavigation';

export interface SurveyFlowProps {
    form: CsiOpenForm;
    userId: string;
    mode?: 'live' | 'preview';
    onSubmit?: (payload: SubmitCsiResponse) => void;
    submitting?: boolean;
    error?: unknown;
    /** Screen title level; `h2` when the flow is embedded under another page title (admin preview). */
    headingLevel?: HeadingLevel;
}

function ResumedNote() {
    return (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12.5px] font-medium text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />{RESPOND_COPY.resumed}
        </p>
    );
}

/** Stepped respondent form: intro (position 0) → one screen per ratee (1..n) → review (n + 1). */
export function SurveyFlow({ form, userId, mode = 'live', onSubmit, submitting = false, error, headingLevel }: SurveyFlowProps) {
    const preview = mode === 'preview';
    const answers = useSurveyAnswers(form, userId, !preview);
    const { draft } = answers;
    const nav = useSurveyNavigation({ form, answers, preview, onSubmit });
    const { position, ratee, goTo } = nav;
    const failure = error ? (errorMessage(error) ?? CSI_MESSAGES.submitFailed) : null;
    const departmentName = form.departments.find((department) => department.id === draft.departmentId)?.name ?? null;

    return (
        <FlowChromeContext.Provider value={{ navigated: nav.navigated, aboveBottomNav: !preview, headingLevel }}>
            {answers.resumed && <ResumedNote />}
            <ScreenTransition screenKey={String(position)} direction={nav.direction}>
                {position === 0 && (
                    <IntroScreen form={form} departmentId={draft.departmentId} onDepartmentChange={answers.setDepartment}
                        canStart={preview || Boolean(draft.departmentId)} onStart={() => goTo(1)} />
                )}
                {ratee && (
                    <RateeScreen ratees={form.ratees} index={position - 1} scores={draft.scores}
                        comment={draft.comments[ratee.periodRateeId] ?? ''} missing={nav.missing}
                        isComplete={(item) => isRateeComplete(item, draft.scores)}
                        onScore={answers.setScore} onComment={(text) => answers.setComment(ratee.periodRateeId, text)}
                        onSelect={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onNext={nav.next} />
                )}
                {position === nav.reviewPosition && (
                    <ReviewScreen form={form} departmentName={departmentName} scores={draft.scores} preview={preview}
                        submitting={submitting} failure={failure} onEditDepartment={() => goTo(0)}
                        onEditRatee={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onSubmit={nav.submit} />
                )}
            </ScreenTransition>
        </FlowChromeContext.Provider>
    );
}
