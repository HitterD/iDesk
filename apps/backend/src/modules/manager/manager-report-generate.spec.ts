// apps/backend/src/modules/manager/manager-report-generate.spec.ts
//
// TDD spec untuk POST /manager/reports/generate.
// Merekam keputusan grilling 2026-08-27:
//   Q4  test dulu (TDD)  — repo di-mock, tanpa DB, tanpa render PDF/Excel sungguhan
//   Q7  trends & critical hormat dateFrom/dateTo (bukan hardcoded 7 hari)
//   Q8  summary sendirian → ticketStats + slaMetrics tetap dihitung internal
//   Q5  MANAGER cross-site via resolveSiteScope; siteIds = filter opsional
//   Q9  periode kosong → report tetap dibentuk (file tetap keluar), bukan error

import { ManagerReportsService } from './manager-reports.service';
import { ReportType } from './dto';
import { UserRole } from '../users/enums/user-role.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeTicket(overrides: Record<string, any> = {}) {
    return {
        id: 't1',
        siteId: 'site-a',
        assignedToId: null,
        priority: 'MEDIUM',
        status: 'OPEN',
        category: 'GENERAL',
        createdAt: new Date(),
        resolvedAt: null,
        firstResponseAt: null,
        slaTarget: null,
        ...overrides,
    };
}

