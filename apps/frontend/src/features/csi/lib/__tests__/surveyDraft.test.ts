import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, draftKey, hasDraft, loadDraft, saveDraft, type SurveyDraft } from '../surveyDraft';
import { CSI_COMMENT_MAX } from '../csiForm';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({ createModuleLogger: () => ({ warn }) }));
import type { CsiOpenForm } from '../../types';

const FORM: CsiOpenForm = {
    submitted: false, id: 'p1', scope: 'ICT', title: 'Survei', intro: '', endDate: '2026-10-31',
    respondent: { fullName: 'Rina' },
    departments: [{ id: 'd1', name: 'Finance' }],
    ratees: [
        { periodRateeId: 'r1', displayName: 'Andi', jobTitle: null, avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'x1', name: 'Kecepatan', description: null }] },
        { periodRateeId: 'r2', displayName: 'Budi', jobTitle: null, avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'y1', name: 'Kecepatan', description: null }] },
    ],
};
const KEY = draftKey('u1', 'p1');
const DRAFT: SurveyDraft = { departmentId: 'd1', scores: { x1: 5, y1: 3 }, comments: { r1: 'Mantap' }, position: 2 };

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe('surveyDraft', () => {
    it('uses the csi-draft:<userId>:<periodId> key', () => {
        expect(KEY).toBe('csi-draft:u1:p1');
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

    it('drops scores for unknown dimensions', () => {
        saveDraft(KEY, { ...DRAFT, scores: { x1: 4, gone: 5, y1: 9 }, comments: { r1: 'ok', rX: 'hilang' } });
        expect(loadDraft(KEY, FORM)).toEqual({ ...DRAFT, scores: { x1: 4 }, comments: { r1: 'ok' } });
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
