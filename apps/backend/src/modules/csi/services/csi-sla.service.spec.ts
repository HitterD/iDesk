import { In } from 'typeorm';
import { CsiRespondentMode } from '../csi.constants';
import { CsiSlaService } from './csi-sla.service';

const sites = [{ id: 'site-a' }, { id: 'site-b' }];

function ticketRepository(rows: any[]) {
    const builder: any = { calls: {} as Record<string, any[]> };
    for (const method of ['select', 'addSelect', 'innerJoin', 'leftJoin', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'groupBy', 'addGroupBy']) {
        builder[method] = jest.fn((...args: any[]) => { (builder.calls[method] ??= []).push(args); return builder; });
    }
    builder.getRawMany = jest.fn(async () => rows);
    return { builder, createQueryBuilder: jest.fn(() => builder) };
}

const noPairs = { ratersWithPairs: jest.fn(async () => null) };

describe('CsiSlaService', () => {
    const open = (over: Record<string, any> = {}) => ({ id: 'p1', respondentMode: CsiRespondentMode.OPEN, startDate: '2026-10-01', slaTargetPct: 80, ...over }) as any;

    it('SLA OPEN counts distinct ticket reporters in window and sites', async () => {
        const rows = [
            { id: 'u1', email: 'a@x.id', department: 'Finance', fullName: 'Ani' },
            { id: 'u1', email: 'a@x.id', department: 'Finance', fullName: 'Ani' },
            { id: 'u2', email: 'b@x.id', department: null, fullName: 'Budi' },
        ];
        const tickets = ticketRepository(rows);
        const service = new CsiSlaService(tickets as any, { find: jest.fn() } as any, noPairs as any);
        const result = await service.compute(open(), sites, 2);
        expect(result).toMatchObject({ mode: CsiRespondentMode.OPEN, basis: 2, targetPct: 80, target: 2, responses: 2, pengisiPct: 100 });
        expect(result.reporters).toEqual([
            { email: 'a@x.id', department: 'Finance', fullName: 'Ani' },
            { email: 'b@x.id', department: null, fullName: 'Budi' },
        ]);
        const params = Object.assign({}, ...tickets.builder.calls.where.concat(tickets.builder.calls.andWhere).map((call: any[]) => call[1] ?? {}));
        expect(params.siteIds).toEqual(['site-a', 'site-b']);
        // [startDate - 12 months, startDate) in WIB
        expect(params.from).toEqual(new Date('2025-09-30T17:00:00Z'));
        expect(params.to).toEqual(new Date('2026-09-30T17:00:00Z'));
    });

    it('SLA target ceil and pengisi capped at 100', async () => {
        const rows = Array.from({ length: 81 }, (_, i) => ({ id: `u${i}`, email: `${i}@x.id`, department: 'D', fullName: `N${i}` }));
        const service = new CsiSlaService(ticketRepository(rows) as any, { find: jest.fn() } as any, noPairs as any);
        const result = await service.compute(open(), sites, 216);
        expect(result).toMatchObject({ basis: 81, target: 65, responses: 216, pengisiPct: 100 });
    });

    it('SLA with no reporters has null pengisi', async () => {
        const service = new CsiSlaService(ticketRepository([]) as any, { find: jest.fn() } as any, noPairs as any);
        expect(await service.compute(open(), sites, 3)).toMatchObject({ basis: 0, target: 0, pengisiPct: null });
    });

    it('SLA LISTED uses active site raters', async () => {
        const raters = [
            { userId: 'u1', user: { email: 'b@x.id', fullName: 'Budi', department: { name: 'IT' } } },
            { userId: 'u2', user: { email: 'a@x.id', fullName: 'Ani', department: { name: 'HR' } } },
        ];
        const find = jest.fn(async () => raters);
        const tickets = ticketRepository([]);
        const service = new CsiSlaService(tickets as any, { find } as any, noPairs as any);
        const result = await service.compute(open({ respondentMode: CsiRespondentMode.LISTED, slaTargetPct: 50 }), sites, 1);
        expect(tickets.createQueryBuilder).not.toHaveBeenCalled();
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            where: { periodId: 'p1', user: { isActive: true, siteId: In(['site-a', 'site-b']) } },
        }));
        expect(result).toMatchObject({ mode: CsiRespondentMode.LISTED, basis: 2, target: 1, pengisiPct: 100 });
        expect(result.reporters.map((row) => row.fullName)).toEqual(['Ani', 'Budi']);
    });

    describe('LISTED basis in a mapped period', () => {
        const raters = [
            { id: 'pr1', userId: 'u1', user: { email: 'b@x.id', fullName: 'Budi', department: null } },
            { id: 'pr2', userId: 'u2', user: { email: 'a@x.id', fullName: 'Ani', department: null } },
        ];
        const listed = open({ respondentMode: CsiRespondentMode.LISTED });

        it('raters without pairs are excluded when the period is mapped', async () => {
            const assignments = { ratersWithPairs: jest.fn(async () => new Set(['pr1'])) };
            const service = new CsiSlaService(ticketRepository([]) as any, { find: jest.fn(async () => raters) } as any, assignments as any);
            const result = await service.compute(listed, sites, 0);
            expect(assignments.ratersWithPairs).toHaveBeenCalledWith('p1');
            expect(result.basis).toBe(1);
            expect(result.reporters.map((row) => row.fullName)).toEqual(['Budi']);
        });

        it('no filtering when the period has no pairs', async () => {
            const service = new CsiSlaService(ticketRepository([]) as any, { find: jest.fn(async () => raters) } as any, noPairs as any);
            expect((await service.compute(listed, sites, 0)).basis).toBe(2);
        });
    });
});
