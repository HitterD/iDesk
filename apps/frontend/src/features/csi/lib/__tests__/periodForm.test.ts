import { describe, expect, it } from 'vitest';
import type { CsiPeriodDetail, CsiPeriodListItem } from '../../types';
import {
    nextPeriodRange,
    formDirty, initialState, scoreBandsError, sectionsInvalid, slaInvalid, toCreatePayload, toUpdatePayload, withCopyMode, withCopySource,
} from '../periodForm';

const STAMP = { createdAt: '', updatedAt: '' };
const SITES = [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }, { id: 's2', code: 'BKS', name: 'Bekasi' }];
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', sites: SITES, title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', publishStatus: 'DRAFT', teamEnabled: true, teamLabel: 'Tim X', individualEnabled: true, slaTargetPct: 90, scoreFairMin: 4, scoreGoodMin: 4.5,
    createdById: 'a', status: 'ACTIVE', locked: false, readiness: { ready: false, checks: [] }, ratees: [], raters: [], ...STAMP, ...over,
});

describe('periodForm', () => {
    it('starts a new survey with defaults: individual on, team off, label and SLA defaults', () => {
        expect(initialState('ict')).toMatchObject({
            siteIds: [], teamEnabled: false, individualEnabled: true, teamLabel: 'Tim IT Support', slaTargetPct: '80',
            scoreFairMin: '4.0', scoreGoodMin: '4.5',
        });
    });

    it('HC surveys default to an SLA target of 90 (ICT keeps 80)', () => {
        expect(initialState('hc').slaTargetPct).toBe('90');
        expect(initialState('ict').slaTargetPct).toBe('80');
    });

    it('validates the colour bands: 1-5, steps of 0.1, orange below green', () => {
        const form = initialState('ict');
        expect(scoreBandsError(form)).toBeNull();
        expect(scoreBandsError({ ...form, scoreFairMin: '3.5', scoreGoodMin: '4.2' })).toBeNull();
        expect(scoreBandsError({ ...form, scoreFairMin: '0.5' })).toBe('Batas oranye harus angka 1–5 dengan kelipatan 0,1');
        expect(scoreBandsError({ ...form, scoreFairMin: '' })).toBe('Batas oranye harus angka 1–5 dengan kelipatan 0,1');
        expect(scoreBandsError({ ...form, scoreFairMin: '4.25' })).toBe('Batas oranye harus angka 1–5 dengan kelipatan 0,1');
        expect(scoreBandsError({ ...form, scoreGoodMin: '5.1' })).toBe('Batas hijau harus angka 1–5 dengan kelipatan 0,1');
        expect(scoreBandsError({ ...form, scoreFairMin: '4.5', scoreGoodMin: '4.5' })).toBe('Batas oranye harus lebih kecil dari batas hijau');
        expect(scoreBandsError({ ...form, scoreFairMin: '4.6' })).toBe('Batas oranye harus lebih kecil dari batas hijau');
    });

    it('sends the colour bands on create and update, and an edited band makes the form dirty', () => {
        const form = { ...initialState('hc'), scoreFairMin: '3.5', scoreGoodMin: '4.2' };
        expect(toCreatePayload(form)).toMatchObject({ slaTargetPct: 90, scoreFairMin: 3.5, scoreGoodMin: 4.2 });
        const saved = period({ locked: true });
        const edited = { ...initialState('ict', saved), scoreGoodMin: '4.4' };
        expect(formDirty(initialState('ict', saved), saved)).toBe(false);
        expect(formDirty(edited, saved)).toBe(true);
        expect(toUpdatePayload(edited, true)).toMatchObject({ scoreFairMin: 4, scoreGoodMin: 4.4 });
    });

    it('cannot turn off both sections', () => {
        const form = initialState('ict');
        expect(sectionsInvalid(form)).toBe(false);
        expect(sectionsInvalid({ ...form, individualEnabled: false })).toBe(true);
        expect(sectionsInvalid({ ...form, individualEnabled: false, teamEnabled: true })).toBe(false);
    });

    it('validates the SLA target as an integer 1-100', () => {
        const form = initialState('ict');
        ['0', '101', '', '80.5', 'abc'].forEach((value) => expect(slaInvalid({ ...form, slaTargetPct: value })).toBe(true));
        ['1', '80', '100'].forEach((value) => expect(slaInvalid({ ...form, slaTargetPct: value })).toBe(false));
    });

    it('create payload sends siteIds, sections, label and SLA', () => {
        const form = { ...initialState('ict'), siteIds: ['s1', 's2'], title: ' Q4 ', startDate: '2026-11-01', endDate: '2026-11-30', teamEnabled: true };
        expect(toCreatePayload(form)).toEqual({
            title: 'Q4', intro: '', thankYou: '', startDate: '2026-11-01', endDate: '2026-11-30', slaTargetPct: 80,
            scoreFairMin: 4, scoreGoodMin: 4.5, siteIds: ['s1', 's2'], respondentMode: 'LISTED', teamEnabled: true, individualEnabled: true, teamLabel: 'Tim IT Support',
        });
    });

    it('omits frozen fields from the update payload when locked but keeps SLA, texts and dates', () => {
        const form = { ...initialState('ict', period({ locked: true })), slaTargetPct: '70' };
        expect(toUpdatePayload(form, true)).toEqual({ title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31', slaTargetPct: 70, scoreFairMin: 4, scoreGoodMin: 4.5 });
        expect(toUpdatePayload(form, false)).toMatchObject({ siteIds: ['s1', 's2'], teamEnabled: true, teamLabel: 'Tim X' });
    });

    it('is dirty only for editable changes when locked, and for site changes when unlocked', () => {
        const unlocked = period();
        const base = initialState('ict', unlocked);
        expect(formDirty(base, unlocked)).toBe(false);
        expect(formDirty({ ...base, siteIds: ['s2', 's1'] }, unlocked)).toBe(false);
        expect(formDirty({ ...base, siteIds: ['s1'] }, unlocked)).toBe(true);
        expect(formDirty({ ...base, slaTargetPct: '70' }, unlocked)).toBe(true);
        const locked = period({ locked: true });
        expect(formDirty({ ...base, siteIds: ['s1'], teamEnabled: false }, locked)).toBe(false);
        expect(formDirty({ ...base, endDate: '2026-11-05' }, locked)).toBe(true);
    });

    it('copy brings the sites and sections of the source, clears dates, and the user can override the sites', () => {
        const source: CsiPeriodListItem = { ...period({ id: 'old', title: 'Lama', sites: [SITES[1]], teamEnabled: false, slaTargetPct: 95, scoreFairMin: 3.5, scoreGoodMin: 4.2 }), responseCount: 3 };
        const copying = withCopyMode({ ...initialState('ict'), startDate: '2026-11-01', endDate: '2026-11-30' }, true);
        const copied = withCopySource(copying, [source], 'old');
        expect(copied).toMatchObject({ copyFromPeriodId: 'old', siteIds: ['s2'], teamEnabled: false, slaTargetPct: '95', scoreFairMin: '3.5', scoreGoodMin: '4.2', startDate: '', endDate: '' });
        expect(toCreatePayload({ ...copied, siteIds: ['s1'], startDate: '2026-12-01', endDate: '2026-12-31' }))
            .toMatchObject({ siteIds: ['s1'], copyFromPeriodId: 'old' });
    });

    it('nextPeriodRange: a whole-month survey moves to the next whole month, other ranges keep their length', () => {
        expect(nextPeriodRange({ startDate: '2026-10-01', endDate: '2026-10-31' })).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' });
        expect(nextPeriodRange({ startDate: '2026-01-01', endDate: '2026-03-31' })).toEqual({ startDate: '2026-04-01', endDate: '2026-06-30' });
        expect(nextPeriodRange({ startDate: '2026-11-04', endDate: '2026-11-06' })).toEqual({ startDate: '2026-11-07', endDate: '2026-11-09' });
    });
});
