import { DataSource } from 'typeorm';
import { generateNextTicketNumber } from './ticket-number-generator';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * Runs the numbering SQL on a real Postgres. Regression for "Ticket Number 231026-FIN-0011 already exists": once
 * today's newest ticket was soft-deleted, the entity query no longer saw it while the unique constraint still did,
 * so every later creation that day reused its number.
 *
 * Uses a TEMP table shadowing tickets, so no real rows are touched.
 * Run with TEST_DATABASE_URL=postgres://user:pass@host:5432/db.
 */
maybeDescribe('generateNextTicketNumber (integration, real Postgres)', () => {
    let ds: DataSource;
    const day = new Date(2026, 9, 23, 10, 0);

    beforeAll(async () => {
        ds = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL });
        await ds.initialize();
    });

    afterAll(async () => {
        await ds?.destroy();
    });

    async function nextNumberWith(existing: Array<[string, boolean?]>): Promise<string> {
        const runner = ds.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            await runner.query(`CREATE TEMP TABLE tickets ("ticketNumber" varchar, "deletedAt" timestamptz) ON COMMIT DROP`);
            for (const [number, deleted] of existing) {
                await runner.query(`INSERT INTO tickets ("ticketNumber", "deletedAt") VALUES ($1, $2)`, [number, deleted ? new Date() : null]);
            }
            return await generateNextTicketNumber(runner.manager, 'FIN', day);
        } finally {
            await runner.rollbackTransaction();
            await runner.release();
        }
    }

    it('starts the day at 0001', async () => {
        expect(await nextNumberWith([])).toBe('231026-FIN-0001');
    });

    it('skips past a soft-deleted ticket that still holds its number', async () => {
        expect(await nextNumberWith([['231026-FIN-0010'], ['231026-FIN-0011', true]])).toBe('231026-FIN-0012');
    });

    it('shares one sequence across divisions and ignores other days and malformed numbers', async () => {
        expect(await nextNumberWith([
            ['231026-GEN-0009'], ['231026-ICT-0014'], ['221026-FIN-0099'], ['231026-OLD'], ['X231026-FIN-0500'], ['231026-FIN-'],
        ])).toBe('231026-FIN-0015');
    });

    it('counts legacy numbers whose division holds a space (regression: "261026-HC -0013 already exists")', async () => {
        expect(await nextNumberWith([['231026-FIN-0012'], ['231026-HC -0013']])).toBe('231026-FIN-0014');
    });

    it('compares numerically past 9999', async () => {
        expect(await nextNumberWith([['231026-FIN-9999'], ['231026-FIN-10000']])).toBe('231026-FIN-10001');
    });
});
