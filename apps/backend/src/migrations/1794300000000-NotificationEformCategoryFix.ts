import { MigrationInterface, QueryRunner } from 'typeorm';

const TYPE_ENUMS = ['notifications_type_enum', 'notification_type_enum'];
const CATEGORY_ENUMS = ['notifications_category_enum', 'notification_category_enum'];
const CATEGORIES = ['CATEGORY_HARDWARE', 'CATEGORY_ZOOM', 'CATEGORY_EFORM'];

/**
 * E-Form notifications filed under the wrong category tab.
 *
 * - EFORM_DIRECT_TO_ICT / EFORM_FULFILLED were missing from the category mapper, so they were stored as
 *   CATEGORY_TICKET: shown under Tickets, and a click opened the ticket list instead of the e-form.
 * - The e-form expiry reminder was sent as SYSTEM (also CATEGORY_TICKET); new ones use their own type,
 *   EFORM_EXPIRY_REMINDER. Existing reminder rows (a SYSTEM row whose referenceId is an e-form) keep their
 *   type but move to CATEGORY_EFORM, which is what the click routing and the category tabs read.
 * - No earlier migration added CATEGORY_ZOOM / CATEGORY_EFORM to the category enum; they are added if missing.
 *
 * Enum types exist under two names across environments (see 1792300000000), so both are handled. A value
 * added here cannot be used in this same transaction, so rows are only moved when CATEGORY_EFORM already existed
 * (if it did not, no e-form notification could have been stored in the first place).
 */
export class NotificationEformCategoryFix1794300000000 implements MigrationInterface {
    name = 'NotificationEformCategoryFix1794300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const typeName of TYPE_ENUMS) {
            if (!(await this.typeExists(queryRunner, typeName))) continue;
            await queryRunner.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'EFORM_EXPIRY_REMINDER'`);
        }

        const eformCategoryExisted = await this.columnAcceptsCategory(queryRunner, 'CATEGORY_EFORM');
        for (const typeName of CATEGORY_ENUMS) {
            if (!(await this.typeExists(queryRunner, typeName))) continue;
            for (const value of CATEGORIES) {
                await queryRunner.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`);
            }
        }
        if (!eformCategoryExisted) return;

        await queryRunner.query(
            `UPDATE "notifications" SET "category" = 'CATEGORY_EFORM'
             WHERE "type" IN ('EFORM_DIRECT_TO_ICT', 'EFORM_FULFILLED') AND "category" <> 'CATEGORY_EFORM'`,
        );
        await queryRunner.query(
            `UPDATE "notifications" n SET "category" = 'CATEGORY_EFORM'
             WHERE n."type" = 'SYSTEM' AND n."referenceId" IS NOT NULL
               AND EXISTS (SELECT 1 FROM "eform_requests" e WHERE e."id"::text = n."referenceId")`,
        );
    }

    public async down(): Promise<void> {
        // PostgreSQL cannot drop enum values, and moving rows back to the wrong category tab helps no one.
    }

    private async typeExists(queryRunner: QueryRunner, typeName: string): Promise<boolean> {
        const rows = await queryRunner.query(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS "exists"`, [typeName]);
        return Boolean(rows[0]?.exists);
    }

    /** True when notifications.category already accepts the value (a text column, or an enum that has it). */
    private async columnAcceptsCategory(queryRunner: QueryRunner, value: string): Promise<boolean> {
        const rows = await queryRunner.query(
            `SELECT c.udt_name AS "udt", c.data_type AS "dataType",
                    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
                            WHERE t.typname = c.udt_name AND e.enumlabel = $1) AS "hasValue"
             FROM information_schema.columns c
             WHERE c.table_name = 'notifications' AND c.column_name = 'category'`,
            [value],
        );
        const column = rows[0];
        if (!column) return false;
        return column.dataType !== 'USER-DEFINED' || Boolean(column.hasValue);
    }
}