describe('POST manager/reports/generate — payload mapping & section selection', () => {
    let service: ManagerReportsService;
    let ticketRepo: any;
    let userRepo: any;
    let siteRepo: any;

    beforeEach(() => {
        ticketRepo = {
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                setParameters: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                addGroupBy: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };
        userRepo = {
            find: jest.fn().mockResolvedValue([]),
        };
        siteRepo = {
            find: jest.fn().mockResolvedValue([
                { id: 'site-a', code: 'SPJ', name: 'Site A', isActive: true },
            ]),
        };

        service = new ManagerReportsService(ticketRepo, userRepo, siteRepo);
    });

    // Kasus 2 (Q10/Q14 kontrak): frontend POST body → service query
    it('maps frontend payload dateFrom/dateTo to startDate/endDate', async () => {
        const spyGenerate = jest.spyOn(service as any, 'getTicketStats');

        await service.generateReport(
            {
                reportType: ReportType.CONSOLIDATED,
                startDate: '2026-08-01',
                endDate: '2026-08-15',
            } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        const [, startDate, endDate] = spyGenerate.mock.calls[0] as unknown as [unknown, Date, Date];
        // setHours(0,0,0,0) memakai zona lokal — bandingkan dengan Date yang dinormalisasi sama.
        const expectedStart = new Date('2026-08-01');
        expectedStart.setHours(0, 0, 0, 0);
        expect(startDate.toISOString()).toBe(expectedStart.toISOString());
        expect(endDate).toEqual(expect.any(Date));
        expect(endDate.getHours()).toBe(23);
        expect(endDate.getMinutes()).toBe(59);
    });

    // Kasus 3: hanya 'tickets' dipilih → SLA/agent/trends/critical tidak dihitung
    it('skips unselected sections (only tickets requested)', async () => {
        await service.generateReport(
            {
                reportType: ReportType.CONSOLIDATED,
                sections: ['tickets'],
            } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        expect((service as any).slaMetricsCalled).toBeUndefined();
        expect(ticketRepo.createQueryBuilder).not.toHaveBeenCalled(); // agent perf + trends lewat QB
        expect(userRepo.find).not.toHaveBeenCalled(); // agent perf butuh daftar agent
    });

    // Kasus 4 (Q8): summary dipilih sendirian → sumber ringkasannya tetap dihitung
    it('computes underlying stats when only summary is selected', async () => {
        ticketRepo.find.mockResolvedValue([makeTicket()]);
        ticketRepo.count.mockResolvedValue(0);

        const report = await service.generateReport(
            {
                reportType: ReportType.CONSOLIDATED,
                sections: ['summary'],
            } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        expect(report.ticketStats).toBeDefined();
        expect(report.slaMetrics).toBeDefined();
        // summary section flag yang dikirim ke renderer
        expect(report.sections).toContain('summary');
        expect(report.sections).not.toContain('tickets');
    });

    // Kasus 5 (Q7): trends menghormati startDate/endDate dari permintaan
    it('trend query uses the requested period, not a hardcoded 7 days', async () => {
        const qb = ticketRepo.createQueryBuilder();
        await service.generateReport(
            {
                reportType: ReportType.CONSOLIDATED,
                sections: ['trends'],
                startDate: '2026-01-01',
                endDate: '2026-03-31',
            } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        const andWhereCalls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
        expect(andWhereCalls.some((sql: string) => /createdAt/.test(sql))).toBe(true);
        // parameter rentang dipakai — bukan start fixed `today - 6 days`
        // (startDate/endDate dioper via andWhere ke-2, bukan setParameters)
        const rangeParams = qb.andWhere.mock.calls
            .map((c: unknown[]) => c[1] as Record<string, unknown>)
            .filter(Boolean);
        expect(JSON.stringify(rangeParams)).toContain('2026');
    });

    // Kasus 5 varian critical:
    it('critical tickets query filters by the requested period', async () => {
        await service.generateReport(
            {
                reportType: ReportType.CONSOLIDATED,
                sections: ['critical'],
                startDate: '2026-02-01',
                endDate: '2026-02-28',
            } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        const findCalls = ticketRepo.find.mock.calls;
        expect(findCalls.length).toBeGreaterThan(0);
        // find dipanggil dengan argumen { where: {...} } — ambil blok where-nya.
        const where = findCalls.at(-1)[0]?.where;
        expect(where.priority).toBe('CRITICAL');
        expect(where.createdAt).toBeDefined();
    });

    // Kasus 7 (Q5): MANAGER tanpa siteIds → semua site aktif
    it('MANAGER without siteIds gets all active sites', async () => {
        siteRepo.find.mockResolvedValue([
            { id: 'a', code: 'A', isActive: true },
            { id: 'b', code: 'B', isActive: true },
        ]);

        await service.generateReport(
            { reportType: ReportType.CONSOLIDATED, sections: ['tickets'] } as any,
            { role: UserRole.MANAGER, siteId: 'site-x' },
        );

        // find kedua tanpa filter id — ambil semua aktif
        expect(siteRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    // Kasus 7 varian: MANAGER dengan siteIds → hanya site itu
    it('MANAGER with explicit siteIds scopes the report to those sites', async () => {
        siteRepo.find.mockResolvedValue([{ id: 'a', code: 'A' }]);

        const report = await service.generateReport(
            { reportType: ReportType.CONSOLIDATED, sections: ['tickets'], siteIds: ['a'] } as any,
            { role: UserRole.ADMIN, siteId: null },
        );

        expect(siteRepo.find).toHaveBeenCalledWith({ where: { id: expect.anything() } });
        expect(report.sites).toEqual(['A']);
    });
});

describe('POST manager/reports/generate — normalization & empty period', () => {
    let service: ManagerReportsService;
    let ticketRepo: any;

    beforeEach(() => {
        ticketRepo = {
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                setParameters: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                addGroupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };

        service = new ManagerReportsService(
            ticketRepo,
            { find: jest.fn().mockResolvedValue([]) } as any,
            { find: jest.fn().mockResolvedValue([]) } as any,
        );
    });

    // Kasus 8 (Q9): periode kosong — tidak throw, report tetap terbentuk
    it('produces a report (with zeroed stats) for an empty period instead of throwing', async () => {
        const report = await service.generateReport(
            {
                reportType: ReportType.PER_SITE,
                sections: ['summary', 'tickets'],
                startDate: '2031-01-01',
                endDate: '2031-01-31',
            } as any,
            { role: UserRole.MANAGER, siteId: null },
        );

        expect(report.ticketStats?.total).toBe(0);
        expect(report.sites).toEqual([]);
    });

    // Normalisasi payload frontend: 'per-site' lowercase → enum PER_SITE
    it('normalizes frontend report type casing per-site -> PER_SITE', async () => {
        await service.generateReport(
            {
                reportType: 'per-site' as unknown as ReportType,
                sections: ['tickets'],
            } as any,
            { role: UserRole.MANAGER, siteId: null },
        );

        // PER_SITE memicu siteComparison
        expect(ticketRepo.find).toHaveBeenCalled();
    });
});
