import { describe, expect, it } from 'vitest';
import type { CsiPeriodDetail, CsiRespondentMode } from '../../types';
import {
    toPreviewForm, estimateMinutes, isWizardStepKey, nextStep, previousStep, READINESS_STEP, resumeStep, stepComplete, visibleSteps, WIZARD_STEPS,
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

const DIMENSIONS = 2;

describe('stepComplete', () => {
    it('completes info once the period exists, independently of readiness', () => {
        expect(stepComplete('info', period([]), 0)).toBe(true);
    });

    it('completes dimensions only when the scope has at least one active master dimension', () => {
        expect(stepComplete('dimensions', period([]), 0)).toBe(false);
        expect(stepComplete('dimensions', period([]), 1)).toBe(true);
    });

    it('completes review only once the survey is published', () => {
        const ready = { ...period([]), readiness: { ready: true, checks: [] } };
        expect(stepComplete('review', ready, DIMENSIONS)).toBe(false);
        expect(stepComplete('review', { ...ready, publishStatus: 'PUBLISHED' }, DIMENSIONS)).toBe(true);
    });

    it.each([[false, false], [false, true], [true, false], [true, true]])(
        'requires both ratees (%s) and assigned dimensions (%s)', (ratees, dimensions) => {
            expect(stepComplete('ratees', period([check('ratees', ratees), check('dimensions', dimensions)]), DIMENSIONS))
                .toBe(ratees && dimensions);
        },
    );

    it.each(['raters', 'departments'] as const)('uses the server %s check, not overall readiness', (key) => {
        expect(stepComplete(key, period([check(key, true)]), DIMENSIONS)).toBe(true);
        expect(stepComplete(key, period([check(key, false)]), DIMENSIONS)).toBe(false);
        expect(stepComplete(key, period([]), DIMENSIONS)).toBe(false);
    });

    it('does not complete ratees with a missing prerequisite check', () => {
        expect(stepComplete('ratees', period([check('ratees', true)]), DIMENSIONS)).toBe(false);
        expect(stepComplete('ratees', period([check('dimensions', true)]), DIMENSIONS)).toBe(false);
    });
});

describe('resumeStep', () => {
    it('resumes at the first incomplete visible step', () => {
        expect(resumeStep(period([check('ratees', false), check('dimensions', true), check('raters', false)]), DIMENSIONS)).toBe('ratees');
        expect(resumeStep(period([check('ratees', true), check('dimensions', true), check('raters', false), check('departments', true)]), DIMENSIONS)).toBe('raters');
    });

    it('resumes at dimensions when the scope has no active dimension yet', () => {
        expect(resumeStep(period([check('ratees', false)]), 0)).toBe('dimensions');
    });

    it('skips the hidden raters step for OPEN and lands on review when everything is complete', () => {
        const open = { ...period([check('ratees', true), check('dimensions', true), check('departments', true)]), respondentMode: 'OPEN' as const };
        expect(resumeStep(open, DIMENSIONS)).toBe('review');
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

describe('toPreviewForm', () => {
    it('maps period fields, preserves active department order and includes the admin among ordered ratees', () => {
        const base = { createdAt: '', updatedAt: '' };
        const source = {
            ...period([]), title: 'ICT Q4', intro: 'Nilai tim kami',
            ratees: [
                { ...base, id: 'r2', periodId: 'p1', userId: 'u2', displayName: 'Budi', jobTitle: null, sortOrder: 2, dimensions: [] },
                { ...base, id: 'r1', periodId: 'p1', userId: 'a1', displayName: 'Admin', jobTitle: 'Support', sortOrder: 1, dimensions: [
                    { ...base, id: 'x2', periodRateeId: 'r1', dimensionId: 'missing', dimensionName: 'Solusi', sortOrder: 2 },
                    { ...base, id: 'x1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Respons tersimpan', sortOrder: 1 },
                ] },
            ],
        };
        const department = { ...base, scope: 'ICT' as const, isActive: true, sortOrder: 0 };
        const result = toPreviewForm(source, [
            { ...department, id: 'g2', name: 'Produksi', sortOrder: 2 },
            { ...department, id: 'off', name: 'Lama', isActive: false },
            { ...department, id: 'g1', name: 'Finance', sortOrder: 1 },
        ], [{ ...department, id: 'd1', name: 'Respons master', description: 'Cepat ditanggapi' }], 'Admin');
        expect(result).toEqual({
            submitted: false, id: 'p1', scope: 'ICT', title: 'ICT Q4', intro: 'Nilai tim kami', endDate: '2026-10-31',
            respondent: { fullName: 'Admin' },
            departments: [{ id: 'g2', name: 'Produksi' }, { id: 'g1', name: 'Finance' }],
            ratees: [
                { periodRateeId: 'r1', displayName: 'Admin', jobTitle: 'Support', avatarUrl: null, dimensions: [
                    { periodRateeDimensionId: 'x1', name: 'Respons tersimpan', description: 'Cepat ditanggapi' },
                    { periodRateeDimensionId: 'x2', name: 'Solusi', description: null },
                ] },
                { periodRateeId: 'r2', displayName: 'Budi', jobTitle: null, avatarUrl: null, dimensions: [] },
            ],
        });
        expect(source.ratees.map((ratee) => ratee.id)).toEqual(['r2', 'r1']);
        expect(source.ratees[1].dimensions.map((dimension) => dimension.id)).toEqual(['x2', 'x1']);
    });

    it('supports an empty draft period', () => {
        expect(toPreviewForm(period([]), [], [], 'Admin').ratees).toEqual([]);
    });
});

describe('estimateMinutes', () => {
    it.each([[0, 1], [1, 1], [6, 1], [7, 2], [18, 3]])('estimates %i ratings as %i minutes', (ratings, minutes) => {
        expect(estimateMinutes(ratings)).toBe(minutes);
    });
});
