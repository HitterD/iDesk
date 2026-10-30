// apps/backend/src/modules/hardware-request/services/request-number.service.spec.ts
import { RequestNumberService } from './request-number.service';

describe('RequestNumberService', () => {
    const managerWith = (maxSeq: string | null) => ({
        query: jest.fn(async (sql: string, _params?: unknown[]) => (sql.includes('pg_advisory_xact_lock') ? [] : [{ maxSeq }])),
    });
    const now = new Date('2026-04-17T10:00:00Z');

    it('generates HR-YYYY-0001 when no requests exist this year', async () => {
        const mgr = managerWith(null);
        const service = new RequestNumberService({ manager: mgr } as any);
        expect(await service.generate(now)).toBe('HR-2026-0001');
    });

    it('continues from the highest number this year (not the row count)', async () => {
        const mgr = managerWith('42');
        const service = new RequestNumberService({} as any);
        expect(await service.generate(now, mgr as any)).toBe('HR-2026-0043');
    });

    it('pads to 4 digits minimum', async () => {
        const service = new RequestNumberService({ manager: managerWith('9999') } as any);
        expect(await service.generate(new Date('2026-01-01Z'))).toBe('HR-2026-10000');
    });

    // An untyped $2 made Postgres pick substring(text FROM regex): '9' or NULL instead of the
    // sequence, so MAX stuck at 9 and every new request reused HR-YYYY-0010.
    it('casts the substring start to int so Postgres reads it as a position, not a regex', async () => {
        const mgr = managerWith('5');
        const service = new RequestNumberService({} as any);

        await service.generate(now, mgr as any);

        const sql: string = mgr.query.mock.calls[1][0];
        const untypedFrom = sql.match(/FROM \$2(?!::int)/g);
        expect(untypedFrom).toBeNull();
        expect(sql).toContain('FROM $2::int');
    });

    // Two drafts at once used to read the same count and collide on the unique number.
    it('takes a per-year advisory lock inside the caller transaction before reading', async () => {
        const mgr = managerWith('5');
        const service = new RequestNumberService({} as any);

        await service.generate(now, mgr as any);

        expect(mgr.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
        expect(mgr.query.mock.calls[0][1]).toEqual(['hardware-request-number:2026']);
        expect(mgr.query.mock.calls[1][0]).toContain('MAX(');
    });
});
