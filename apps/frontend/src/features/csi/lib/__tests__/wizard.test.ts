import { describe, expect, it } from 'vitest';
import type { CsiPeriodDetail, CsiRespondentMode } from '../../types';
import {
    toPreviewForm, estimateMinutes, isWizardStepKey, nextStep, previousStep, READINESS_STEP, resumeStep, stepComplete, visibleSteps, WIZARD_STEPS,
} from '../wizard';

const period = (checks: CsiPeriodDetail['readiness']['checks']): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', teamEnabled: false, teamLabel: 'Tim IT Support', individualEnabled: true, slaTargetPct: 80, title: '', intro: '', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'LISTED', createdById: 'a1',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    sites: [], status: 'ACTIVE', publishStatus: 'DRAFT', locked: false, ratees: [], raters: [],
    readiness: { ready: false, checks },
});
const check = (key: CsiPeriodDetail['readiness']['checks'][number]['key'], ok: boolean) => ({ key, ok, label: key });

type Sections = Pick<CsiPeriodDetail, 'respondentMode' | 'teamEnabled' | 'individualEnabled'>;
const sections = (over: Partial<Sections> = {}): Sections => ({ respondentMode: 'LISTED', teamEnabled: true, individualEnabled: true, ...over });

describe('wizard steps', () => {
    it('uses the revision 2 step order and Indonesian labels', () => {
        expect(WIZARD_STEPS).toEqual([
            { key: 'info', label: 'Info survei' },
            { key: 'questions', label: 'Pertanyaan' },
            { key: 'team', label: 'Penilaian tim' },
            { key: 'ratees', label: 'Orang yang dinilai' },
            { key: 'raters', label: 'Penilai' },
            { key: 'pairs', label: 'Siapa menilai siapa' },
            { key: 'departments', label: 'Departemen' },
            { key: 'review', label: 'Tinjau & terbitkan' },
        ]);
    });

    it('a new survey (no period) only shows the info step', () => {
        expect(visibleSteps(null)).toEqual(['info']);
    });

    it('visibleSteps hides team when disabled and ratees when individual disabled', () => {
        expect(visibleSteps(sections())).toEqual(['info', 'questions', 'team', 'ratees', 'raters', 'pairs', 'departments', 'review']);
        expect(visibleSteps(sections({ teamEnabled: false }))).toEqual(['info', 'questions', 'ratees', 'raters', 'pairs', 'departments', 'review']);
        expect(visibleSteps(sections({ individualEnabled: false }))).toEqual(['info', 'questions', 'team', 'raters', 'pairs', 'departments', 'review']);
    });

    it('hides raters for OPEN and keeps it for LISTED', () => {
        expect(visibleSteps(sections({ respondentMode: 'OPEN' }))).toEqual(['info', 'questions', 'team', 'ratees', 'departments', 'review']);
    });

    it.each<CsiRespondentMode>(['OPEN', 'LISTED'])('walks visible steps with null at both ends in %s mode', (respondentMode) => {
        const current = sections({ respondentMode });
        const steps = visibleSteps(current);
        steps.forEach((step, index) => {
            expect(nextStep(current, step)).toBe(steps[index + 1] ?? null);
            expect(previousStep(current, step)).toBe(steps[index - 1] ?? null);
        });
    });

    it('returns null when the current step is hidden', () => {
        expect(nextStep(sections({ respondentMode: 'OPEN' }), 'raters')).toBeNull();
        expect(previousStep(sections({ teamEnabled: false }), 'team')).toBeNull();
    });
});

const QUESTIONS = 2;

describe('stepComplete', () => {
    it('completes info once the period exists, independently of readiness', () => {
        expect(stepComplete('info', period([]), 0)).toBe(true);
    });

    it('completes questions only when the scope has at least one active question', () => {
        expect(stepComplete('questions', period([]), 0)).toBe(false);
        expect(stepComplete('questions', period([]), 1)).toBe(true);
    });

    it('completes team from the server team check', () => {
        expect(stepComplete('team', period([check('team', true)]), QUESTIONS)).toBe(true);
        expect(stepComplete('team', period([check('team', false)]), QUESTIONS)).toBe(false);
        expect(stepComplete('team', period([]), QUESTIONS)).toBe(false);
    });

    it('completes review only once the survey is published', () => {
        const ready = { ...period([]), readiness: { ready: true, checks: [] } };
        expect(stepComplete('review', ready, QUESTIONS)).toBe(false);
        expect(stepComplete('review', { ...ready, publishStatus: 'PUBLISHED' }, QUESTIONS)).toBe(true);
    });

    it.each([[false, false], [false, true], [true, false], [true, true]])(
        'requires both ratees (%s) and assigned questions (%s)', (ratees, dimensions) => {
            expect(stepComplete('ratees', period([check('ratees', ratees), check('dimensions', dimensions)]), QUESTIONS))
                .toBe(ratees && dimensions);
        },
    );

    it.each(['raters', 'departments'] as const)('uses the server %s check, not overall readiness', (key) => {
        expect(stepComplete(key, period([check(key, true)]), QUESTIONS)).toBe(true);
        expect(stepComplete(key, period([check(key, false)]), QUESTIONS)).toBe(false);
        expect(stepComplete(key, period([]), QUESTIONS)).toBe(false);
    });

    it('does not complete ratees with a missing prerequisite check', () => {
        expect(stepComplete('ratees', period([check('ratees', true)]), QUESTIONS)).toBe(false);
        expect(stepComplete('ratees', period([check('dimensions', true)]), QUESTIONS)).toBe(false);
    });
});

