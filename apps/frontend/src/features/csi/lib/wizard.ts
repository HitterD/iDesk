import type { CsiDepartment, CsiDimension, CsiOpenForm, CsiPeriodDetail } from '../types';
import { orderRatees } from './csiForm';

type PeriodRatee = CsiPeriodDetail['ratees'][number];

/** Same section rule as the respondent form: TEAM only while the team section is on, PERSON only while individuals are. */
const inEnabledSection = (period: CsiPeriodDetail) => (ratee: PeriodRatee) =>
    ratee.kind === 'TEAM' ? period.teamEnabled : period.individualEnabled;

/**
 * Admin preview uses snapshot labels and master descriptions. Unlike the live form it never excludes the
 * admin themself; disabled sections are hidden and the team screen comes first.
 */
export function toPreviewForm(
    period: CsiPeriodDetail, departments: CsiDepartment[], dimensions: CsiDimension[], respondentName: string,
): CsiOpenForm {
    const descriptions = new Map(dimensions.map((dimension) => [dimension.id, dimension.description]));
    return {
        id: period.id, scope: period.scope, title: period.title,
        intro: period.intro, endDate: period.endDate, teamLabel: period.teamLabel, submittedNames: [], respondent: { fullName: respondentName },
        departments: departments.filter((department) => department.isActive).map(({ id, name }) => ({ id, name })),
        ratees: orderRatees([...period.ratees].filter(inEnabledSection(period)).sort((a, b) => a.sortOrder - b.sortOrder).map((ratee) => ({
            periodRateeId: ratee.id, kind: ratee.kind, displayName: ratee.displayName, jobTitle: ratee.jobTitle, avatarUrl: ratee.photoUrl ?? null,
            siteId: ratee.siteId ?? null, siteCode: period.sites.find((site) => site.id === ratee.siteId)?.code ?? null,
            tagline: ratee.tagline ?? null, photoUrl: ratee.photoUrl ?? null,
            dimensions: [...ratee.dimensions].sort((a, b) => a.sortOrder - b.sortOrder).map((dimension) => ({
                periodRateeDimensionId: dimension.id, name: dimension.dimensionName,
                description: descriptions.get(dimension.dimensionId) ?? null,
                type: dimension.type, required: dimension.required, options: dimension.options,
            })),
        }))),
    };
}

export type WizardStepKey = 'info' | 'questions' | 'team' | 'ratees' | 'raters' | 'pairs' | 'departments' | 'review';

export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; label: string }> = [
    { key: 'info', label: 'Info survei' },
    { key: 'questions', label: 'Pertanyaan' },
    { key: 'team', label: 'Penilaian tim' },
    { key: 'ratees', label: 'Orang yang dinilai' },
    { key: 'raters', label: 'Penilai' },
    { key: 'pairs', label: 'Siapa menilai siapa' },
    { key: 'departments', label: 'Departemen' },
    { key: 'review', label: 'Tinjau & terbitkan' },
];

export type WizardSections = Pick<CsiPeriodDetail, 'respondentMode' | 'teamEnabled' | 'individualEnabled'>;

const stepVisible = (key: WizardStepKey, period: WizardSections): boolean => {
    switch (key) {
        case 'team': return period.teamEnabled;
        case 'ratees': return period.individualEnabled;
        case 'raters':
        case 'pairs': return period.respondentMode === 'LISTED';
        default: return true;
    }
};

/** A survey that does not exist yet only has its info step; later steps depend on the sections chosen there. */
export function visibleSteps(period: WizardSections | null): WizardStepKey[] {
    if (!period) return ['info'];
    return WIZARD_STEPS.filter((step) => stepVisible(step.key, period)).map((step) => step.key);
}

export function nextStep(period: WizardSections | null, current: WizardStepKey): WizardStepKey | null {
    const steps = visibleSteps(period);
    const index = steps.indexOf(current);
    return index < 0 ? null : steps[index + 1] ?? null;
}

export function previousStep(period: WizardSections | null, current: WizardStepKey): WizardStepKey | null {
    const steps = visibleSteps(period);
    return steps[steps.indexOf(current) - 1] ?? null;
}

/**
 * Whether a step of an existing period counts as done (stepper tick, resume point).
 * `activeQuestionCount` = active questions in the scope (the questions step has no server check).
 */
export function stepComplete(key: WizardStepKey, period: CsiPeriodDetail, activeQuestionCount: number): boolean {
    const checkOk = (checkKey: CsiPeriodDetail['readiness']['checks'][number]['key']) =>
        period.readiness.checks.some((check) => check.key === checkKey && check.ok);
    switch (key) {
        case 'questions': return activeQuestionCount > 0;
        case 'team': return checkOk('team');
        case 'ratees': return checkOk('ratees') && checkOk('dimensions');
        case 'raters':
        case 'pairs': return checkOk('raters');
        case 'departments': return checkOk('departments');
        case 'review': return period.publishStatus === 'PUBLISHED';
        default: return true;
    }
}

type ReadinessKey = CsiPeriodDetail['readiness']['checks'][number]['key'];

/** Wizard step where each readiness check is fixed. */
export const READINESS_STEP: Readonly<Record<ReadinessKey, WizardStepKey>> = {
    team: 'team',
    ratees: 'ratees',
    dimensions: 'ratees',
    raters: 'raters',
    departments: 'departments',
};

/** Where a draft resumes: the first visible step that is still incomplete, else the review. */
export function resumeStep(period: CsiPeriodDetail, activeQuestionCount: number): WizardStepKey {
    return visibleSteps(period)
        .find((key) => key !== 'review' && !stepComplete(key, period, activeQuestionCount)) ?? 'review';
}

export const isWizardStepKey = (value: string | null): value is WizardStepKey =>
    WIZARD_STEPS.some((step) => step.key === value);

export const CSI_SECONDS_PER_RATING = 10;
const SECONDS_PER_MINUTE = 60;

export function estimateMinutes(totalRatings: number): number {
    return Math.max(1, Math.ceil(totalRatings * CSI_SECONDS_PER_RATING / SECONDS_PER_MINUTE));
}
