import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive: site Sukodono (SKD, report location SJA 3); inserted only when no SKD row exists. */
export class CsiSiteSukodono1794240000000 implements MigrationInterface {
    name = 'CsiSiteSukodono1794240000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "sites" ("code", "name", "description", "timezone", "isActive", "isServerHost")
            SELECT 'SKD', 'Sukodono', 'Sukodono branch', 'Asia/Jakarta', true, false
            WHERE NOT EXISTS (SELECT 1 FROM "sites" WHERE "code" = 'SKD')`);
    }

    /** Removes SKD only while no account points at it; accounts moved there keep their site. */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "sites" WHERE "code" = 'SKD'
            AND NOT EXISTS (SELECT 1 FROM "users" WHERE "siteId" = "sites"."id")`);
    }
}
