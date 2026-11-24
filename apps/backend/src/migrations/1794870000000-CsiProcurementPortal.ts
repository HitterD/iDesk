import * as bcrypt from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BCRYPT_ROUNDS } from '../shared/core/config/security.config';
import { CSI_DEPARTMENT_NAMES_2026 } from '../modules/csi/csi-departments.data';
import { CSI_TEMPLATE_PROCUREMENT } from '../modules/csi/csi-template';
import { CSI_TEMPLATE_PROCUREMENT_KRW_2026 } from '../modules/csi/org/templates/procurement-krw-2026.data';

const SCOPE = 'PROCUREMENT';
const USERS_ROLE_ENUM = 'users_role_enum';
const NEW_ROLE = 'PROCUREMENT_ADMIN';
const PRESET_NAME = 'Admin Procurement';
const ADMIN_LOGIN = 'admin.procurement';
const ADMIN_EMAIL = 'admin.procurement@santosjayaabadi.co.id';
const ADMIN_NAME = 'Admin Procurement';
const FALLBACK_PIC_NIKS = ['TPL-PROC-001', 'TPL-PROC-002'] as const;

const SCOPE_TABLES = [
    'csi_dimensions',
    'csi_departments',
    'csi_raters',
    'csi_periods',
    'csi_teams',
    'csi_subject_profiles',
    'csi_rater_assignments',
    'csi_memo_settings',
    'csi_question_sets',
    'csi_pics',
    'csi_service_report_owners',
    'csi_assignment_templates',
    'ticket_modules',
] as const;

const normalizeName = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Adds CSI Procurement support:
 * 1. Widens `scope` columns from varchar(10) to varchar(20) so 'PROCUREMENT' (11 chars) fits.
 * 2. Recreates `users_role_enum` with 'PROCUREMENT_ADMIN' so it is immediately usable in this transaction.
 * 3. Creates system preset 'Admin Procurement' and seeds account `admin.procurement`.
 * 4. Seeds Procurement departments, the 5 standard star questions, the 2 Procurement PICs, and the KRW template.
 */
