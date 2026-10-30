import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiDashboardService, quarterLabel } from './csi-dashboard.service';
import { CsiSiteStats } from './csi-report.service';

const ICT = ServiceScope.ICT;
const NOW = new Date('2026-10-30T03:00:00Z');
const SPJ = { id: 'site-spj', code: 'SPJ', name: 'Sepanjang' };
const KRW = { id: 'site-krw', code: 'KRW', name: 'Karawang' };

const period = (id: string, startDate: string, endDate: string, sites: Array<typeof SPJ>, over: Record<string, unknown> = {}) => ({
    id, scope: ICT, title: `CSI ${id}`, startDate, endDate, respondentMode: CsiRespondentMode.OPEN, slaTargetPct: 90,
    publishStatus: CsiPeriodPublishStatus.PUBLISHED, sites: sites.map((site) => ({ siteId: site.id, site })), ...over,
});
const stats = (average: number | null, responses = 0, people: CsiSiteStats['people'] = []): CsiSiteStats => ({ average, responses, people });
const person = (userId: string, average: number | null) => ({ userId, displayName: userId.toUpperCase(), photoUrl: `/${userId}.jpg`, average });

describe('CsiDashboardService', () => {
    let rows: any[];
    let siteStats: Map<string, Record<string, CsiSiteStats>>;
    let raters: any[];
    let responses: any[];
    let comments: any[];
    let sla: { compute: jest.Mock };
    let paired: Map<string, Set<string>>;
    let service: CsiDashboardService;

    beforeEach(() => {
        rows = [];
        siteStats = new Map();
        raters = [];
        responses = [];
        comments = [];
        // Mirrors the service query: scope + PUBLISHED + started on or before today.
        const periods = {
            find: jest.fn(async (options: any) => rows.filter((row) => row.scope === options.where.scope
                && row.publishStatus === options.where.publishStatus && row.startDate <= options.where.startDate._value)),
        };
        const reports = {
            siteStats: jest.fn(async (_scope: unknown, p: any, siteIds: string[]) =>
                new Map(siteIds.map((siteId) => [siteId, siteStats.get(p.id)?.[siteId] ?? stats(null)]))),
        };
        sla = {
            compute: jest.fn(async (_p: unknown, sites: Array<{ id: string }>, count: number) => {
                const spj = sites[0].id === SPJ.id;
                return { basis: spj ? 20 : 10, target: spj ? 18 : 9, targetPct: 90, responses: count };
            }),
        };
        const periodRaters = { find: jest.fn(async () => raters) };
        const responseRepo = { find: jest.fn(async () => responses) };
        const commentRepo = { find: jest.fn(async () => comments) };
        paired = new Map();
        const assignments = { ratersWithPairs: jest.fn(async (periodId: string) => paired.get(periodId) ?? null) };
        service = new CsiDashboardService(periods as any, periodRaters as any, responseRepo as any, commentRepo as any, reports as any, sla as any, assignments as any);
    });

    it('labels a period by the quarter of its end date', () => {
        expect(quarterLabel('2026-10-31')).toBe('Q4 26');
        expect(quarterLabel('2027-03-31')).toBe('Q1 27');
    });

    it('splits a multi-site period into one row per site', async () => {
        rows.push(period('p-now', '2026-10-01', '2026-10-31', [SPJ, KRW]));
        siteStats.set('p-now', { [SPJ.id]: stats(4.6, 12), [KRW.id]: stats(3.9, 4) });
        const dashboard = await service.getDashboard(ICT, NOW);
        expect(dashboard.active).toEqual([
            { periodId: 'p-now', title: 'CSI p-now', siteId: KRW.id, siteCode: 'KRW', siteName: 'Karawang', responses: 4, basis: 10, target: 9, targetPct: 90, average: 3.9, endDate: '2026-10-31' },
            { periodId: 'p-now', title: 'CSI p-now', siteId: SPJ.id, siteCode: 'SPJ', siteName: 'Sepanjang', responses: 12, basis: 20, target: 18, targetPct: 90, average: 4.6, endDate: '2026-10-31' },
        ]);
        expect(sla.compute).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-now' }), [{ id: SPJ.id }], 12);
    });

    it('ignores drafts, periods not started yet and other scopes', async () => {
        rows.push(period('p-draft', '2026-10-01', '2026-10-31', [SPJ], { publishStatus: CsiPeriodPublishStatus.DRAFT }));
        rows.push(period('p-later', '2026-11-01', '2026-11-30', [SPJ]));
        rows.push(period('p-hc', '2026-10-01', '2026-10-31', [SPJ], { scope: ServiceScope.HC }));
        expect(await service.getDashboard(ICT, NOW)).toEqual({ active: [], trend: [], peopleDelta: [], pending: [], comments: [] });
    });

    it('trend keeps the last 5 periods per site in date order', async () => {
        const quarters = [['2025-04-01', '2025-06-30'], ['2025-07-01', '2025-09-30'], ['2025-10-01', '2025-12-31'],
            ['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-06-30'], ['2026-07-01', '2026-09-30']];
        quarters.forEach(([start, end], index) => rows.push(period(`q${index}`, start, end, [SPJ])));
        rows.push(period('p-now', '2026-10-01', '2026-10-31', [SPJ, KRW]));
        rows.reverse();
        quarters.forEach((_, index) => siteStats.set(`q${index}`, { [SPJ.id]: stats(3 + index / 10) }));
        siteStats.set('p-now', { [SPJ.id]: stats(4.5), [KRW.id]: stats(4.1) });
        const { trend } = await service.getDashboard(ICT, NOW);
        expect(trend).toEqual([
            { siteId: KRW.id, siteCode: 'KRW', points: [{ periodId: 'p-now', label: 'Q4 26', average: 4.1 }] },
            {
                siteId: SPJ.id, siteCode: 'SPJ', points: [
                    { periodId: 'q2', label: 'Q4 25', average: 3.2 }, { periodId: 'q3', label: 'Q1 26', average: 3.3 },
                    { periodId: 'q4', label: 'Q2 26', average: 3.4 }, { periodId: 'q5', label: 'Q3 26', average: 3.5 },
                    { periodId: 'p-now', label: 'Q4 26', average: 4.5 },
                ],
            },
        ]);
    });

    it('people delta compares with the previous period of the same site', async () => {
        rows.push(period('p-spj-old', '2026-04-01', '2026-06-30', [SPJ]));
        rows.push(period('p-spj-prev', '2026-07-01', '2026-09-30', [SPJ]));
        rows.push(period('p-krw-prev', '2026-07-01', '2026-09-30', [KRW]));
        rows.push(period('p-now', '2026-10-01', '2026-10-31', [SPJ, KRW]));
        siteStats.set('p-spj-old', { [SPJ.id]: stats(3, 1, [person('budi', 1)]) });
        siteStats.set('p-spj-prev', { [SPJ.id]: stats(3, 1, [person('budi', 4), person('sari', 4.5), person('eko', null)]) });
        siteStats.set('p-krw-prev', { [KRW.id]: stats(3, 1, [person('budi', 2), person('dewi', 3)]) });
        siteStats.set('p-now', {
            [SPJ.id]: stats(4, 1, [person('budi', 4.5), person('sari', 4.25), person('eko', 4), person('new', 5)]),
            [KRW.id]: stats(4, 1, [person('dewi', 4)]),
        });
        const { peopleDelta } = await service.getDashboard(ICT, NOW);
        expect(peopleDelta).toEqual([
            { name: 'DEWI', photoUrl: '/dewi.jpg', siteId: KRW.id, delta: 1 },
            { name: 'BUDI', photoUrl: '/budi.jpg', siteId: SPJ.id, delta: 0.5 },
            { name: 'SARI', photoUrl: '/sari.jpg', siteId: SPJ.id, delta: -0.25 },
        ]);
    });

    it('pending lists LISTED raters without a response, earliest-ending period first, at most 10', async () => {
        rows.push(period('p-late', '2026-10-01', '2026-11-30', [SPJ], { respondentMode: CsiRespondentMode.LISTED }));
        rows.push(period('p-soon', '2026-10-01', '2026-10-31', [SPJ], { respondentMode: CsiRespondentMode.LISTED }));
        rows.push(period('p-open', '2026-10-01', '2026-10-30', [SPJ]));
        const user = (id: string) => ({ id, fullName: `User ${id}`, siteId: SPJ.id, department: { name: 'Keuangan' } });
        raters = [
            ...Array.from({ length: 8 }, (_, i) => ({ periodId: 'p-late', userId: `l${i}`, user: user(`l${i}`) })),
            ...Array.from({ length: 4 }, (_, i) => ({ periodId: 'p-soon', userId: `s${i}`, user: user(`s${i}`) })),
        ];
        responses = [{ periodId: 'p-soon', respondentId: 's0' }];
        const { pending } = await service.getDashboard(ICT, NOW);
        expect(pending).toHaveLength(10);
        expect(pending.slice(0, 4).map((row) => row.periodId)).toEqual(['p-soon', 'p-soon', 'p-soon', 'p-late']);
        expect(pending[0]).toEqual({ userId: 's1', fullName: 'User s1', department: 'Keuangan', siteId: SPJ.id, periodId: 'p-soon' });
    });

    describe('pending in mapped LISTED periods', () => {
        const user = (id: string) => ({ id, fullName: `User ${id}`, siteId: SPJ.id, department: null });
        beforeEach(() => {
            rows.push(period('p-mapped', '2026-10-01', '2026-10-31', [SPJ], { respondentMode: CsiRespondentMode.LISTED }));
            rows.push(period('p-free', '2026-10-01', '2026-11-30', [SPJ], { respondentMode: CsiRespondentMode.LISTED }));
            raters = [
                { id: 'pr-a', periodId: 'p-mapped', userId: 'a', user: user('a') },
                { id: 'pr-b', periodId: 'p-mapped', userId: 'b', user: user('b') },
                { id: 'pr-c', periodId: 'p-free', userId: 'c', user: user('c') },
            ];
        });

        it('raters without pairs are excluded when the period is mapped', async () => {
            paired.set('p-mapped', new Set(['pr-a']));
            const { pending } = await service.getDashboard(ICT, NOW);
            expect(pending.map((row) => row.userId)).toEqual(['a', 'c']);
        });

        it('no filtering when the period has no pairs', async () => {
            const { pending } = await service.getDashboard(ICT, NOW);
            expect(pending.map((row) => row.userId)).toEqual(['a', 'b', 'c']);
        });
    });

    it('comments are the 5 newest non-empty ones of active periods', async () => {
        rows.push(period('p-now', '2026-10-01', '2026-10-31', [SPJ]));
        comments = Array.from({ length: 7 }, (_, i) => ({
            comment: i === 1 ? '   ' : `Komentar ${i}`, createdAt: new Date(NOW.getTime() - i * 1000),
            periodRatee: { displayName: 'Budi', siteId: SPJ.id },
        }));
        const result = await service.getDashboard(ICT, NOW);
        expect(result.comments.map((row) => row.text)).toEqual(['Komentar 0', 'Komentar 2', 'Komentar 3', 'Komentar 4', 'Komentar 5']);
        expect(result.comments[0]).toEqual({ text: 'Komentar 0', subjectName: 'Budi', siteId: SPJ.id, createdAt: NOW });
    });
});
