import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the new danger-zone page to the persisted Admin preset without changing
 * any other role or user data. The runtime defaults cover fresh presets; this
 * migration covers installations whose Admin preset already exists.
 */
export class AddDataWipeAdminAccess1791500000000 implements MigrationInterface {
    name = 'AddDataWipeAdminAccess1791500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "pageAccess" = jsonb_set(
                COALESCE("pageAccess", '{}'::jsonb),
                '{data_wipe}',
                'true'::jsonb,
                true
            )
            WHERE "name" = 'Admin'
              AND "isSystem" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "pageAccess" = "pageAccess" - 'data_wipe'
            WHERE "name" = 'Admin'
              AND "isSystem" = true
        `);
    }
}
