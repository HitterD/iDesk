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
        service = new CsiSelfResultService(ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any);
    });

    describe('custom team results', () => {
        let members: ReturnType<typeof repo>;
        beforeEach(() => {
            members = repo([
                { teamId: 'team-custom', userId: 'u-member', team: { kind: 'CUSTOM' } },
                { teamId: 'team-custom', userId: 'u-member-2', team: { kind: 'CUSTOM' } },
            ]);
            ratees.rows.push({ id: 'r-team', periodId: 'p1', kind: 'TEAM', teamId: 'team-custom',
                displayName: 'Snapshot tim', team: { kind: 'CUSTOM', name: 'Payroll' }, period: { ...period, teamEnabled: true } });
            dimensions.rows.push({ id: 'd-team', periodRateeId: 'r-team', dimensionName: 'Courtesy', type: 'STAR', sortOrder: 0 });
            items.rows.push(...['a', 'b', 'c'].map((responseId) => ({ responseId, periodRateeId: 'r-team', periodRateeDimensionId: 'd-team', score: 4 })));
            comments.rows.push({ responseId: 'a', periodRateeId: 'r-team', comment: 'Tim membantu', respondentName: 'Rahasia' });
            service = new CsiSelfResultService(ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, members as any);
        });

        it('team result listed for every member with an iDesk account, including when only 1 member has an account', async () => {
            expect(await service.list('u-member', NOW)).toEqual([expect.objectContaining({ teamName: 'Payroll', ready: true, raters: 3, minRaters: 1, average: 4, comments: ['Tim membantu'] })]);
            expect(await service.list('u-member-2', NOW)).toEqual([expect.objectContaining({ teamName: 'Payroll', ready: true, raters: 3, minRaters: 1, average: 4 })]);
            expect(JSON.stringify(await service.list('u-member', NOW))).not.toMatch(/Rahasia|responseId/);
            // Only 1 member has an iDesk account (the other has userId = null): still listed for that 1 member.
            members.rows[1].userId = null;
            expect(await service.list('u-member', NOW)).toEqual([expect.objectContaining({ teamName: 'Payroll', ready: true, raters: 3 })]);
            expect(await service.list('u-member-2', NOW)).toEqual([]);
        });

        it('team result is shown immediately from 1 rater (no 3-rater gate), and ready is false only at 0 raters', async () => {
            items.rows.splice(0, items.rows.length, ...items.rows.filter((row) => row.periodRateeId !== 'r-team' || row.responseId === 'a'));
            expect(await service.list('u-member', NOW)).toEqual([expect.objectContaining({ teamName: 'Payroll', raters: 1, minRaters: 1, ready: true, average: 4 })]);
            items.rows.splice(0, items.rows.length, ...items.rows.filter((row) => row.periodRateeId !== 'r-team'));
            expect(await service.list('u-member', NOW)).toEqual([expect.objectContaining({ teamName: 'Payroll', raters: 0, minRaters: 1, ready: false, average: null, dimensions: [], comments: [] })]);
        });

        it('non-member not listed', async () => {
            expect(await service.list('u-outsider', NOW)).toEqual([]);
        });

        it('site team not listed', async () => {
            members.rows[0].team.kind = 'SITE';
            ratees.rows.find((row) => row.id === 'r-team').team.kind = 'SITE';
            expect(await service.list('u-member', NOW)).toEqual([]);
        });

        it('keeps personal results before team results in the same period', async () => {
            members.rows[0].userId = 'u-rara';
            ratees.rows.reverse();
            expect((await service.list('u-rara', NOW)).map((row) => (row as any).teamName)).toEqual([null, 'Payroll']);
        });

        it('team results respect teamEnabled (stay visible when individualEnabled is false) and scope/publish rules', async () => {
            const team = ratees.rows.find((row) => row.id === 'r-team');
            team.team.name = null;
            team.period = { ...period, teamEnabled: true, individualEnabled: false };
            expect(await service.list('u-member', NOW)).toEqual([expect.objectContaining({ teamName: 'Snapshot tim' })]);
            for (const override of [{ cancelledAt: NOW }, { teamEnabled: false }, { publishStatus: CsiPeriodPublishStatus.DRAFT }, { scope: 'ICT', selfResults: false }]) {
                team.period = { ...period, teamEnabled: true, ...override };
                expect(await service.list('u-member', NOW)).toEqual([]);
            }
        });
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

    it('every result carries the survey score bands (custom bands 3.5/4.2, legacy rows fall back to 4.0/4.5)', async () => {
        expect((await service.list('u-rara', NOW))[0].scoreBands).toEqual({ fairMin: 4, goodMin: 4.5 });
        ratees.rows[0] = { ...ratees.rows[0], period: { ...period, scoreFairMin: 3.5, scoreGoodMin: 4.2 } };
        expect((await service.list('u-rara', NOW))[0].scoreBands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
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
