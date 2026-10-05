import { DataSource } from 'typeorm';
import { RequestNumberService } from './request-number.service';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * Runs the numbering SQL on a real Postgres. The unit spec mocks `query()`, so it
 * could not catch the bug where an untyped `$2` made Postgres pick
 * substring(text FROM regex): MAX stuck at 9 and every new request collided with
 * an existing number ("A record with this value already exists").
 *
 * Uses a TEMP table shadowing hardware_requests, so no real rows are touched.
 * Run with TEST_DATABASE_URL=postgres://user:pass@host:5432/db.
 */
maybeDescribe('RequestNumberService (integration, real Postgres)', () => {
    let ds: DataSource;

    beforeAll(async () => {
        ds = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL });
        await ds.initialize();
    });

    afterAll(async () => {
        await ds?.destroy();
    });

    async function nextNumberWith(existing: string[]): Promise<string> {
        const runner = ds.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            await runner.query(`CREATE TEMP TABLE hardware_requests ("requestNumber" varchar) ON COMMIT DROP`);
            for (const n of existing) {
                await runner.query(`INSERT INTO hardware_requests ("requestNumber") VALUES ($1)`, [n]);
            }
            const service = new RequestNumberService({ manager: runner.manager } as any);
            return await service.generate(new Date('2026-10-05T03:00:00Z'), runner.manager);
        } finally {
            await runner.rollbackTransaction();
            await runner.release();
        }
    }

    it('continues past the 9th request (the regex-substring bug stuck at 0010)', async () => {
        const existing = Array.from({ length: 18 }, (_, i) => `HR-2026-${String(i + 1).padStart(4, '0')}`);
        await expect(nextNumberWith(existing)).resolves.toBe('HR-2026-0019');
    });

    it('uses the highest number, not the count, after a gap', async () => {
        await expect(nextNumberWith(['HR-2026-0001', 'HR-2026-0042'])).resolves.toBe('HR-2026-0043');
    });

    it('starts the year at 0001 and ignores other years', async () => {
        await expect(nextNumberWith(['HR-2025-0099'])).resolves.toBe('HR-2026-0001');
    });
});
