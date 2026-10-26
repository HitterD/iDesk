import { DataSource, QueryRunner } from 'typeorm';
import { GuardTicketNumberFormat1793980000000 } from '../../../migrations/1793980000000-GuardTicketNumberFormat';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * Runs the trigger migration on a real Postgres against a TEMP table shadowing tickets, inside a transaction that is
 * rolled back, so no real rows or functions are touched. Run with TEST_DATABASE_URL=postgres://user:pass@host:5432/db.
 */
maybeDescribe('GuardTicketNumberFormat (integration, real Postgres)', () => {
    let ds: DataSource;

    beforeAll(async () => {
        ds = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL });
        await ds.initialize();
    });

    afterAll(async () => {
        await ds?.destroy();
    });

    async function withGuardedTable(run: (runner: QueryRunner) => Promise<void>): Promise<void> {
        const runner = ds.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            await runner.query(`CREATE TEMP TABLE tickets ("id" serial, "ticketNumber" varchar, "status" varchar) ON COMMIT DROP`);
            // A legacy malformed row from before the guard.
            await runner.query(`INSERT INTO tickets ("ticketNumber", "status") VALUES ('261026-HC -0013', 'TODO')`);
            await new GuardTicketNumberFormat1793980000000().up(runner);
            await run(runner);
        } finally {
            await runner.rollbackTransaction();
            await runner.release();
        }
    }

    const insert = (runner: QueryRunner, number: string | null) =>
        runner.query(`INSERT INTO tickets ("ticketNumber") VALUES ($1)`, [number]);

    it('accepts well-formed numbers and null', async () => {
        await withGuardedTable(async (runner) => {
            await insert(runner, '261026-HC-0014');
            await insert(runner, '261026-GEN-10000');
            await insert(runner, null);
        });
    });

    it.each(['261026-HC -0014', '261026-R&D-0014', '261026-hc-0014', '261026-HC-14', '261026-IT-SPJ-0014'])(
        'rejects %p', async (number) => {
            await withGuardedTable(async (runner) => {
                await expect(insert(runner, number)).rejects.toThrow('Invalid ticket number format');
            });
        },
    );

    it('still lets legacy malformed tickets be updated', async () => {
        await withGuardedTable(async (runner) => {
            await runner.query(`UPDATE tickets SET "status" = 'RESOLVED' WHERE "ticketNumber" = '261026-HC -0013'`);
            const rows = await runner.query(`SELECT "status" FROM tickets WHERE "ticketNumber" = '261026-HC -0013'`);
            expect(rows[0].status).toBe('RESOLVED');
        });
    });
});
