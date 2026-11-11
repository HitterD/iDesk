import { itemsForSite, overallStats, questionStat, rateeStats, ratingAverage } from './csi-report.calc';
import { CsiQuestionType } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';

describe('CSI text question report', () => {
    it('includes text answers without assigning a numeric average', () => {
        const dimension = { id: 'q1', dimensionName: 'Saran', type: CsiQuestionType.TEXT, options: [] } as unknown as CsiPeriodRateeDimension;
        const items = [{ responseId: 'a', periodRateeId: 'r1', periodRateeDimensionId: 'q1', score: null, answerLabel: null, answerText: 'Respons sudah baik' }];
        const result = questionStat(dimension, items);
        expect(result.average).toBeNull();
        expect(result.distribution).toEqual([{ label: 'Respons sudah baik', count: 1 }]);
    });
});

describe('CSI report extras', () => {
    const ratee = { id: 'r1', kind: 'PERSON', displayName: 'Budi', jobTitle: null, siteId: 'site-a' } as unknown as CsiPeriodRatee;
    const dim = (id: string, type: CsiQuestionType, shortLabel?: string | null) =>
        ({ id, periodRateeId: 'r1', dimensionName: `Pertanyaan ${id}`, shortLabel, type, options: [] }) as unknown as CsiPeriodRateeDimension;
    const item = (responseId: string, dimensionId: string, score: number | null) =>
        ({ responseId, periodRateeId: 'r1', periodRateeDimensionId: dimensionId, score, answerLabel: null });

    it('star distribution counts scored answers per rounded value', () => {
        const dimensions = [dim('s', CsiQuestionType.STAR), dim('k', CsiQuestionType.SCALE), dim('c', CsiQuestionType.CHOICE)];
        const items = [item('a', 's', 5), item('a', 'k', 4.4), item('b', 's', 1), item('b', 'k', 2.5), item('b', 'c', null), item('c', 's', null)];
        const stats = rateeStats(ratee, dimensions, items);
        expect(stats.starDistribution).toEqual([1, 0, 1, 1, 1]);
        expect(stats.siteId).toBe('site-a');
        expect(stats.photoUrl).toBeNull();
        expect(rateeStats(ratee, dimensions, items, { siteId: 'site-b', photoUrl: '/p.jpg' })).toMatchObject({ siteId: 'site-b', photoUrl: '/p.jpg' });
    });

    it('shortLabel falls back to null', () => {
        expect(questionStat(dim('s', CsiQuestionType.STAR), []).shortLabel).toBeNull();
        expect(questionStat(dim('s', CsiQuestionType.STAR, 'Kecepatan'), []).shortLabel).toBe('Kecepatan');
    });

    it('description comes from the master question, null when absent', () => {
        const withMaster = { ...dim('s', CsiQuestionType.STAR), dimension: { description: '[Kecepatan respon]' } } as unknown as CsiPeriodRateeDimension;
        expect(questionStat(withMaster, []).description).toBe('[Kecepatan respon]');
        expect(questionStat(dim('s', CsiQuestionType.STAR), []).description).toBeNull();
    });

    it('items for a site keep only that site ratees answered by that site respondents', () => {
        const rows = [
            { ...item('a', 's', 5), periodRateeId: 'r1' }, { ...item('b', 's', 3), periodRateeId: 'r1' }, { ...item('a', 's', 4), periodRateeId: 'r2' },
        ];
        const kept = itemsForSite(rows, new Map([['r1', 'site-a'], ['r2', 'site-b']]), new Map([['a', 'site-a'], ['b', 'site-b']]), 'site-a');
        expect(kept).toEqual([rows[0]]);
    });
});

describe('CSI overall bases', () => {
    const item = (responseId: string, periodRateeId: string, score: number | null) =>
        ({ responseId, periodRateeId, periodRateeDimensionId: `${periodRateeId}-q`, score, answerLabel: null });
    // Response a: PIC h1 5,5 and PIC h2 1 -> per response 3.67, per rating 5 and 1. Response b: h1 3,3 -> 3.
    const items = [item('a', 'h1', 5), item('a', 'h1', 5), item('a', 'h2', 1), item('b', 'h1', 3), item('b', 'h1', 3), item('b', 'h2', null)];

    it('per-rating average: every (respondent, subject) pair weighs the same, unscored pairs are left out', () => {
        expect(ratingAverage(items)).toEqual({ average: 3, ratings: 3 });
        expect(overallStats(items, 2).average).not.toBe(3);
        expect(ratingAverage([])).toEqual({ average: null, ratings: 0 });
    });
});
