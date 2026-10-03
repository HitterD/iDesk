import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-board TV palette (light/dark), chosen in Settings → TV Board.
 * A TV screen can still override it locally with the on-screen toggle.
 */
export class AddSiteTvTheme1793400000000 implements MigrationInterface {
    name = 'AddSiteTvTheme1793400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "tvTheme" varchar(5) NOT NULL DEFAULT 'light'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "tvTheme"`);
    }
}
