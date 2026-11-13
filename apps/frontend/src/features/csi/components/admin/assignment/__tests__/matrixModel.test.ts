import { describe, expect, it } from 'vitest';
import type { CsiAssignments } from '../../../../types';
import {
    colCells, groupBySite, pairKey, rowCells, sameSiteCells, siteCells, stats, toggleCells, toPairs, toPairSet, withRateeUsers,
    type MatrixData, type PairKey,
} from '../matrixModel';

const VIEW: CsiAssignments = {
    raters: [
        { periodRaterId: 'r1', userId: 'u1', fullName: 'Andi', department: 'ICT', siteId: 's1' },
        { periodRaterId: 'r2', userId: 'u2', fullName: 'Budi', department: 'Finance', siteId: 's1' },
        { periodRaterId: 'r3', userId: 'u3', fullName: 'Citra', department: 'QC', siteId: 's2' },
    ],
    ratees: [
        { periodRateeId: 't1', kind: 'TEAM', name: 'Tim SPJ', siteId: 's1', photoUrl: null },
        { periodRateeId: 'e1', kind: 'PERSON', name: 'Andi', siteId: 's1', photoUrl: null },
        { periodRateeId: 'e3', kind: 'PERSON', name: 'Dedi', siteId: 's2', photoUrl: null },
    ],
    pairs: [],
};
const DATA: MatrixData = withRateeUsers(VIEW, [{ id: 't1', userId: null }, { id: 'e1', userId: 'u1' }, { id: 'e3', userId: 'u9' }]);

describe('matrixModel', () => {
    it('toggleCells adds all when any is missing and removes all when all present', () => {
        const cells: PairKey[] = [pairKey('r1', 't1'), pairKey('r2', 't1')];
        const half = new Set<PairKey>([pairKey('r1', 't1')]);
        const added = toggleCells(half, cells);
        expect([...added].sort()).toEqual([...cells].sort());
        expect(half.size).toBe(1);
        expect(toggleCells(added, cells).size).toBe(0);
    });

    it('rowCells skips self', () => {
        expect(rowCells(DATA, 'r1')).toEqual([pairKey('r1', 't1'), pairKey('r1', 'e3')]);
        expect(colCells(DATA, 'e1')).toEqual([pairKey('r2', 'e1'), pairKey('r3', 'e1')]);
    });

    it('siteCells pairs raters of the site with subjects of the site only', () => {
        expect(siteCells(DATA, 's1')).toEqual([pairKey('r1', 't1'), pairKey('r2', 't1'), pairKey('r2', 'e1')]);
        expect(siteCells(DATA, 's2')).toEqual([pairKey('r3', 'e3')]);
    });

    it('stats counts cross-site pairs', () => {
        const pairs = new Set<PairKey>([pairKey('r1', 't1'), pairKey('r1', 'e3'), pairKey('r3', 'e1')]);
        expect(stats(DATA, pairs)).toEqual({ raters: 3, subjects: 3, teams: 1, people: 2, pairs: 3, cross: 2 });
    });

    it('toPairs drops self and unknown members', () => {
        const pairs = new Set<PairKey>([pairKey('r1', 'e1'), pairKey('r2', 'e1'), pairKey('gone', 'e1')]);
        expect(toPairs(DATA, pairs)).toEqual([{ periodRaterId: 'r2', periodRateeId: 'e1' }]);
        expect(toPairSet([{ periodRaterId: 'r2', periodRateeId: 'e1' }])).toEqual(new Set([pairKey('r2', 'e1')]));
    });
});

describe('matrixModel helpers', () => {
    it('sameSiteCells pairs every rater with the subjects of their own site', () => {
        expect([...sameSiteCells(DATA)].sort()).toEqual([pairKey('r1', 't1'), pairKey('r2', 'e1'), pairKey('r2', 't1'), pairKey('r3', 'e3')].sort());
    });

    it('groupBySite keeps the period order, then other sites, then site-less', () => {
        const items = [{ id: 'a', siteId: 's9' }, { id: 'b', siteId: null }, { id: 'c', siteId: 's2' }, { id: 'd', siteId: 's1' }];
        expect(groupBySite(items, ['s1', 's2', 's3']).map((group) => group.siteId)).toEqual(['s1', 's2', 's9', null]);
    });

    it('sameSiteCells, siteCells and stats treat delegated sites (SKD -> SPJ) as one effective site', () => {
        const delegatedView: CsiAssignments = {
            raters: [
                ...VIEW.raters,
                { periodRaterId: 'r4', userId: 'u4', fullName: 'Dina (SKD)', department: 'QA', siteId: 'skd' },
            ],
            ratees: VIEW.ratees,
            pairs: [],
            siteHandlers: { skd: 's1' },
        };
        const delegated = withRateeUsers(delegatedView, [{ id: 't1', userId: null }, { id: 'e1', userId: 'u1' }, { id: 'e3', userId: 'u9' }]);
        expect(siteCells(delegated, 's1')).toContain(pairKey('r4', 't1'));
        expect(siteCells(delegated, 's1')).toContain(pairKey('r4', 'e1'));
        expect(sameSiteCells(delegated).has(pairKey('r4', 't1'))).toBe(true);
        const s = stats(delegated, new Set<PairKey>([pairKey('r4', 't1')]));
        expect(s.cross).toBe(0);
    });
});
