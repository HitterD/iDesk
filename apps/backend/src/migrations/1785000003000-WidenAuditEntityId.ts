import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit_logs.entityId` was declared uuid, but audit events are also raised for
 * things that have no uuid: a settings key ("mail.smtp", "storage.retention"),
 * a report name, or the sentinel "ALL". Postgres rejected those inserts with
 * `invalid input syntax for type uuid`, and because audit writes are
 * fire-and-forget the failure only surfaced in the log — every settings change
 * went unaudited. Widening to varchar keeps uuid values working unchanged while
 * letting a logical key be recorded.
 */
export class WidenAuditEntityId1785000003000 implements MigrationInterface {
    name = 'WidenAuditEntityId1785000003000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "audit_logs" ALTER COLUMN "entityId" TYPE character varying(255) USING "entityId"::text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rows holding a non-uuid key cannot be cast back; drop them so the
        // column can return to uuid rather than failing the rollback.
        await queryRunner.query(
            `DELETE FROM "audit_logs" WHERE "entityId" IS NOT NULL AND "entityId" !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`,
        );
        await queryRunner.query(
            `ALTER TABLE "audit_logs" ALTER COLUMN "entityId" TYPE uuid USING "entityId"::uuid`,
        );
    }
}
