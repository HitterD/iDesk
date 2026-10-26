import type { CsiPeriodDetail, CsiRespondentMode } from '../types';

export type WizardStepKey = 'info' | 'dimensions' | 'ratees' | 'raters' | 'departments' | 'review';

export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; label: string }> = [
    { key: 'info', label: 'Info survei' },
    { key: 'dimensions', label: 'Dimensi' },
    { key: 'ratees', label: 'Orang yang dinilai' },
    { key: 'raters', label: 'Penilai' },
    { key: 'departments', label: 'Departemen' },
    { key: 'review', label: 'Tinjau & terbitkan' },
];

export function visibleSteps(mode: CsiRespondentMode): WizardStepKey[] {
    return WIZARD_STEPS.filter((step) => mode === 'LISTED' || step.key !== 'raters').map((step) => step.key);
}

export function nextStep(mode: CsiRespondentMode, current: WizardStepKey): WizardStepKey | null {
    const steps = visibleSteps(mode);
    const index = steps.indexOf(current);
    return index < 0 ? null : steps[index + 1] ?? null;
}

export function previousStep(mode: CsiRespondentMode, current: WizardStepKey): WizardStepKey | null {
    const steps = visibleSteps(mode);
    return steps[steps.indexOf(current) - 1] ?? null;
}

export function stepComplete(key: WizardStepKey, period: CsiPeriodDetail): boolean {
    const checkOk = (checkKey: CsiPeriodDetail['readiness']['checks'][number]['key']) =>
        period.readiness.checks.some((check) => check.key === checkKey && check.ok);
    switch (key) {
        case 'ratees': return checkOk('ratees') && checkOk('dimensions');
        case 'raters': return checkOk('raters');
        case 'departments': return checkOk('departments');
        default: return true;
    }
}

type ReadinessKey = CsiPeriodDetail['readiness']['checks'][number]['key'];

/** Wizard step where each readiness check is fixed. */
export const READINESS_STEP: Readonly<Record<ReadinessKey, WizardStepKey>> = {
    ratees: 'ratees',
    dimensions: 'ratees',
    raters: 'raters',
    departments: 'departments',
};

/** Where a draft resumes: the first visible step that is still incomplete, else the review. */
export function resumeStep(period: CsiPeriodDetail): WizardStepKey {
    return visibleSteps(period.respondentMode).find((key) => !stepComplete(key, period)) ?? 'review';
}

export const isWizardStepKey = (value: string | null): value is WizardStepKey =>
    WIZARD_STEPS.some((step) => step.key === value);

export const CSI_SECONDS_PER_RATING = 10;
const SECONDS_PER_MINUTE = 60;

export function estimateMinutes(totalRatings: number): number {
    return Math.max(1, Math.ceil(totalRatings * CSI_SECONDS_PER_RATING / SECONDS_PER_MINUTE));
}
