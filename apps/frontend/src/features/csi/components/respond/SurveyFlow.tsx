import { useMemo } from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CSI_HTTP_CONFLICT, CSI_MESSAGES, errorMessage, errorStatus, orderRatees } from '../../lib/csiForm';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { FlowChromeContext, LIVE_FOOTER_SPACE, ScreenTransition, type HeadingLevel } from './FlowChrome';
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

/** The locked department of the account, when it is in this survey's list. */
const lockedDepartmentOf = (form: CsiOpenForm) =>
    form.departments.some((department) => department.id === form.respondent.departmentId) ? form.respondent.departmentId ?? null : null;

/** Stepped respondent form: intro (0) → one screen per ratee, team first (1..n) → review (n + 1). */
export function SurveyFlow({ form: source, userId, mode = 'live', onSubmit, submitting = false, error, headingLevel }: SurveyFlowProps) {
    const preview = mode === 'preview';
    const form = useMemo(() => ({ ...source, ratees: orderRatees(source.ratees) }), [source]);
    const lockedDepartment = lockedDepartmentOf(form);
    const answers = useSurveyAnswers(form, userId, !preview, lockedDepartment);
    const { draft } = answers;
    const nav = useSurveyNavigation({ form, answers, preview, onSubmit });
    const { position, ratee, goTo } = nav;
    const duplicate = errorStatus(error) === CSI_HTTP_CONFLICT;
    const failure = error ? (duplicate ? CSI_MESSAGES.alreadySubmitted : errorMessage(error) ?? CSI_MESSAGES.submitFailed) : null;
    const departmentName = form.departments.find((department) => department.id === draft.departmentId)?.name ?? null;

    return (
        <FlowChromeContext.Provider value={{ navigated: nav.navigated, aboveBottomNav: !preview, headingLevel }}>
            <div data-testid="csi-flow-content" className={cn(!preview && LIVE_FOOTER_SPACE)}>
            {answers.resumed && <ResumedNote />}
            <ScreenTransition screenKey={String(position)} direction={nav.direction}>
                {position === 0 && (
                    <IntroScreen form={form} departmentId={draft.departmentId} onDepartmentChange={answers.setDepartment}
                        departmentLocked={!preview && lockedDepartment !== null}
                        canStart={preview || Boolean(draft.departmentId)} onStart={() => goTo(1)}
                        unavailable={!preview && form.departments.length === 0} />
                )}
                {ratee && (
                    <RateeScreen ratees={form.ratees} index={position - 1} saved={!preview} answers={draft.answers}
                        comment={draft.comments[ratee.periodRateeId] ?? ''} missing={nav.missing}
                        isComplete={(item, index) => isRateeComplete(item, draft.answers, nav.visited.has(index))}
                        onAnswer={answers.setAnswer} onComment={(text) => answers.setComment(ratee.periodRateeId, text)}
                        onSelect={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onNext={nav.next} />
                )}
                {position === nav.reviewPosition && (
                    <ReviewScreen form={form} name={form.respondent.fullName} departmentName={departmentName} answers={draft.answers}
                        preview={preview} submitting={submitting} failure={failure} onEditIdentity={lockedDepartment ? null : () => goTo(0)}
                        onEditRatee={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onSubmit={nav.submit} />
                )}
            </ScreenTransition>
            </div>
        </FlowChromeContext.Provider>
    );
}
