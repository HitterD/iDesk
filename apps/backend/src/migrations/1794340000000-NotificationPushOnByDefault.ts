import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The "push" preference used to be ignored (every user got browser push), while it was stored as off by default.
 * Now it is honoured, so it defaults to on and existing rows are switched on: nobody silently loses the push they
 * have been receiving. Users who do not want it turn it off in Settings, which now takes effect.
 */
export class NotificationPushOnByDefault1794340000000 implements MigrationInterface {
    name = 'NotificationPushOnByDefault1794340000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "pushEnabled" SET DEFAULT true`);
        await queryRunner.query(`UPDATE "notification_preferences" SET "pushEnabled" = true WHERE "pushEnabled" = false`);
        // Per-type in-app toggles were stored under "inApp", which the delivery code never read; keep them as "in_app".
        await queryRunner.query(`
            UPDATE "notification_preferences" p
            SET "typeSettings" = (
                SELECT jsonb_object_agg(t.key,
                    CASE WHEN t.value ? 'inApp'
                         THEN (t.value - 'inApp') || jsonb_build_object('in_app', t.value -> 'inApp')
                         ELSE t.value END)
                FROM jsonb_each(p."typeSettings") t
            )
            WHERE p."typeSettings" IS NOT NULL AND p."typeSettings"::text LIKE '%"inApp"%'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "pushEnabled" SET DEFAULT false`);
    }
}
