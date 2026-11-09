import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiSelfResultService } from './csi-self-result.service';

const NOW = new Date('2026-11-15T03:00:00Z');
const repo = (rows: any[]) => ({
    rows,
    find: jest.fn(async ({ where }: any = {}) => rows.filter((row) => Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && value._type === 'in') return value._value.includes(row[key]);
        if (value && typeof value === 'object' && !('_type' in value)) return Object.entries(value).every(([k, v]) => row[key]?.[k] === v);
        return row[key] === value;
    }))),
});

describe('CsiSelfResultService', () => {
    let ratees: ReturnType<typeof repo>;
    let dimensions: ReturnType<typeof repo>;
    let items: ReturnType<typeof repo>;
    let comments: ReturnType<typeof repo>;
    let service: CsiSelfResultService;
    const period = { id: 'p1', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30', publishStatus: CsiPeriodPublishStatus.PUBLISHED, individualEnabled: true };
    const rated = (responseId: string, knowledge: number, courtesy: number) => [
        { responseId, periodRateeId: 'r-rara', periodRateeDimensionId: 'd-k', score: knowledge, response: { respondentName: `Penilai ${responseId}` } },
        { responseId, periodRateeId: 'r-rara', periodRateeDimensionId: 'd-c', score: courtesy, response: { respondentName: `Penilai ${responseId}` } },
    ];

    beforeEach(() => {
        ratees = repo([
            { id: 'r-rara', periodId: 'p1', userId: 'u-rara', kind: 'PERSON', serviceFunction: 'People & Organization Development', period },
            { id: 'r-other', periodId: 'p1', userId: 'u-other', kind: 'PERSON', serviceFunction: null, period },
        ]);
        dimensions = repo([
            { id: 'd-k', periodRateeId: 'r-rara', dimensionName: 'Knowledge — Pengetahuan', shortLabel: 'Knowledge', type: 'STAR', sortOrder: 0 },
            { id: 'd-c', periodRateeId: 'r-rara', dimensionName: 'Courtesy — Kesopanan', shortLabel: 'Courtesy', type: 'STAR', sortOrder: 1 },
        ]);
        items = repo([...rated('a', 5, 4), ...rated('b', 4, 4)]);
        comments = repo([
            { responseId: 'a', periodRateeId: 'r-rara', comment: 'Sangat membantu', response: { respondentName: 'Penilai a' } },
            { responseId: 'b', periodRateeId: 'r-rara', comment: 'Cepat tanggap', response: { respondentName: 'Penilai b' } },
        ]);
        service = new CsiSelfResultService(ratees as any, dimensions as any, items as any, comments as any, () => 0);
    });

    it('with fewer than 3 raters nothing but the count is returned', async () => {
        const [result] = await service.list('u-rara', NOW);
        expect(result).toMatchObject({ periodId: 'p1', raters: 2, ready: false, average: null, dimensions: [], comments: [], minRaters: 3 });
        expect(result.serviceFunction).toBe('People & Organization Development');
    });

    it('from 3 raters on: averages per dimension and overall, comments as text only', async () => {
        items.rows.push(...rated('c', 3, 4));
        const [result] = await service.list('u-rara', NOW);
        expect(result.ready).toBe(true);
        expect(result.raters).toBe(3);
        expect(result.dimensions).toEqual([{ label: 'Knowledge', average: 4 }, { label: 'Courtesy', average: 4 }]);
        expect(result.average).toBe(4);
        expect([...result.comments].sort()).toEqual(['Cepat tanggap', 'Sangat membantu']);
        expect(JSON.stringify(result)).not.toMatch(/Penilai|responseId|"a"|"b"/);
        expect(result.status).toBe('ACTIVE');
    });

    it('only the viewer own rows of published periods', async () => {
        ratees.rows.push({ id: 'r-draft', periodId: 'p2', userId: 'u-rara', kind: 'PERSON', serviceFunction: null, period: { ...period, id: 'p2', publishStatus: CsiPeriodPublishStatus.DRAFT } });
        expect((await service.list('u-rara', NOW)).map((row) => row.periodId)).toEqual(['p1']);
        expect(await service.list('nobody', NOW)).toEqual([]);
    });
});
