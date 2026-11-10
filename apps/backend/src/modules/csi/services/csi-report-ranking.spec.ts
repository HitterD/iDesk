import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind } from '../csi.constants';
import { competitionRanks, rankingByService, serviceHighlight } from './csi-report-ranking';
import { CSI_SCORE_BANDS_DEFAULT } from './csi-score-bands';

type Subject = Parameters<typeof rankingByService>[0]['subjects'][number];
const subject = (name: string, average: number | null, raters: number, extra: Partial<Subject> = {}): Subject => ({
    name, kind: CsiRateeKind.PERSON, average, raters, serviceCode: 'HCD', detail: null, previous: null, ...extra,
});
const bands = CSI_SCORE_BANDS_DEFAULT;

describe('csi-report-ranking', () => {
    it('ties share rank (rounded to 2 decimals), next rank skips', () => {
        const ranks = competitionRanks([{ name: 'A', average: 4.5 }, { name: 'B', average: 4.4 }, { name: 'C', average: 4.401 }, { name: 'D', average: 4.2 }]);
        // Real average decides the order inside a tie (C 4.401 before B 4.4), then the name.
        expect(ranks.map((row) => [row.name, row.rank])).toEqual([['A', 1], ['C', 2], ['B', 2], ['D', 4]]);
    });

    it('below 5 raters listed as insufficient', () => {
        const [group] = rankingByService({
            scope: ServiceScope.HC, bands, subjects: [subject('Ani', 4.8, 4), subject('Budi', 4.1, 5), subject('Caca', null, 0), subject('Dedi', 4.6, 7)],
        });
        expect(group.ranked.map((row) => [row.rank, row.name])).toEqual([[1, 'Dedi'], [2, 'Budi']]);
        expect(group.insufficient.map((row) => [row.rank, row.name, row.average])).toEqual([[null, 'Ani', 4.8], [null, 'Caca', null]]);
        expect(group.ranked[0]).toMatchObject({ raters: 7, word: 'Sangat puas', previous: null, delta: null });
    });

    it('ranking per service (HCD, HCC, HCS, then Lainnya; teams included)', () => {
        const groups = rankingByService({
            scope: ServiceScope.HC, bands, subjects: [
                subject('Sinta', 4.2, 6, { serviceCode: 'HCS', detail: 'GA', previous: 4 }),
                subject('Tim Rekrut', 4.5, 9, { kind: CsiRateeKind.TEAM, serviceCode: 'HCD', detail: 'Rekrutmen' }),
                subject('Hana', 4.3, 5, { serviceCode: 'HCC' }),
                subject('Lain', 4, 5, { serviceCode: null }),
                subject('Dimas', 4.7, 5, { serviceCode: 'HCD' }),
            ],
        });
        expect(groups.map((group) => [group.serviceCode, group.serviceName])).toEqual([
            ['HCD', 'HC Development'], ['HCC', 'HC Compensation & Benefit'], ['HCS', 'HC Services'], [null, 'Lainnya'],
        ]);
        expect(groups[0].ranked.map((row) => [row.rank, row.name, row.detail])).toEqual([[1, 'Dimas', null], [2, 'Tim Rekrut', 'Rekrutmen']]);
        expect(groups[2].ranked[0]).toMatchObject({ previous: 4, delta: 0.2 });
    });

    it('ICT keeps the team / people split as two groups', () => {
        const groups = rankingByService({
            scope: ServiceScope.ICT, bands, subjects: [
                subject('ICT SMG', 4.4, 9, { kind: CsiRateeKind.TEAM, serviceCode: null, detail: 'SMG' }),
                subject('Rudi', 4.1, 6, { serviceCode: 'OPS', detail: 'SPJ' }),
            ],
        });
        expect(groups.map((group) => [group.serviceCode, group.serviceName, group.ranked.map((row) => row.name)])).toEqual([
            [null, 'Tim', ['ICT SMG']], [null, 'Orang', ['Rudi']],
        ]);
    });

    it('highlight has no person names: best/worst service only, null below 2 services', () => {
        const highlight = serviceHighlight([
            { serviceCode: 'HCD', average: 4.41 }, { serviceCode: 'HCS', average: 4.05 }, { serviceCode: 'HCC', average: 4.2 }, { serviceCode: null, average: 3 },
        ]);
        expect(highlight).toEqual({
            best: { code: 'HCD', name: 'HC Development', average: 4.41 }, worst: { code: 'HCS', name: 'HC Services', average: 4.05 },
        });
        expect(serviceHighlight([{ serviceCode: 'HCD', average: 4.41 }, { serviceCode: 'HCS', average: null }])).toBeNull();
    });
});
