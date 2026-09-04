import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-module assignment isolation.
 *
 * - `assignee_user_ids`: explicit per-person pool. Seeded EMPTY on purpose —
 *   a migration must not guess team membership, and empty means "fall back to
 *   assignee_roles", i.e. today's behaviour is preserved until an admin curates
 *   a list.
 * - `auto_assign_enabled`: only IT Support is turned on. This is the fix for
 *   Oracle/Web/Mobile tickets being auto-assigned into the ops-support pool.
 */
export class AddModuleAssigneeIsolation1791300000000 implements MigrationInterface {
    name = 'AddModuleAssigneeIsolation1791300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            ADD COLUMN IF NOT EXISTS "assignee_user_ids" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
        `);

        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            ADD COLUMN IF NOT EXISTS "auto_assign_enabled" boolean NOT NULL DEFAULT false;
        `);

        await queryRunner.query(`
            UPDATE "ticket_modules"
            SET "auto_assign_enabled" = true
            WHERE "slug" = 'it-support';
        `);

        await queryRunner.query(`
            UPDATE "ticket_modules"
            SET "auto_assign_enabled" = false
            WHERE "slug" IN ('oracle-k2', 'web-developer', 'mobile-developer');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ticket_modules" DROP COLUMN IF EXISTS "auto_assign_enabled";
        `);
        await queryRunner.query(`
            ALTER TABLE "ticket_modules" DROP COLUMN IF EXISTS "assignee_user_ids";
        `);
    }
}
