import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiSelfResultService } from './csi-self-result.service';

const NOW = new Date('2026-11-15T03:00:00Z');
const matches = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (value && typeof value === 'object' && value._type === 'in') return value._value.includes(row[key]);
    if (value && typeof value === 'object' && value._type === 'moreThanOrEqual') return row[key] !== undefined && new Date(row[key]) >= value._value;
    if (value && typeof value === 'object' && !(value instanceof Date) && !('_type' in value)) return matches(row[key] ?? {}, value);
    return row[key] === value;
});
/** In-memory repository; an array `where` is an OR of its entries, as in TypeORM. */
const repo = (rows: any[]) => ({
    rows,
    find: jest.fn(async ({ where }: any = {}) => rows.filter((row) => (Array.isArray(where) ? where.some((part) => matches(row, part)) : matches(row, where)))),
});

describe('CsiSelfResultService', () => {
    let ratees: ReturnType<typeof repo>;
    let dimensions: ReturnType<typeof repo>;
    let items: ReturnType<typeof repo>;
    let comments: ReturnType<typeof repo>;
    let pics: ReturnType<typeof repo>;
    let service: CsiSelfResultService;
    const period = { id: 'p1', scope: 'HC', title: 'CSI HC 2026 – Semarang', startDate: '2026-11-01', endDate: '2026-11-30', publishStatus: CsiPeriodPublishStatus.PUBLISHED, individualEnabled: true };
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
        pics = repo([]);
        service = new CsiSelfResultService(ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0);
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

    it('ICT periods are never listed (only HC people see their results)', async () => {
        ratees.rows.push({ id: 'r-ict', periodId: 'p-ict', userId: 'u-rara', kind: 'PERSON', serviceFunction: null, period: { ...period, id: 'p-ict', scope: 'ICT' } });
        expect((await service.list('u-rara', NOW)).map((row) => row.periodId)).toEqual(['p1']);
    });

    it('a PIC whose account was linked after the survey was built still sees their results', async () => {
        ratees.rows[0] = { ...ratees.rows[0], userId: null, picId: 'pic-rara' };
        pics.rows.push({ id: 'pic-rara', userId: 'u-rara' });
        expect((await service.list('u-rara', NOW)).map((row) => row.periodId)).toEqual(['p1']);
        expect(await service.list('u-nobody', NOW)).toEqual([]);
    });

    it('ICT agents see results of ICT surveys created with self results on, never of older ICT surveys', async () => {
        // The flag, not a date: an old ICT survey created minutes before the release must stay hidden whatever the timezones.
        const ict = (id: string, selfResults: boolean) => ({ id: `r-${id}`, periodId: id, userId: 'u-agent', kind: 'PERSON', serviceFunction: 'Oracle EBS',
            period: { ...period, id, scope: 'ICT', selfResults, createdAt: new Date('2026-11-10T03:00:00Z') } });
        ratees.rows.push(ict('p-ict-old', false), ict('p-ict-new', true));
        expect((await service.list('u-agent', NOW)).map((row) => row.periodId)).toEqual(['p-ict-new']);
    });
});
