import { MigrationInterface, QueryRunner } from 'typeorm';

const SOURCES_BEFORE = ['TELEGRAM', 'WEB', 'EMAIL'];
const SOURCES_AFTER = [...SOURCES_BEFORE, 'IPOP'];

/**
 * iPop integration:
 * - tickets.source gains IPOP; externalSource + externalRef make creation idempotent
 *   (a retried request returns the ticket it already created).
 * - integration_webhook_outbox queues signed status callbacks with retries.
 *
 * The source enum is recreated (not `ADD VALUE`) for the same reason as the status
 * enum in 1792800000000: TypeORM runs migrations in one transaction.
 */
export class AddIpopIntegration1793700000000 implements MigrationInterface {
    name = 'AddIpopIntegration1793700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.recreateSourceEnum(queryRunner, SOURCES_AFTER);

        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "externalSource" varchar(20) NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "externalRef" varchar(100) NULL`);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tickets_external_ref"
            ON "tickets" ("externalSource", "externalRef")
            WHERE "externalSource" IS NOT NULL AND "externalRef" IS NOT NULL
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "integration_webhook_outbox" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "target" varchar(20) NOT NULL,
                "event" varchar(50) NOT NULL,
                "ticketId" uuid NULL,
                "payload" jsonb NOT NULL,
                "status" varchar(20) NOT NULL DEFAULT 'PENDING',
                "attempts" smallint NOT NULL DEFAULT 0,
                "nextAttemptAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lastError" text NULL,
                "deliveredAt" TIMESTAMP NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_integration_webhook_outbox" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_webhook_outbox_due"
            ON "integration_webhook_outbox" ("nextAttemptAt")
            WHERE "status" = 'PENDING'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "integration_webhook_outbox"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tickets_external_ref"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "externalRef"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "externalSource"`);
        await queryRunner.query(`UPDATE "tickets" SET "source" = 'WEB' WHERE "source" = 'IPOP'`);
        await this.recreateSourceEnum(queryRunner, SOURCES_BEFORE);
    }

    private async recreateSourceEnum(queryRunner: QueryRunner, values: string[]): Promise<void> {
        const list = values.map((v) => `'${v}'`).join(', ');
        await queryRunner.query(`ALTER TYPE "tickets_source_enum" RENAME TO "tickets_source_enum_old"`);
        await queryRunner.query(`CREATE TYPE "tickets_source_enum" AS ENUM (${list})`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "source" DROP DEFAULT`);
        await queryRunner.query(
            `ALTER TABLE "tickets" ALTER COLUMN "source" TYPE "tickets_source_enum" USING "source"::text::"tickets_source_enum"`,
        );
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "source" SET DEFAULT 'WEB'`);
        await queryRunner.query(`DROP TYPE "tickets_source_enum_old"`);
    }
}
