import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills `users.siteId` from Sepanjang (SPJ) (or NULL) to Sukodono (SKD) for active accounts whose normalized
 * `employeeId` appears in `csi_org_people` under Work Location `SJA-3` / `SJA 3` / `SJA3`.
 *
 * ICT tickets and hardware/e-form requests from SKD users still route to Sepanjang via `sites.handledBySiteId`.
 */
export class BackfillSukodonoUserSites1794600000000 implements MigrationInterface {
    name = 'BackfillSukodonoUserSites1794600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "users" u
            SET "siteId" = skd."id"
            FROM "sites" skd, "sites" spj, "csi_org_people" o
            WHERE skd."code" = 'SKD'
              AND spj."code" = 'SPJ'
              AND u."isActive" = true
              AND (u."siteId" = spj."id" OR u."siteId" IS NULL)
              AND (
                  CASE
                      WHEN BTRIM(COALESCE(u."employeeId", '')) ~ '^[0-9]+$'
                          THEN LPAD(BTRIM(u."employeeId"), 8, '0')
                      ELSE BTRIM(COALESCE(u."employeeId", ''))
                  END
              ) = o."nik"
              AND UPPER(REGEXP_REPLACE(BTRIM(COALESCE(o."workLocation", '')), '[[:space:]_-]+', '', 'g')) = 'SJA3'
        `);
    }

    /**
     * Intentionally a no-op: users who already belonged to SKD before this backfill cannot be distinguished from rows
     * moved here, so rolling back automatically would corrupt pre-existing SKD accounts.
     */
    public async down(): Promise<void> {
        // No-op: see doc comment.
    }
}
