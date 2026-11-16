import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CsiPairMode, CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
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
    findOne: jest.fn(async ({ where }: any = {}) => rows.find((row) => matches(row, where)) ?? null),
    save: jest.fn(async (entity: any) => {
        const index = rows.findIndex((row) => row.id === entity.id);
        if (index >= 0) rows[index] = { ...rows[index], ...entity };
        else rows.push(entity);
        return entity;
    }),
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

    it('hides results from the previous account once a PIC is unlinked or reassigned', async () => {
        ratees.rows[0] = { ...ratees.rows[0], userId: 'u-rara', picId: 'pic-rara' };
        pics.rows.push({ id: 'pic-rara', userId: null });
        expect(await service.list('u-rara', NOW)).toEqual([]);

        pics.rows[0].userId = 'u-new';
        expect(await service.list('u-rara', NOW)).toEqual([]);
        expect((await service.list('u-new', NOW)).map((row) => row.periodId)).toEqual(['p1']);
    });

    it('ICT agents see results of ICT surveys created with self results on, never of older ICT surveys', async () => {
        // The flag, not a date: an old ICT survey created minutes before the release must stay hidden whatever the timezones.
        const ict = (id: string, selfResults: boolean) => ({ id: `r-${id}`, periodId: id, userId: 'u-agent', kind: 'PERSON', serviceFunction: 'Oracle EBS',
            period: { ...period, id, scope: 'ICT', selfResults, createdAt: new Date('2026-11-10T03:00:00Z') } });
        ratees.rows.push(ict('p-ict-old', false), ict('p-ict-new', true));
        expect((await service.list('u-agent', NOW)).map((row) => row.periodId)).toEqual(['p-ict-new']);
    });

    describe('expectedRaters, remindRaters, and self-healing PIC linking', () => {
        it('computes expectedRaters for LISTED (CUSTOM pairs & ALL mode) and leaves OPEN as null', async () => {
            const listedPeriod = { ...period, id: 'p-listed', respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, sites: [{ siteId: 's1' }] };
            const allPeriod = { ...period, id: 'p-all', respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.ALL, sites: [{ siteId: 's1' }] };
            const openPeriod = { ...period, id: 'p-open', respondentMode: CsiRespondentMode.OPEN };
            ratees = repo([
                { id: 'r-custom', periodId: 'p-listed', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: listedPeriod },
                { id: 'r-all', periodId: 'p-all', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: allPeriod },
                { id: 'r-open', periodId: 'p-open', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: openPeriod },
            ]);
            const periodRaters = repo([
                { id: 'pr-1', periodId: 'p-listed', userId: 'u-r1', user: { isActive: true, siteId: 's1' } },
                { id: 'pr-2', periodId: 'p-listed', userId: 'u-r2', user: { isActive: true, siteId: 's1' } },
                { id: 'pr-3', periodId: 'p-listed', userId: 'u-inactive', user: { isActive: false, siteId: 's1' } },
                { id: 'pr-self', periodId: 'p-listed', userId: 'u-sri', user: { isActive: true, siteId: 's1' } },
                { id: 'pa-1', periodId: 'p-all', userId: 'u-r1', user: { isActive: true, siteId: 's1' } },
                { id: 'pa-2', periodId: 'p-all', userId: 'u-r2', user: { isActive: true, siteId: 's2' } },
                { id: 'pa-self', periodId: 'p-all', userId: 'u-sri', user: { isActive: true, siteId: 's1' } },
            ]);
            const pairs = repo([
                { periodId: 'p-listed', periodRateeId: 'r-custom', periodRaterId: 'pr-1' },
                { periodId: 'p-listed', periodRateeId: 'r-custom', periodRaterId: 'pr-2' },
                { periodId: 'p-listed', periodRateeId: 'r-custom', periodRaterId: 'pr-3' },
                { periodId: 'p-listed', periodRateeId: 'r-custom', periodRaterId: 'pr-self' },
            ]);
            const fullService = new CsiSelfResultService(
                ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any,
                periodRaters as any, pairs as any,
            );
            const list = await fullService.list('u-sri', NOW);
            const byRatee = new Map(list.map((row) => [row.periodRateeId, row.expectedRaters]));
            expect(byRatee.get('r-custom')).toBe(2);
            expect(byRatee.get('r-all')).toBe(1);
            expect(byRatee.get('r-open')).toBeNull();
        });

        it('reconciles an unlinked HC PIC matching normalised NIK or unique full name so personal scores appear', async () => {
            ratees = repo([
                { id: 'r-sri', periodId: 'p1', userId: null, picId: 'pic-sri', kind: 'PERSON', serviceFunction: 'HCD', period },
                { id: 'r-budi', periodId: 'p1', userId: null, picId: 'pic-budi', kind: 'PERSON', serviceFunction: 'HCS', period },
            ]);
            pics = repo([
                { id: 'pic-sri', scope: 'HC', nik: '00003713', fullName: 'SRI SUPATMI', userId: null, user: null },
                { id: 'pic-budi', scope: 'HC', nik: 'TPL-11AA', fullName: 'BUDI SANTOSO', userId: null, user: null },
            ]);
            const users = repo([
                { id: 'u-sri', fullName: 'Sri Supatmi', employeeId: '3713', isActive: true },
                { id: 'u-budi-1', fullName: 'Budi Santoso', employeeId: null, isActive: true },
                { id: 'u-budi-2', fullName: 'Budi Santoso', employeeId: null, isActive: true },
            ]);
            const fullService = new CsiSelfResultService(
                ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any,
                undefined, undefined, users as any,
            );
            const sriResults = await fullService.list('u-sri', NOW);
            expect(sriResults).toHaveLength(1);
            expect(sriResults[0].periodRateeId).toBe('r-sri');
            expect(pics.rows[0].userId).toBe('u-sri');

            // Duplicate active name must NOT guess and link an unlinked PIC.
            expect(await fullService.list('u-budi-1', NOW)).toEqual([]);
            expect(pics.rows[1].userId).toBeNull();
        });

        it('finds personal results when another duplicate csi_pics row or orphan ratee matches unique active user', async () => {
            ratees = repo([
                { id: 'r-dup-tpl', periodId: 'p1', userId: null, picId: 'pic-tpl', kind: 'PERSON', displayName: 'SRI SUPATMI', serviceFunction: 'ATK', period },
                { id: 'r-orphan', periodId: 'p2', userId: null, picId: null, kind: 'PERSON', displayName: 'Sri  Supatmi', serviceFunction: 'ATK', period: { ...period, id: 'p2', startDate: '2026-10-01' } },
                { id: 'r-other-active', periodId: 'p3', userId: 'u-other', picId: null, kind: 'PERSON', displayName: 'Sri Supatmi', serviceFunction: 'ATK', period: { ...period, id: 'p3', startDate: '2026-09-01' } },
            ]);
            // Admin already linked pic-linked to u-sri, while active survey points to pic-tpl (userId: null).
            pics = repo([
                { id: 'pic-linked', scope: 'HC', nik: '00003713', fullName: 'Sri Supatmi', userId: 'u-sri', user: null },
                { id: 'pic-tpl', scope: 'HC', nik: 'TPL-8899', fullName: 'SRI SUPATMI', aliases: [], userId: null, user: null },
            ]);
            const users = repo([
                { id: 'u-sri', fullName: 'SRI SUPATMI', employeeId: '00003713', isActive: true },
                { id: 'u-other', fullName: 'Someone Else', employeeId: null, isActive: true },
            ]);
            const fullService = new CsiSelfResultService(
                ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any,
                undefined, undefined, users as any,
            );
            const results = await fullService.list('u-sri', NOW);
            expect(results.map((r) => r.periodRateeId)).toEqual(['r-dup-tpl', 'r-orphan']);
        });

        it('remindRaters delegates only assigned pending targets via CsiReminderService without leaking counts', async () => {
            const listedPeriod = { ...period, id: 'p-listed', respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, sites: [{ siteId: 's1' }] };
            ratees = repo([
                { id: 'r-sri', periodId: 'p-listed', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: listedPeriod },
                { id: 'r-other', periodId: 'p-listed', userId: 'u-other', kind: 'PERSON', serviceFunction: null, period: listedPeriod },
            ]);
            const periodRaters = repo([
                { id: 'pr-1', periodId: 'p-listed', userId: 'u-r1', user: { isActive: true, siteId: 's1' } },
                { id: 'pr-2', periodId: 'p-listed', userId: 'u-r2', user: { isActive: true, siteId: 's1' } },
            ]);
            const pairs = repo([
                { periodId: 'p-listed', periodRateeId: 'r-sri', periodRaterId: 'pr-1' },
                { periodId: 'p-listed', periodRateeId: 'r-other', periodRaterId: 'pr-2' },
            ]);
            const reminders = { send: jest.fn(async () => ({ sent: 1, skipped: 0 })) };
            const fullService = new CsiSelfResultService(
                ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any,
                periodRaters as any, pairs as any, undefined, reminders as any,
            );

            await expect(fullService.remindRaters('u-sri', 'r-other', NOW)).rejects.toBeInstanceOf(NotFoundException);
            expect(await fullService.remindRaters('u-sri', 'r-sri', NOW)).toEqual({ reminded: true });
            expect(reminders.send).toHaveBeenCalledWith('HC', 'p-listed', ['u-r1'], NOW);

            listedPeriod.respondentMode = CsiRespondentMode.OPEN;
            await expect(fullService.remindRaters('u-sri', 'r-sri', NOW)).rejects.toBeInstanceOf(BadRequestException);
        });

        it('lists pending LISTED raters for ACTIVE and ENDED surveys (with directory dept & siteCode), hides UPCOMING and answered', async () => {
            const activePeriod = {
                ...period, id: 'p-active', startDate: '2026-11-01', endDate: '2026-11-30',
                respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM,
                sites: [{ siteId: 's1', site: { code: 'SPJ' } }],
            };
            const endedPeriod = { ...activePeriod, id: 'p-ended', startDate: '2026-10-01', endDate: '2026-10-31' };
            const upcomingPeriod = { ...activePeriod, id: 'p-up', startDate: '2026-12-01', endDate: '2026-12-31' };
            ratees = repo([
                { id: 'r-act', periodId: 'p-active', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: activePeriod },
                { id: 'r-end', periodId: 'p-ended', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: endedPeriod },
                { id: 'r-up', periodId: 'p-up', userId: 'u-sri', kind: 'PERSON', serviceFunction: null, period: upcomingPeriod },
            ]);
            const periodRaters = repo([
                { id: 'pa-1', periodId: 'p-active', userId: 'u-zara', user: { isActive: true, siteId: 's1', fullName: 'Zara', employeeId: '123', department: { name: 'Fallback' }, site: { code: 'SPJ' } } },
                { id: 'pa-2', periodId: 'p-active', userId: 'u-andi', user: { isActive: true, siteId: 's1', fullName: 'Andi', employeeId: null, department: { name: 'Purchasing' }, site: null } },
                { id: 'pa-3', periodId: 'p-active', userId: 'u-done', user: { isActive: true, siteId: 's1', fullName: 'Done User', employeeId: null, department: null, site: { code: 'SPJ' } } },
                { id: 'pe-1', periodId: 'p-ended', userId: 'u-andi', user: { isActive: true, siteId: 's1', fullName: 'Andi', employeeId: null, department: { name: 'Purchasing' }, site: { code: 'SPJ' } } },
                { id: 'pu-1', periodId: 'p-up', userId: 'u-andi', user: { isActive: true, siteId: 's1', fullName: 'Andi', employeeId: null, department: { name: 'Purchasing' }, site: { code: 'SPJ' } } },
            ]);
            const pairs = repo([
                { periodId: 'p-active', periodRateeId: 'r-act', periodRaterId: 'pa-1' },
                { periodId: 'p-active', periodRateeId: 'r-act', periodRaterId: 'pa-2' },
                { periodId: 'p-active', periodRateeId: 'r-act', periodRaterId: 'pa-3' },
                { periodId: 'p-ended', periodRateeId: 'r-end', periodRaterId: 'pe-1' },
                { periodId: 'p-up', periodRateeId: 'r-up', periodRaterId: 'pu-1' },
            ]);
            const responsesRepo = repo([{ periodId: 'p-active', respondentId: 'u-done' }]);
            const orgPeopleRepo = repo([{ nik: '00000123', department: 'FINANCE HC' }]);
            const fullService = new CsiSelfResultService(
                ratees as any, dimensions as any, items as any, comments as any, pics as any, () => 0, repo([]) as any,
                periodRaters as any, pairs as any, undefined, undefined, responsesRepo as any, orgPeopleRepo as any,
            );

            const results = await fullService.list('u-sri', NOW);
            const byRatee = new Map(results.map((row) => [row.periodRateeId, row]));
            expect(byRatee.get('r-act')?.pendingRaters).toEqual([
                { userId: 'u-andi', fullName: 'Andi', department: 'Purchasing', siteCode: 'SPJ' },
                { userId: 'u-zara', fullName: 'Zara', department: 'FINANCE HC', siteCode: 'SPJ' },
            ]);
            expect(byRatee.get('r-end')?.pendingRaters).toEqual([
                { userId: 'u-andi', fullName: 'Andi', department: 'Purchasing', siteCode: 'SPJ' },
            ]);
            expect(byRatee.get('r-up')?.pendingRaters).toEqual([]);
            expect(JSON.stringify(results)).not.toMatch(/u-done/);
        });
    });
});
