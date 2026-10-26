import { describe, expect, it } from 'vitest';
import type { CsiPeriodDetail, CsiRespondentMode } from '../../types';
import {
    estimateMinutes, isWizardStepKey, nextStep, previousStep, READINESS_STEP, resumeStep, stepComplete, visibleSteps, WIZARD_STEPS,
} from '../wizard';

const period = (checks: CsiPeriodDetail['readiness']['checks']): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', siteId: 's1', title: '', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'LISTED', createdById: 'a1',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    site: null, status: 'ACTIVE', publishStatus: 'DRAFT', locked: false, ratees: [], raters: [],
    readiness: { ready: false, checks },
});
const check = (key: CsiPeriodDetail['readiness']['checks'][number]['key'], ok: boolean) => ({ key, ok, label: key });

describe('wizard steps', () => {
    it('uses the approved step order and Indonesian labels', () => {
        expect(WIZARD_STEPS).toEqual([
            { key: 'info', label: 'Info survei' },
            { key: 'dimensions', label: 'Dimensi' },
            { key: 'ratees', label: 'Orang yang dinilai' },
            { key: 'raters', label: 'Penilai' },
            { key: 'departments', label: 'Departemen' },
            { key: 'review', label: 'Tinjau & terbitkan' },
        ]);
    });

    it('hides raters for OPEN and keeps it for LISTED', () => {
        expect(visibleSteps('OPEN')).toEqual(['info', 'dimensions', 'ratees', 'departments', 'review']);
        expect(visibleSteps('LISTED')).toEqual(['info', 'dimensions', 'ratees', 'raters', 'departments', 'review']);
    });

    it.each<CsiRespondentMode>(['OPEN', 'LISTED'])('walks visible steps with null at both ends in %s mode', (mode) => {
        const steps = visibleSteps(mode);
        steps.forEach((step, index) => {
            expect(nextStep(mode, step)).toBe(steps[index + 1] ?? null);
            expect(previousStep(mode, step)).toBe(steps[index - 1] ?? null);
        });
    });

    it('returns null when the current step is hidden', () => {
        expect(nextStep('OPEN', 'raters')).toBeNull();
        expect(previousStep('OPEN', 'raters')).toBeNull();
    });
});

describe('stepComplete', () => {
    it.each(['info', 'dimensions', 'review'] as const)('always completes %s independently of readiness', (key) => {
        expect(stepComplete(key, period([]))).toBe(true);
    });

    it.each([[false, false], [false, true], [true, false], [true, true]])(
        'requires both ratees (%s) and assigned dimensions (%s)', (ratees, dimensions) => {
            expect(stepComplete('ratees', period([check('ratees', ratees), check('dimensions', dimensions)])))
                .toBe(ratees && dimensions);
        },
    );

    it.each(['raters', 'departments'] as const)('uses the server %s check, not overall readiness', (key) => {
        expect(stepComplete(key, period([check(key, true)]))).toBe(true);
        expect(stepComplete(key, period([check(key, false)]))).toBe(false);
        expect(stepComplete(key, period([]))).toBe(false);
    });

    it('does not complete ratees with a missing prerequisite check', () => {
        expect(stepComplete('ratees', period([check('ratees', true)]))).toBe(false);
        expect(stepComplete('ratees', period([check('dimensions', true)]))).toBe(false);
    });
});

describe('resumeStep', () => {
    it('resumes at the first incomplete visible step', () => {
        expect(resumeStep(period([check('ratees', false), check('dimensions', true), check('raters', false)]))).toBe('ratees');
        expect(resumeStep(period([check('ratees', true), check('dimensions', true), check('raters', false), check('departments', true)]))).toBe('raters');
    });

    it('skips the hidden raters step for OPEN and lands on review when everything is complete', () => {
        const open = { ...period([check('ratees', true), check('dimensions', true), check('departments', true)]), respondentMode: 'OPEN' as const };
        expect(resumeStep(open)).toBe('review');
    });

    it('maps every readiness check to the step that fixes it', () => {
        expect(READINESS_STEP).toEqual({ ratees: 'ratees', dimensions: 'ratees', raters: 'raters', departments: 'departments' });
    });

    it('recognises only known step keys', () => {
        expect(isWizardStepKey('ratees')).toBe(true);
        expect(isWizardStepKey('nope')).toBe(false);
        expect(isWizardStepKey(null)).toBe(false);
    });
});

describe('estimateMinutes', () => {
    it.each([[0, 1], [1, 1], [6, 1], [7, 2], [18, 3]])('estimates %i ratings as %i minutes', (ratings, minutes) => {
        expect(estimateMinutes(ratings)).toBe(minutes);
    });
});
