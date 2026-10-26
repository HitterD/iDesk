import { useEffect } from 'react';
import { useCsiDimensions, useCsiPeriod } from '../../hooks/useCsi';
import type { AdminRoute } from '../../lib/useAdminRoute';
import { resumeStep } from '../../lib/wizard';
import type { CsiScopeParam } from '../../types';
import { SurveyWizard } from './SurveyWizard';

/** Binds the wizard to the URL; a draft opened without `step` resumes at its first incomplete step. */
export function WizardRoute({ scope, route }: { scope: CsiScopeParam; route: AdminRoute }) {
    const periodId = route.wizard ?? null;
    const { data: period } = useCsiPeriod(scope, periodId ?? '');
    const { data: dimensions } = useCsiDimensions(scope);
    const loaded = periodId && dimensions ? period : undefined;
    const resolved = route.step ?? (loaded && dimensions ? resumeStep(loaded, dimensions.length) : 'info');
    const { step, setStep } = route;

    // Pin the resumed step in the URL so later saves (which change readiness) do not move the admin.
    useEffect(() => {
        if (!step && loaded) setStep(resolved, { replace: true });
    }, [step, loaded, resolved, setStep]);

    return (
        <SurveyWizard scope={scope} periodId={periodId} step={resolved}
            onStepChange={(next) => route.setStep(next)} onClose={route.closeAll}
            onCreated={(id) => route.openWizard(id, 'dimensions', { replace: true })}
            onPublished={route.openDetail} />
    );
}
