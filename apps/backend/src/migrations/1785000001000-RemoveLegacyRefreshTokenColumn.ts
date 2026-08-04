import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the legacy `users.hashedRefreshToken` column after the Redis cutover.
 *
 * Gated on `AUTH_LEGACY_REFRESH_DROP=confirmed` so shipping this file does not drop the
 * column on the next deploy: the column is the rollback path for the cutover release and
 * must survive until the rollback window closes. Without the flag the migration records
 * itself as run and leaves the column in place, so a later run needs no new migration —
 * set the flag and re-run `migration:run` after cutover verification.
 *
 * `down` restores the column definition, not its contents: the hashes are credentials
 * that cannot be regenerated. A rollback past this point makes users log in again.
 */
export class RemoveLegacyRefreshTokenColumn1785000001000 implements MigrationInterface {
    name = 'RemoveLegacyRefreshTokenColumn1785000001000';

    public async up(q: QueryRunner): Promise<void> {
        if (process.env.AUTH_LEGACY_REFRESH_DROP !== 'confirmed') {
            console.warn(
                `[refresh-cutover] skipping drop of users.hashedRefreshToken: ` +
                `set AUTH_LEGACY_REFRESH_DROP=confirmed after cutover verification, then re-run migration:run`,
            );
            return;
        }
        await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hashedRefreshToken"`);
        console.log('[refresh-cutover] dropped users.hashedRefreshToken');
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hashedRefreshToken" character varying`,
        );
    }
}
