import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks an email address as deliberately set by a human, so automated writers
 * never clobber it.
 *
 * A user may change their own email (PATCH /users/me/email) and an admin may
 * change it from the Edit User modal. Both stamp "emailOverriddenAt". The HRIS
 * daily sync and the CSV import consult that stamp and leave the address alone,
 * which is what stops a nightly sync from silently reverting the change.
 *
 * "emailOverriddenBy" records who did it — the user themself, or the admin —
 * and is nulled rather than cascaded if that account is later deleted, since the
 * override itself outlives whoever made it.
 */
export class AddUserEmailOverride1791200000000 implements MigrationInterface {
    name = 'AddUserEmailOverride1791200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "emailOverriddenAt" TIMESTAMP NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "emailOverriddenBy" character varying NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailOverriddenBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailOverriddenAt"`);
    }
}