describe('resumeStep', () => {
    it('resumes at the first incomplete visible step', () => {
        expect(resumeStep(period([check('ratees', false), check('dimensions', true), check('raters', false)]), QUESTIONS)).toBe('ratees');
        expect(resumeStep(period([check('ratees', true), check('dimensions', true), check('raters', false), check('departments', true)]), QUESTIONS)).toBe('raters');
    });

    it('resumes at questions when the scope has no active question yet', () => {
        expect(resumeStep(period([check('ratees', false)]), 0)).toBe('questions');
    });

    it('resumes at team when team is enabled and its check fails', () => {
        const team = { ...period([check('team', false), check('ratees', true), check('dimensions', true)]), teamEnabled: true };
        expect(resumeStep(team, QUESTIONS)).toBe('team');
    });

    it('skips the hidden raters step for OPEN and lands on review when everything is complete', () => {
        const open = { ...period([check('ratees', true), check('dimensions', true), check('departments', true)]), respondentMode: 'OPEN' as const };
        expect(resumeStep(open, QUESTIONS)).toBe('review');
    });

    it('maps every readiness check to the step that fixes it', () => {
        expect(READINESS_STEP).toEqual({ team: 'team', ratees: 'ratees', dimensions: 'ratees', raters: 'raters', departments: 'departments' });
    });

    it('recognises only known step keys and no longer the old dimensions key', () => {
        expect(isWizardStepKey('ratees')).toBe(true);
        expect(isWizardStepKey('team')).toBe(true);
        expect(isWizardStepKey('dimensions')).toBe(false);
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
                { ...base, id: 'r2', periodId: 'p1', kind: 'PERSON' as const, userId: 'u2', displayName: 'Budi', jobTitle: null, sortOrder: 2, dimensions: [] },
                { ...base, id: 'r1', periodId: 'p1', kind: 'PERSON' as const, userId: 'a1', displayName: 'Admin', jobTitle: 'Support', sortOrder: 1, dimensions: [
                    { ...base, id: 'x2', periodRateeId: 'r1', dimensionId: 'missing', dimensionName: 'Solusi', type: 'STAR' as const, required: true, options: [], sortOrder: 2 },
                    { ...base, id: 'x1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Respons tersimpan', type: 'STAR' as const, required: true, options: [], sortOrder: 1 },
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
            teamLabel: 'Tim IT Support', submittedNames: [], id: 'p1', scope: 'ICT', title: 'ICT Q4', intro: 'Nilai tim kami', endDate: '2026-10-31',
            respondent: { fullName: 'Admin' },
            departments: [{ id: 'g2', name: 'Produksi' }, { id: 'g1', name: 'Finance' }],
            ratees: [
                { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Admin', jobTitle: 'Support', avatarUrl: null,
                    siteId: null, siteCode: null, tagline: null, photoUrl: null, dimensions: [
                    { periodRateeDimensionId: 'x1', name: 'Respons tersimpan', description: 'Cepat ditanggapi', type: 'STAR' as const, required: true, options: [] },
                    { periodRateeDimensionId: 'x2', name: 'Solusi', description: null, type: 'STAR' as const, required: true, options: [] },
                ] },
                { periodRateeId: 'r2', kind: 'PERSON', displayName: 'Budi', jobTitle: null, avatarUrl: null, siteId: null, siteCode: null, tagline: null, photoUrl: null, dimensions: [] },
            ],
        });
        expect(source.ratees.map((ratee) => ratee.id)).toEqual(['r2', 'r1']);
        expect(source.ratees[1].dimensions.map((dimension) => dimension.id)).toEqual(['x2', 'x1']);
    });

    it('puts the team screen first and hides disabled sections', () => {
        const base = { createdAt: '', updatedAt: '', periodId: 'p1', userId: null, jobTitle: null };
        const scale = { ...base, id: 't1', periodRateeId: 'rt', dimensionId: 'd9', dimensionName: 'Kualitas', type: 'SCALE' as const, required: false,
            options: [{ label: 'Baik', points: 5 }], sortOrder: 1 };
        const ratees = [
            { ...base, id: 'r1', kind: 'PERSON' as const, userId: 'u2', displayName: 'Budi', sortOrder: 1, dimensions: [] },
            { ...base, id: 'rt', kind: 'TEAM' as const, displayName: 'Tim IT Support', sortOrder: 2, dimensions: [scale] },
        ];
        const both = toPreviewForm({ ...period([]), teamEnabled: true, ratees }, [], [], 'Admin');
        expect(both.ratees.map((ratee) => ratee.periodRateeId)).toEqual(['rt', 'r1']);
        expect(both.ratees[0]).toMatchObject({ kind: 'TEAM', dimensions: [{ type: 'SCALE', required: false, options: [{ label: 'Baik', points: 5 }] }] });
        expect(toPreviewForm({ ...period([]), teamEnabled: false, ratees }, [], [], 'Admin').ratees.map((ratee) => ratee.periodRateeId)).toEqual(['r1']);
        expect(toPreviewForm({ ...period([]), teamEnabled: true, individualEnabled: false, ratees }, [], [], 'Admin').ratees.map((ratee) => ratee.periodRateeId)).toEqual(['rt']);
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
