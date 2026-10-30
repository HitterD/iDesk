import { describe, expect, it } from 'vitest';
import type { CsiPeriodDetail, CsiPeriodListItem } from '../../types';
import {
    formDirty, initialState, sectionsInvalid, slaInvalid, toCreatePayload, toUpdatePayload, withCopyMode, withCopySource,
} from '../periodForm';

const STAMP = { createdAt: '', updatedAt: '' };
const SITES = [{ id: 's1', code: 'SPJ', name: 'Sidoarjo' }, { id: 's2', code: 'BKS', name: 'Bekasi' }];
const period = (over: Partial<CsiPeriodDetail> = {}): CsiPeriodDetail => ({
    id: 'p1', scope: 'ICT', sites: SITES, title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'OPEN', publishStatus: 'DRAFT', teamEnabled: true, teamLabel: 'Tim X', individualEnabled: true, slaTargetPct: 90,
    createdById: 'a', status: 'ACTIVE', locked: false, readiness: { ready: false, checks: [] }, ratees: [], raters: [], ...STAMP, ...over,
});

describe('periodForm', () => {
    it('starts a new survey with defaults: individual on, team off, label and SLA defaults', () => {
        expect(initialState('ict')).toMatchObject({
            siteIds: [], teamEnabled: false, individualEnabled: true, teamLabel: 'Tim IT Support', slaTargetPct: '80',
        });
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
            siteIds: ['s1', 's2'], respondentMode: 'LISTED', teamEnabled: true, individualEnabled: true, teamLabel: 'Tim IT Support',
        });
    });

    it('omits frozen fields from the update payload when locked but keeps SLA, texts and dates', () => {
        const form = { ...initialState('ict', period({ locked: true })), slaTargetPct: '70' };
        expect(toUpdatePayload(form, true)).toEqual({ title: 'Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31', slaTargetPct: 70 });
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
        const source: CsiPeriodListItem = { ...period({ id: 'old', title: 'Lama', sites: [SITES[1]], teamEnabled: false, slaTargetPct: 95 }), responseCount: 3 };
        const copying = withCopyMode({ ...initialState('ict'), startDate: '2026-11-01', endDate: '2026-11-30' }, true);
        const copied = withCopySource(copying, [source], 'old');
        expect(copied).toMatchObject({ copyFromPeriodId: 'old', siteIds: ['s2'], teamEnabled: false, slaTargetPct: '95', startDate: '', endDate: '' });
        expect(toCreatePayload({ ...copied, siteIds: ['s1'], startDate: '2026-12-01', endDate: '2026-12-31' }))
            .toMatchObject({ siteIds: ['s1'], copyFromPeriodId: 'old' });
    });
});
