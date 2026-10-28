import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, draftKey, hasDraft, loadDraft, saveDraft, type SurveyDraft } from '../surveyDraft';
import { CSI_ANSWER_TEXT_MAX, CSI_COMMENT_MAX } from '../csiForm';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({ createModuleLogger: () => ({ warn }) }));
import type { CsiOpenForm } from '../../types';

const star = (id: string) => ({ periodRateeDimensionId: id, name: 'Kecepatan', description: null, type: 'STAR' as const, required: true, options: [] });
const FORM: CsiOpenForm = {
    id: 'p1', scope: 'ICT', title: 'Survei', intro: '', endDate: '2026-10-31', teamLabel: 'Tim IT', submittedNames: [],
    respondent: { fullName: 'Rina' },
    departments: [{ id: 'd1', name: 'Finance' }],
    ratees: [
        { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: null, avatarUrl: null, dimensions: [
            star('x1'),
            { periodRateeDimensionId: 'x2', name: 'Keramahan', description: null, type: 'SCALE', required: true, options: [{ label: 'Baik', points: 5 }, { label: 'Buruk', points: 1 }] },
            { periodRateeDimensionId: 'x3', name: 'Saran', description: null, type: 'TEXT', required: false, options: [] },
        ] },
        { periodRateeId: 'r2', kind: 'PERSON', displayName: 'Budi', jobTitle: null, avatarUrl: null, dimensions: [star('y1')] },
    ],
};
const KEY = draftKey('u1', 'p1');
const DRAFT: SurveyDraft = {
    respondentName: 'Rina', departmentId: 'd1', answers: { x1: { score: 5 }, x2: { optionIndex: 1 }, y1: { score: 3 } },
    comments: { r1: 'Mantap' }, position: 2,
};

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe('surveyDraft', () => {
    it('uses the csi-draft:v2:<userId>:<periodId> key', () => {
        expect(KEY).toBe('csi-draft:v2:u1:p1');
    });

    it('detects drafts only for the matching user and period', () => {
        expect(hasDraft('u1', 'p1')).toBe(false);
        saveDraft(KEY, DRAFT);
        expect(hasDraft('u1', 'p1')).toBe(true);
        expect(hasDraft('u2', 'p1')).toBe(false);
        expect(hasDraft('u1', 'p2')).toBe(false);
        clearDraft(KEY);
        expect(hasDraft('u1', 'p1')).toBe(false);
    });

    it('round-trips draft', () => {
        saveDraft(KEY, DRAFT);
        expect(loadDraft(KEY, FORM)).toEqual(DRAFT);
        clearDraft(KEY);
        expect(loadDraft(KEY, FORM)).toBeNull();
    });

    it('drops answers for unknown dimensions and invalid values per type', () => {
        saveDraft(KEY, {
            ...DRAFT,
            answers: { x1: { score: 9 }, gone: { score: 5 }, x2: { optionIndex: 2 }, y1: { score: 4 }, x3: { text: '   ' } },
            comments: { r1: 'ok', rX: 'hilang' },
        });
        expect(loadDraft(KEY, FORM)).toEqual({ ...DRAFT, answers: { y1: { score: 4 } }, comments: { r1: 'ok' } });
    });

    it('keeps trimmed text and clamps it to the answer limit', () => {
        saveDraft(KEY, { ...DRAFT, answers: { x3: { text: `  ${'a'.repeat(CSI_ANSWER_TEXT_MAX + 20)}` } } });
        expect(loadDraft(KEY, FORM)?.answers.x3?.text).toHaveLength(CSI_ANSWER_TEXT_MAX);
    });

    it('ignores v1 drafts entirely', () => {
        localStorage.setItem('csi-draft:u1:p1', JSON.stringify({ departmentId: 'd1', scores: { x1: 5 }, comments: {}, position: 1 }));
        expect(hasDraft('u1', 'p1')).toBe(false);
        expect(loadDraft(KEY, FORM)).toBeNull();
    });

    it('falls back to the account name when the stored name is invalid', () => {
        saveDraft(KEY, { ...DRAFT, respondentName: 'x' });
        expect(loadDraft(KEY, FORM)?.respondentName).toBe('Rina');
        saveDraft(KEY, { ...DRAFT, respondentName: '  Rina Dua  ' });
        expect(loadDraft(KEY, FORM)?.respondentName).toBe('Rina Dua');
    });

    it('drops department not in form', () => {
        saveDraft(KEY, { ...DRAFT, departmentId: 'dX' });
        expect(loadDraft(KEY, FORM)?.departmentId).toBe('');
    });

    it('clamps position', () => {
        saveDraft(KEY, { ...DRAFT, position: 99 });
        expect(loadDraft(KEY, FORM)?.position).toBe(FORM.ratees.length + 1);
        saveDraft(KEY, { ...DRAFT, position: -3 });
        expect(loadDraft(KEY, FORM)?.position).toBe(0);
    });

    it('clamps restored comments to CSI_COMMENT_MAX', () => {
        saveDraft(KEY, { ...DRAFT, comments: { r1: 'x'.repeat(CSI_COMMENT_MAX + 50) } });
        expect(loadDraft(KEY, FORM)?.comments.r1).toHaveLength(CSI_COMMENT_MAX);
    });

    it('returns null for malformed JSON', () => {
        localStorage.setItem(KEY, '{not json');
        expect(loadDraft(KEY, FORM)).toBeNull();
    });

    it('ignores storage errors', () => {
        const boom = () => { throw new Error('QuotaExceededError'); };
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
        expect(() => saveDraft(KEY, DRAFT)).not.toThrow();
        expect(loadDraft(KEY, FORM)).toBeNull();
        expect(hasDraft('u1', 'p1')).toBe(false);
        expect(() => clearDraft(KEY)).not.toThrow();
        expect(() => saveDraft(KEY, DRAFT)).not.toThrow();
        // Autosave hits storage on every change: one warning per session is enough.
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