export class CsiProcurementPortal1794870000000 implements MigrationInterface {
    name = 'CsiProcurementPortal1794870000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.widenScopeColumns(queryRunner);
        await this.recreateUsersRoleEnum(queryRunner);
        const presetId = await this.ensurePreset(queryRunner);
        await this.ensureAdminUser(queryRunner, presetId);
        await this.seedDepartments(queryRunner);
        await this.seedDimensions(queryRunner);
        await this.seedKrwTemplate(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "csi_assignment_templates" WHERE "scope" = $1`, [SCOPE]);
        await queryRunner.query(`DELETE FROM "csi_pics" WHERE "scope" = $1`, [SCOPE]);
        await queryRunner.query(`DELETE FROM "csi_dimensions" WHERE "scope" = $1`, [SCOPE]);
        await queryRunner.query(`DELETE FROM "csi_departments" WHERE "scope" = $1`, [SCOPE]);
        await queryRunner.query(`DELETE FROM "users" WHERE "employeeId" = $1 OR "email" = $2`, [ADMIN_LOGIN, ADMIN_EMAIL]);
        await queryRunner.query(`DELETE FROM "permission_presets" WHERE "name" = $1 AND "isSystem" = true`, [PRESET_NAME]);
    }

    private async widenScopeColumns(queryRunner: QueryRunner): Promise<void> {
        for (const table of SCOPE_TABLES) {
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "scope" TYPE varchar(20)`);
        }
    }

    private async recreateUsersRoleEnum(queryRunner: QueryRunner): Promise<void> {
        const rows: Array<{ enumlabel: string }> = await queryRunner.query(
            `SELECT enumlabel FROM pg_enum WHERE enumtypid = '"${USERS_ROLE_ENUM}"'::regtype ORDER BY enumsortorder`,
        );
        if (!rows.length) throw new Error(`Enum "${USERS_ROLE_ENUM}" has no values`);
        const labels = rows.map((row) => row.enumlabel);
        if (labels.includes(NEW_ROLE)) return;
        const nextLabels = [...labels, NEW_ROLE].map((label) => `'${label.replace(/'/g, "''")}'`).join(', ');
        await queryRunner.query('SET LOCAL statement_timeout = 0');
        await queryRunner.query(`ALTER TYPE "${USERS_ROLE_ENUM}" RENAME TO "${USERS_ROLE_ENUM}_old"`);
        await queryRunner.query(`CREATE TYPE "${USERS_ROLE_ENUM}" AS ENUM (${nextLabels})`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "role" TYPE "${USERS_ROLE_ENUM}" USING "role"::text::"${USERS_ROLE_ENUM}"`,
        );
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'AGENT'`);
        await queryRunner.query(`DROP TYPE "${USERS_ROLE_ENUM}_old"`);
    }

    private async ensurePreset(queryRunner: QueryRunner): Promise<string> {
        const existing: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "permission_presets" WHERE "name" = $1 LIMIT 1`,
            [PRESET_NAME],
        );
        const pageAccess = JSON.stringify({ notifications: true, csi_admin_procurement: true });
        const permissions = JSON.stringify({
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        });
        if (existing.length) {
            await queryRunner.query(
                `UPDATE "permission_presets"
                 SET "pageAccess" = $2::jsonb, "permissions" = $3::jsonb, "isSystem" = true, "isActive" = true, "updatedAt" = now()
                 WHERE "id" = $1`,
                [existing[0].id, pageAccess, permissions],
            );
            return existing[0].id;
        }
        const inserted: Array<{ id: string }> = await queryRunner.query(
            `INSERT INTO "permission_presets" ("name", "description", "targetRole", "pageAccess", "permissions", "isDefault", "sortOrder", "isActive", "isSystem")
             VALUES ($1, $2, 'MANAGER', $3::jsonb, $4::jsonb, false, 9, true, true)
             RETURNING "id"`,
            [PRESET_NAME, 'Administrator Procurement. Hanya halaman admin Procurement (saat ini: Admin CSI Procurement).', pageAccess, permissions],
        );
        return inserted[0].id;
    }

    private async ensureAdminUser(queryRunner: QueryRunner, presetId: string): Promise<void> {
        const existing: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "users" WHERE "employeeId" = $1 OR "email" = $2 LIMIT 1`,
            [ADMIN_LOGIN, ADMIN_EMAIL],
        );
        if (existing.length) return;
        const rawPassword = process.env.PROCUREMENT_ADMIN_INITIAL_PASSWORD?.trim();
        const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, BCRYPT_ROUNDS) : null;
        await queryRunner.query(
            `INSERT INTO "users" ("email", "password", "fullName", "role", "employeeId", "isActive", "mustChangePassword", "appliedPresetId", "appliedPresetName")
             VALUES ($1, $2, $3, $4::users_role_enum, $5, true, true, $6, $7)`,
            [ADMIN_EMAIL, passwordHash, ADMIN_NAME, NEW_ROLE, ADMIN_LOGIN, presetId, PRESET_NAME],
        );
    }

    private async seedDepartments(queryRunner: QueryRunner): Promise<void> {
        for (const [index, name] of CSI_DEPARTMENT_NAMES_2026.entries()) {
            await queryRunner.query(
                `INSERT INTO "csi_departments" ("scope", "name", "isActive", "sortOrder") VALUES ($1, $2, true, $3)
                 ON CONFLICT ("scope", lower("name")) DO UPDATE SET "isActive" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()`,
                [SCOPE, name, index],
            );
        }
    }

    private async seedDimensions(queryRunner: QueryRunner): Promise<void> {
        const existing: Array<{ id: string; name: string }> = await queryRunner.query(
            `SELECT "id", "name" FROM "csi_dimensions" WHERE "scope" = $1`,
            [SCOPE],
        );
        const byKey = new Map(existing.map((row) => [row.name.trim().replace(/\s+/g, ' ').toLowerCase(), row.id]));
        for (const [index, question] of CSI_TEMPLATE_PROCUREMENT.entries()) {
            const key = question.name.trim().replace(/\s+/g, ' ').toLowerCase();
            if (byKey.has(key)) continue;
            await queryRunner.query(
                `INSERT INTO "csi_dimensions" ("scope", "name", "shortLabel", "description", "type", "required", "options", "isActive", "sortOrder")
                 VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, true, $7)`,
                [SCOPE, question.name, question.shortLabel ?? null, question.description ?? null, question.type, JSON.stringify(question.options), index],
            );
        }
    }

    private async seedKrwTemplate(queryRunner: QueryRunner): Promise<void> {
        const seed = CSI_TEMPLATE_PROCUREMENT_KRW_2026;
        const [siteRow]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "sites" WHERE UPPER("code") = $1 LIMIT 1`,
            [seed.locationCode],
        );
        const siteId = siteRow?.id ?? null;
        const users: Array<{ id: string; fullName: string; employeeId: string | null }> = await queryRunner.query(
            `SELECT "id", "fullName", "employeeId" FROM "users" WHERE "isActive" = true`,
        );
        const orgPeople: Array<{ nik: string; fullName: string; jobTitle: string | null; bagian: string | null; workLocation: string | null }> = await queryRunner.query(
            `SELECT "nik", "fullName", "jobTitle", "bagian", "workLocation" FROM "csi_org_people"`,
        );
        const userByNik = new Map(users.filter((u) => u.employeeId).map((u) => [u.employeeId!.trim(), u]));
        const usersByName = new Map<string, typeof users>();
        for (const u of users) {
            const key = normalizeName(u.fullName);
            usersByName.set(key, [...(usersByName.get(key) ?? []), u]);
        }
        const uniqueUserByName = (name: string) => {
            const matches = usersByName.get(normalizeName(name)) ?? [];
            return matches.length === 1 ? matches[0] : null;
        };
        const orgByName = new Map<string, typeof orgPeople>();
        for (const p of orgPeople) {
            const key = normalizeName(p.fullName);
            orgByName.set(key, [...(orgByName.get(key) ?? []), p]);
        }
        const uniqueOrgByName = (name: string) => {
            const matches = orgByName.get(normalizeName(name)) ?? [];
            return matches.length === 1 ? matches[0] : null;
        };

        const [existingTemplate]: Array<{ id: string }> = await queryRunner.query(
            `SELECT "id" FROM "csi_assignment_templates" WHERE "scope" = $1 AND "locationCode" = $2 LIMIT 1`,
            [SCOPE, seed.locationCode],
        );
        const templateId = existingTemplate?.id ?? (await queryRunner.query(
            `INSERT INTO "csi_assignment_templates" ("scope", "locationCode", "name") VALUES ($1, $2, $3) RETURNING "id"`,
            [SCOPE, seed.locationCode, seed.name],
        ))[0].id;

        for (const [picIndex, picSeed] of seed.pics.entries()) {
            const normalizedPicName = normalizeName(picSeed.picName);
            const orgHit = uniqueOrgByName(normalizedPicName);
            const userHit = (orgHit?.nik ? userByNik.get(orgHit.nik) : undefined) ?? uniqueUserByName(normalizedPicName);
            const picNik = orgHit?.nik ?? userHit?.employeeId ?? FALLBACK_PIC_NIKS[picIndex] ?? `TPL-PROC-${String(picIndex + 1).padStart(3, '0')}`;

            const existingPic: Array<{ id: string }> = await queryRunner.query(
                `SELECT "id" FROM "csi_pics" WHERE "scope" = $1 AND ("nik" = $2 OR UPPER(TRIM("fullName")) = $3) LIMIT 1`,
                [SCOPE, picNik, normalizedPicName],
            );
            const picId = existingPic[0]?.id ?? (await queryRunner.query(
                `INSERT INTO "csi_pics" ("scope", "nik", "fullName", "jobTitle", "serviceCode", "serviceFunction", "bagian", "workLocation", "siteId", "userId", "isActive")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
                 RETURNING "id"`,
                [
                    SCOPE,
                    picNik,
                    orgHit?.fullName ?? normalizedPicName,
                    orgHit?.jobTitle ?? picSeed.jobTitle ?? null,
                    picSeed.serviceCode,
                    picSeed.serviceFunction ?? null,
                    orgHit?.bagian ?? null,
                    orgHit?.workLocation ?? null,
                    siteId,
                    userHit?.id ?? null,
                ],
            ))[0].id;

            const existingTplPic: Array<{ id: string }> = await queryRunner.query(
                `SELECT "id" FROM "csi_assignment_template_pics" WHERE "templateId" = $1 AND "picName" = $2 LIMIT 1`,
                [templateId, normalizedPicName],
            );
            const templatePicId = existingTplPic[0]?.id ?? (await queryRunner.query(
                `INSERT INTO "csi_assignment_template_pics" ("templateId", "area", "serviceCode", "picName", "picNik", "jobTitle", "serviceFunction", "picId", "sortOrder")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING "id"`,
                [
                    templateId,
                    picSeed.area,
                    picSeed.serviceCode,
                    normalizedPicName,
                    orgHit?.nik ?? userHit?.employeeId ?? null,
                    picSeed.jobTitle ?? null,
                    picSeed.serviceFunction ?? null,
                    picId,
                    picIndex,
                ],
            ))[0].id;

            for (const raterSeed of picSeed.raters) {
                const normalizedRaterName = normalizeName(raterSeed.name);
                const raterUser = (raterSeed.nik ? userByNik.get(raterSeed.nik) : undefined) ?? uniqueUserByName(normalizedRaterName);
                await queryRunner.query(
                    `INSERT INTO "csi_assignment_template_raters" ("templatePicId", "raterName", "raterJobTitle", "raterNik", "userId")
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT ("templatePicId", "raterName") DO NOTHING`,
                    [
                        templatePicId,
                        normalizedRaterName,
                        raterSeed.jobTitle ?? null,
                        raterSeed.nik ?? raterUser?.employeeId ?? null,
                        raterUser?.id ?? null,
                    ],
                );
            }
        }
    }
}
