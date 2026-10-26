import { useCallback, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useCsiPeriod } from '../../hooks/useCsi';
import { CSI_DEFAULT_MODE } from '../../lib/csiAdmin';
import { nextStep, previousStep, stepComplete, visibleSteps, type WizardStepKey } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { ADMIN_PANEL, PublishPill } from '../admin/AdminParts';
import type { PeriodEditorStatus } from '../admin/PeriodEditor';
import { WizardFooter } from './WizardFooter';
import { WizardStepBody } from './WizardStepBody';
import { WizardStepper } from './WizardStepper';
import { WIZARD_COPY } from './wizardCopy';

export interface SurveyWizardProps {
    scope: CsiScopeParam;
    /** `null` while creating: only the info step is available until the draft exists. */
    periodId: string | null;
    step: WizardStepKey;
    onStepChange: (step: WizardStepKey) => void;
    onClose: () => void;
    /** The draft was created; the caller moves the URL to the new period's dimensions step. */
    onCreated: (periodId: string) => void;
    /** Published from the review step; the caller opens the detail view. */
    onPublished: (periodId: string) => void;
}

type InfoIntent = 'next' | 'exit';
const IDLE_INFO: PeriodEditorStatus = { canSubmit: false, dirty: false, pending: false };

/** A hidden or not-yet-reachable step falls back to one the wizard can show. */
function effectiveStep(step: WizardStepKey, steps: readonly WizardStepKey[], period: CsiPeriodDetail | undefined): WizardStepKey {
    if (!period) return 'info';
    return steps.includes(step) ? step : 'review';
}

/** Stepper check mark: the review step is only "done" once the survey is published. */
const isStepDone = (key: WizardStepKey, period: CsiPeriodDetail | undefined) =>
    !!period && (key === 'review' ? period.publishStatus === 'PUBLISHED' : stepComplete(key, period));

/** Unsaved ratee/rater drafts block navigation; the flag belongs to the step that reported it. */
function useStepDirty(step: WizardStepKey) {
    const [dirty, setDirty] = useState<{ step: WizardStepKey; value: boolean }>({ step, value: false });
    const report = useCallback((value: boolean) => setDirty({ step, value }), [step]);
    return [dirty.step === step && dirty.value, report] as const;
}

function WizardHeader({ period, onClose }: { period: CsiPeriodDetail | undefined; onClose: () => void }) {
    return (
        <header className="grid gap-3">
            <button type="button" onClick={onClose} className="idesk-text-link w-fit"><ArrowLeft aria-hidden="true" />Semua survei</button>
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-bold tracking-tight">{period?.title || WIZARD_COPY.create}</h2>
                {period && <PublishPill status={period.publishStatus} />}
            </div>
        </header>
    );
}

export function SurveyWizard({ scope, periodId, step, onStepChange, onClose, onCreated, onPublished }: SurveyWizardProps) {
    const query = useCsiPeriod(scope, periodId ?? '');
    const { isLoading, isError, refetch } = query;
    const period = periodId ? query.data : undefined;
    const formRef = useRef<HTMLFormElement>(null);
    const intent = useRef<InfoIntent>('next');
    const [info, setInfo] = useState(IDLE_INFO);
    const mode = period?.respondentMode ?? CSI_DEFAULT_MODE[scope];
    const steps = visibleSteps(mode);
    const current = effectiveStep(step, steps, period);
    const [blocked, reportDirty] = useStepDirty(current);

    if (periodId && isLoading) return <div className={cn(ADMIN_PANEL, 'h-64 animate-pulse motion-reduce:animate-none')} aria-busy="true" aria-label="Memuat survei" />;
    if (periodId && (isError || !period)) return <ErrorState message="Gagal memuat survei." onRetry={() => refetch()} />;

    const submitInfo = (next: InfoIntent) => { intent.current = next; formRef.current?.requestSubmit(); };
    const infoSaved = (saved: CsiPeriodDetail) => {
        if (intent.current === 'exit') onClose();
        else if (!periodId) onCreated(saved.id);
        else onStepChange(nextStep(saved.respondentMode, 'info') ?? 'review');
    };
    const goNext = () => current === 'info' ? submitInfo('next') : onStepChange(nextStep(mode, current) ?? 'review');
    const exit = () => current === 'info' && info.dirty ? submitInfo('exit') : onClose();

    return (
        <div className="grid gap-5">
            <WizardHeader period={period} onClose={onClose} />
            <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
                <div className={cn(ADMIN_PANEL, 'p-2.5 lg:sticky lg:top-4')}>
                    <WizardStepper steps={steps} current={current} canNavigate={!!period && !blocked}
                        isComplete={(key) => isStepDone(key, period)} onSelect={onStepChange} />
                </div>
                <div className="grid min-w-0 gap-4">
                    <WizardStepBody scope={scope} step={current} period={period} formRef={formRef}
                        onInfoStatus={setInfo} onInfoSaved={infoSaved} onDirtyChange={reportDirty}
                        onEditStep={onStepChange} onPublished={onPublished} />
                    <WizardFooter showBack={current !== 'info'} showNext={current !== 'review'} blocked={blocked}
                        nextDisabled={current === 'info' && !info.canSubmit} exitDisabled={current === 'info' && info.dirty && !info.canSubmit}
                        pending={current === 'info' && info.pending}
                        onBack={() => onStepChange(previousStep(mode, current) ?? 'info')} onNext={goNext} onExit={exit} />
                </div>
            </div>
        </div>
    );
}
