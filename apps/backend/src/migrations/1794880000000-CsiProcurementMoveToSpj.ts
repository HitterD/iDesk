import { MigrationInterface, QueryRunner } from 'typeorm';

const SCOPE = 'PROCUREMENT';
const SPJ_CODE = 'SPJ';
const KRW_CODE = 'KRW';
const SPJ_TEMPLATE_NAME = 'CSI Procurement 2026 – Sepanjang';

/**
 * Moves the initial Procurement PICs and assignment template from KRW (SJA 2) to SPJ (Sepanjang / SJA 1).
 */
export class CsiProcurementMoveToSpj1794880000000 implements MigrationInterface {
    name = 'CsiProcurementMoveToSpj1794880000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const [spj]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "sites" WHERE UPPER("code") = $1 LIMIT 1`,
            [SPJ_CODE],
        );
        if (!spj) return;

        const [krw]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "sites" WHERE UPPER("code") = $1 LIMIT 1`,
            [KRW_CODE],
        );

        if (krw) {
            await queryRunner.query(
                `UPDATE "csi_pics" SET "siteId" = $1, "updatedAt" = now()
                 WHERE "scope" = $2 AND ("siteId" = $3 OR "siteId" IS NULL)`,
                [spj.id, SCOPE, krw.id],
            );
            await queryRunner.query(
                `UPDATE "csi_period_ratees" r
                 SET "siteId" = $1
                 FROM "csi_periods" p
                 WHERE r."periodId" = p."id" AND p."scope" = $2 AND p."status" = 'DRAFT' AND r."siteId" = $3`,
                [spj.id, SCOPE, krw.id],
            );
        } else {
            await queryRunner.query(
                `UPDATE "csi_pics" SET "siteId" = $1, "updatedAt" = now()
                 WHERE "scope" = $2 AND "siteId" IS NULL`,
                [spj.id, SCOPE],
            );
        }

        const [existingSpjTpl]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "csi_assignment_templates" WHERE "scope" = $1 AND "locationCode" = $2 LIMIT 1`,
            [SCOPE, SPJ_CODE],
        );
        if (!existingSpjTpl) {
            await queryRunner.query(
                `UPDATE "csi_assignment_templates"
                 SET "locationCode" = $1, "name" = $2, "updatedAt" = now()
                 WHERE "scope" = $3 AND "locationCode" = $4`,
                [SPJ_CODE, SPJ_TEMPLATE_NAME, SCOPE, KRW_CODE],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const [krw]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "sites" WHERE UPPER("code") = $1 LIMIT 1`,
            [KRW_CODE],
        );
        const [spj]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "sites" WHERE UPPER("code") = $1 LIMIT 1`,
            [SPJ_CODE],
        );
        if (krw && spj) {
            await queryRunner.query(
                `UPDATE "csi_pics" SET "siteId" = $1, "updatedAt" = now() WHERE "scope" = $2 AND "siteId" = $3`,
                [krw.id, SCOPE, spj.id],
            );
        }
    }
}
