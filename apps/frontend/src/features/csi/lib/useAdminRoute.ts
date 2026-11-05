import { useSearchParams } from 'react-router-dom';
import { isWizardStepKey, type WizardStepKey } from './wizard';

const PERIOD_PARAM = 'period';
const WIZARD_PARAM = 'wizard';
const STEP_PARAM = 'step';
const TAB_PARAM = 'tab';
const COPY_PARAM = 'copy';
const SITE_PARAM = 'site';
/** Detail tabs that can be deep-linked (dashboard drill-down opens "report"). */
export type DetailTabParam = 'settings' | 'raters' | 'report';
const DETAIL_TABS: readonly string[] = ['settings', 'raters', 'report'];
/** `?wizard=new` starts a new survey; any other value is a period id. */
export const NEW_WIZARD = 'new';

export interface AdminRoute {
    /** Detail view (`?period=<id>`). */
    periodId: string | null;
    /** Wizard open: `null` = creating, otherwise the period id. `undefined` = closed. */
    wizard: string | null | undefined;
    /** Step from the URL; `null` lets the wizard resume at the first incomplete step. */
    step: WizardStepKey | null;
    /** Detail tab from the URL (`?tab=`), null = default. */
    detailTab: DetailTabParam | null;
    /** Report site filter from the URL (`?site=`), null = all sites. */
    siteId: string | null;
    /** New survey copied from this period with the next dates (`?wizard=new&copy=<id>`). */
    copyFrom: string | null;
    /** "Buat lagi untuk periode berikutnya". */
    openCopy: (sourceId: string) => void;
    openDetail: (id: string, options?: { tab?: DetailTabParam; siteId?: string | null }) => void;
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
    const clear = (next: URLSearchParams) => [PERIOD_PARAM, WIZARD_PARAM, STEP_PARAM, TAB_PARAM, SITE_PARAM, COPY_PARAM].forEach((key) => next.delete(key));
    const tabParam = params.get(TAB_PARAM);

    return {
        periodId: params.get(PERIOD_PARAM),
        wizard: wizardParam === null ? undefined : wizardParam === NEW_WIZARD ? null : wizardParam,
        step: isWizardStepKey(stepParam) ? stepParam : null,
        detailTab: tabParam && DETAIL_TABS.includes(tabParam) ? tabParam as DetailTabParam : null,
        siteId: params.get(SITE_PARAM),
        copyFrom: params.get(COPY_PARAM),
        openCopy: (sourceId) => update((next) => { clear(next); next.set(WIZARD_PARAM, NEW_WIZARD); next.set(STEP_PARAM, 'info'); next.set(COPY_PARAM, sourceId); }),
        openDetail: (id, options) => update((next) => {
            clear(next);
            next.set(PERIOD_PARAM, id);
            if (options?.tab) next.set(TAB_PARAM, options.tab);
            if (options?.siteId) next.set(SITE_PARAM, options.siteId);
        }),
        openWizard: (id, step, options) => update((next) => {
            clear(next);
            next.set(WIZARD_PARAM, id ?? NEW_WIZARD);
            if (step) next.set(STEP_PARAM, step);
        }, options?.replace),
        setStep: (step, options) => update((next) => { next.set(STEP_PARAM, step); }, options?.replace),
        closeAll: () => update(clear),
    };
}
