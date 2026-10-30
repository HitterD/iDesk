import { MigrationInterface, QueryRunner } from 'typeorm';

const SOURCES_BEFORE = ['TELEGRAM', 'WEB', 'EMAIL', 'IPOP'];
const SOURCES_AFTER = [...SOURCES_BEFORE, 'API'];

/**
 * Connected apps (e.g. EBBK): other office applications that file tickets through the API with their own
 * signing secret, allowed modules and features. tickets.source gains API for their tickets.
 * The source enum is recreated, not `ADD VALUE`, as in 1793700000000 (migrations run in one transaction).
 */
export class AddIntegrationApps1793930000000 implements MigrationInterface {
    name = 'AddIntegrationApps1793930000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.recreateSourceEnum(queryRunner, SOURCES_AFTER);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "integration_apps" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "clientId" varchar(20) NOT NULL,
                "name" varchar(100) NOT NULL,
                "description" varchar(300) NULL,
                "secretCipher" text NOT NULL,
                "secretHint" varchar(8) NOT NULL,
                "modules" jsonb NOT NULL DEFAULT '[]',
                "permissions" jsonb NOT NULL DEFAULT '[]',
                "webhookUrl" varchar(500) NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "lastUsedAt" TIMESTAMPTZ NULL,
                "createdById" uuid NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_integration_apps" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_integration_apps_client_id" ON "integration_apps" ("clientId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "integration_apps"`);
        await queryRunner.query(`UPDATE "tickets" SET "source" = 'WEB' WHERE "source" = 'API'`);
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
