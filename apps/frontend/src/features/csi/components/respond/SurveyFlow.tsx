import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CSI_HTTP_CONFLICT, CSI_MESSAGES, errorMessage, errorStatus, isNameTaken, isNameValid, nameKey, orderRatees } from '../../lib/csiForm';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { FlowChromeContext, LIVE_FOOTER_SPACE, ScreenTransition, type HeadingLevel } from './FlowChrome';
import { IntroScreen } from './IntroScreen';
import { RateeScreen } from './RateeScreen';
import { ReviewScreen } from './ReviewScreen';
import { RESPOND_COPY } from './respondCopy';
import { isRateeComplete, useSurveyAnswers, type FreshStart } from './useSurveyAnswers';
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
    /** "Fill again": start empty (no draft, no name) but keep this department. */
    fresh?: FreshStart;
}

function ResumedNote() {
    return (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12.5px] font-medium text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />{RESPOND_COPY.resumed}
        </p>
    );
}

const NAME_TAKEN = CSI_MESSAGES.nameTaken;

/**
 * Name field error: a name already used (known up front or rejected by the server) or a length problem.
 * A new 409 answer is handled while rendering (React's "previous value" pattern): remember the name and go back to the intro.
 */
function useNameError(form: CsiOpenForm, name: string, error: unknown, onRejected: () => void) {
    const [seenError, setSeenError] = useState(error);
    const [rejected, setRejected] = useState<string | null>(null);
    if (error !== seenError) {
        setSeenError(error);
        if (errorStatus(error) === CSI_HTTP_CONFLICT) {
            setRejected(nameKey(name));
            onRejected();
        }
    }
    if (isNameTaken(name, form.submittedNames) || (rejected !== null && rejected === nameKey(name))) return NAME_TAKEN;
    return name.trim() !== '' && !isNameValid(name) ? RESPOND_COPY.nameInvalid : null;
}

/** Stepped respondent form: intro (0) → one screen per ratee, team first (1..n) → review (n + 1). */
export function SurveyFlow({ form: source, userId, mode = 'live', onSubmit, submitting = false, error, headingLevel, fresh }: SurveyFlowProps) {
    const preview = mode === 'preview';
    const form = useMemo(() => ({ ...source, ratees: orderRatees(source.ratees) }), [source]);
    const answers = useSurveyAnswers(form, userId, !preview, fresh);
    const { draft } = answers;
    const nav = useSurveyNavigation({ form, answers, preview, onSubmit });
    const { position, ratee, goTo } = nav;
    const nameError = useNameError(form, draft.respondentName, error, () => goTo(0));
    const duplicate = errorStatus(error) === CSI_HTTP_CONFLICT;
    const failure = error && !duplicate ? (errorMessage(error) ?? CSI_MESSAGES.submitFailed) : null;
    const departmentName = form.departments.find((department) => department.id === draft.departmentId)?.name ?? null;
    const nameOk = isNameValid(draft.respondentName) && !nameError;

    return (
        <FlowChromeContext.Provider value={{ navigated: nav.navigated, aboveBottomNav: !preview, headingLevel }}>
            <div data-testid="csi-flow-content" className={cn(!preview && LIVE_FOOTER_SPACE)}>
            {answers.resumed && <ResumedNote />}
            <ScreenTransition screenKey={String(position)} direction={nav.direction}>
                {position === 0 && (
                    <IntroScreen form={form} name={draft.respondentName} nameError={nameError} onNameChange={answers.setName}
                        departmentId={draft.departmentId} onDepartmentChange={answers.setDepartment}
                        canStart={preview || (nameOk && Boolean(draft.departmentId))} onStart={() => goTo(1)}
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
                    <ReviewScreen form={form} name={draft.respondentName.trim()} departmentName={departmentName} answers={draft.answers}
                        preview={preview} submitting={submitting} failure={failure} onEditIdentity={() => goTo(0)}
                        onEditRatee={(index) => goTo(index + 1)} onBack={() => goTo(position - 1)} onSubmit={nav.submit} />
                )}
            </ScreenTransition>
            </div>
        </FlowChromeContext.Provider>
    );
}
