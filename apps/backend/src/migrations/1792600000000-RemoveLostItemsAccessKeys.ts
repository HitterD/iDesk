import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Lost Items feature was removed from the application.
 *
 * Strips the `lost_items` page key and `lost_item.*` feature keys from presets
 * and user permissions so the preset editor no longer shows them.
 * The lost_item_reports / found_item_claims / lost_item_status_logs tables
 * are intentionally kept so historical data is not destroyed.
 */
export class RemoveLostItemsAccessKeys1792600000000 implements MigrationInterface {
    name = 'RemoveLostItemsAccessKeys1792600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "pageAccess" = "pageAccess" - 'lost_items'
            WHERE "pageAccess" ? 'lost_items'
        `);
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "permissions" = "permissions" - 'lost_item.view' - 'lost_item.manage'
            WHERE "permissions" ?| ARRAY['lost_item.view', 'lost_item.manage']
        `);
        await queryRunner.query(`
            DELETE FROM "user_feature_permissions"
            WHERE "featureKey" IN ('lost_item.view', 'lost_item.manage')
        `);
        await queryRunner.query(`
            DELETE FROM "feature_definitions"
            WHERE "key" IN ('lost_item.view', 'lost_item.manage')
        `);
    }

    public async down(): Promise<void> {
        // Irreversible: the feature no longer exists, so there is nothing to restore.
    }
}
