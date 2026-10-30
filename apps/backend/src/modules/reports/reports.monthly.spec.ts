import { ReportsService } from './reports.service';

jest.mock('./generators/pdf-generator.service', () => ({ PDFGeneratorService: class {} }));

describe('monthly report contract', () => {
    const setup = (row: Record<string, unknown>) => {
        const qb: any = { select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue(row) };
        const cache: any = { getOrSet: jest.fn((_key, loader) => loader()) };
        const service = new ReportsService({} as any, { createQueryBuilder: () => qb } as any,
            {} as any, {} as any, {} as any, {} as any, cache);
        return { service, qb, cache };
    };
    it('returns historical, eligible, cancelled and nullable duration with a versioned cache', async () => {
        const { service, cache, qb } = setup({ totalTickets: '10', cancelledTickets: '2', resolvedTickets: '8', openTickets: '0', avgResolutionTimeHours: null });
        expect(await service.getMonthlyStats(1, 2026)).toMatchObject({ totalTickets: 10, cancelledTickets: 2, eligibleTickets: 8, resolvedTickets: 8, openTickets: 0, resolutionRate: 100, avgResolutionTimeHours: null });
        expect(cache.getOrSet.mock.calls[0][0]).toContain('monthly:v2:');
        expect(qb.addSelect.mock.calls.map((c: any[]) => c[0]).join(' ')).not.toContain('updatedAt');
        expect(qb.addSelect.mock.calls.map((c: any[]) => c[0]).join(' ')).toContain("'WAITING_VENDOR'");
    });
    it('returns null rate for empty eligible cohort and preserves numeric measured hours', async () => {
        const { service } = setup({ totalTickets: '2', cancelledTickets: '2', resolvedTickets: '0', avgResolutionTimeHours: '0.125' });
        expect(await service.getMonthlyStats(1, 2026)).toMatchObject({ eligibleTickets: 0, resolutionRate: null, avgResolutionTimeHours: 0.125 });
    });
});
