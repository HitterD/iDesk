import { MigrationInterface, QueryRunner } from 'typeorm';
import { CSI_DEPARTMENT_NAMES_2026 } from '../modules/csi/csi-departments.data';

const SCOPES = ['ICT', 'HC'] as const;

/**
 * Replaces the CSI respondent departments of both scopes with the "Division / Department" list of the approver
 * hierarchy. Old rows are deactivated, never deleted: past responses reference them (and keep their name snapshot).
 * A listed name that already exists (case-insensitive) is reactivated instead of duplicated. Idempotent.
 */
export class CsiDepartmentsFromHierarchy1794110000000 implements MigrationInterface {
    name = 'CsiDepartmentsFromHierarchy1794110000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "csi_departments" SET "isActive" = false, "updatedAt" = now() WHERE "scope" IN ('ICT', 'HC')`);
        for (const scope of SCOPES) {
            for (const [index, name] of CSI_DEPARTMENT_NAMES_2026.entries()) {
                await queryRunner.query(
                    `INSERT INTO "csi_departments" ("scope", "name", "isActive", "sortOrder") VALUES ($1, $2, true, $3)
                     ON CONFLICT ("scope", lower("name")) DO UPDATE SET "isActive" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()`,
                    [scope, name, index],
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The previous list is not recoverable by name; rows stay, admins re-activate what they need in Master data.
        await queryRunner.query(`UPDATE "csi_departments" SET "isActive" = true, "updatedAt" = now() WHERE "scope" IN ('ICT', 'HC')`);
    }
}
