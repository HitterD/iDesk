import { useSearchParams } from 'react-router-dom';
import { isWizardStepKey, type WizardStepKey } from './wizard';

const PERIOD_PARAM = 'period';
const WIZARD_PARAM = 'wizard';
const STEP_PARAM = 'step';
/** `?wizard=new` starts a new survey; any other value is a period id. */
export const NEW_WIZARD = 'new';

export interface AdminRoute {
    /** Detail view (`?period=<id>`). */
    periodId: string | null;
    /** Wizard open: `null` = creating, otherwise the period id. `undefined` = closed. */
    wizard: string | null | undefined;
    /** Step from the URL; `null` lets the wizard resume at the first incomplete step. */
    step: WizardStepKey | null;
    openDetail: (id: string) => void;
    openWizard: (id: string | null, step?: WizardStepKey, options?: { replace?: boolean }) => void;
    setStep: (step: WizardStepKey, options?: { replace?: boolean }) => void;
    /** Back to the survey list (closes detail and wizard). */
    closeAll: () => void;
}

/** Admin CSI view state lives in the query string so refresh and back/forward keep the place. */
export function useAdminRoute(): AdminRoute {
    const [params, setParams] = useSearchParams();
    const wizardParam = params.get(WIZARD_PARAM);
    const stepParam = params.get(STEP_PARAM);
    const update = (change: (next: URLSearchParams) => void, replace = false) => setParams((current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
    }, { replace });
    const clear = (next: URLSearchParams) => [PERIOD_PARAM, WIZARD_PARAM, STEP_PARAM].forEach((key) => next.delete(key));

    return {
        periodId: params.get(PERIOD_PARAM),
        wizard: wizardParam === null ? undefined : wizardParam === NEW_WIZARD ? null : wizardParam,
        step: isWizardStepKey(stepParam) ? stepParam : null,
        openDetail: (id) => update((next) => { clear(next); next.set(PERIOD_PARAM, id); }),
        openWizard: (id, step, options) => update((next) => {
            clear(next);
            next.set(WIZARD_PARAM, id ?? NEW_WIZARD);
            if (step) next.set(STEP_PARAM, step);
        }, options?.replace),
        setStep: (step, options) => update((next) => { next.set(STEP_PARAM, step); }, options?.replace),
        closeAll: () => update(clear),
    };
}
