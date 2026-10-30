import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateZoomAccountHarmoniousColors1791900000000 implements MigrationInterface {
    name = 'UpdateZoomAccountHarmoniousColors1791900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "zoom_accounts"
            SET "colorHex" = CASE "displayOrder"
                WHEN 1 THEN '#2563EB'
                WHEN 2 THEN '#0D9488'
                WHEN 3 THEN '#D97706'
                WHEN 4 THEN '#6366F1'
                WHEN 5 THEN '#7C3AED'
                WHEN 6 THEN '#BE185D'
                WHEN 7 THEN '#0284C7'
                WHEN 8 THEN '#059669'
                WHEN 9 THEN '#EA580C'
                WHEN 10 THEN '#475569'
                ELSE "colorHex"
            END
            WHERE "displayOrder" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback to legacy colors if needed
        await queryRunner.query(`
            UPDATE "zoom_accounts"
            SET "colorHex" = CASE "displayOrder"
                WHEN 1 THEN '#3B82F6'
                WHEN 2 THEN '#10B981'
                WHEN 3 THEN '#F59E0B'
                WHEN 4 THEN '#EF4444'
                WHEN 5 THEN '#8B5CF6'
                WHEN 6 THEN '#EC4899'
                WHEN 7 THEN '#06B6D4'
                WHEN 8 THEN '#84CC16'
                WHEN 9 THEN '#F97316'
                WHEN 10 THEN '#6366F1'
                ELSE "colorHex"
            END
            WHERE "displayOrder" IS NOT NULL
        `);
    }
}
