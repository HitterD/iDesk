import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Oracle/K2, Web Dev and Mobile Dev teams sit in Sepanjang, so the SPJ
 * TV board becomes the dev hub: it also shows dev tickets from every site.
 * Configurable per site afterwards (Settings → TV Board).
 */
export class AddSiteTvShowsDevTickets1793300000000 implements MigrationInterface {
    name = 'AddSiteTvShowsDevTickets1793300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "tvShowsDevTickets" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "sites" SET "tvShowsDevTickets" = true WHERE "code" = 'SPJ'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "tvShowsDevTickets"`);
    }
}
