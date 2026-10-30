import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePurpleFromZoomAccounts1792000000000 implements MigrationInterface {
    name = 'RemovePurpleFromZoomAccounts1792000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "zoom_accounts"
            SET "colorHex" = CASE "displayOrder"
                WHEN 1 THEN '#2563EB'
                WHEN 2 THEN '#0D9488'
                WHEN 3 THEN '#D97706'
                WHEN 4 THEN '#0284C7'
                WHEN 5 THEN '#059669'
                WHEN 6 THEN '#EA580C'
                WHEN 7 THEN '#475569'
                WHEN 8 THEN '#15803D'
                WHEN 9 THEN '#B45309'
                WHEN 10 THEN '#1E40AF'
                ELSE "colorHex"
            END
            WHERE "displayOrder" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
}
