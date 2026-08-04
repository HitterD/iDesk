import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preparation step for moving refresh sessions from `users.hashedRefreshToken` to Redis.
 *
 * Adds no schema: Redis owns session state, and the legacy column must survive the
 * rollback window untouched. It only pins the column definition (so
 * RemoveLegacyRefreshTokenColumn.down can restore it) and records how many legacy
 * sessions exist, which is the reconciliation baseline for the cutover.
 *
 * Nothing here is destructive, so a rerun is a no-op and `down` has nothing to undo.
 */
export class PrepareRefreshSessionCutover1785000000000 implements MigrationInterface {
    name = 'PrepareRefreshSessionCutover1785000000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hashedRefreshToken" character varying`,
        );

        // Count only. The hashes themselves are credentials and are never logged.
        const [{ count }] = await q.query(
            `SELECT COUNT(*)::int AS count FROM "users" WHERE "hashedRefreshToken" IS NOT NULL`,
        );
        console.log(
            `[refresh-cutover] legacy refresh sessions before cutover: ${count}. ` +
            `Record this with the release evidence; compare against Redis session count after cutover.`,
        );
    }

    public async down(): Promise<void> {
        // Nothing to reverse: this migration adds no state and drops no data.
    }
}
