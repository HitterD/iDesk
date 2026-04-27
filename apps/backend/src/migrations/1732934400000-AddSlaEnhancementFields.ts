import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlaEnhancementFields1732934400000 implements MigrationInterface {
    name = 'AddSlaEnhancementFields1732934400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add slaStartedAt - When SLA timer actually starts (status -> IN_PROGRESS)
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "slaStartedAt" timestamp`);

        // Add firstResponseAt - When agent first responded
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "firstResponseAt" timestamp`);

        // Add firstResponseTarget - Target time for first response
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "firstResponseTarget" timestamp`);

        // Add isFirstResponseBreached - Flag if first response SLA was breached
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "isFirstResponseBreached" boolean NOT NULL DEFAULT false`);

        // Add resolvedAt - When ticket was resolved
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp`);

        // Add waitingVendorAt - When ticket entered waiting vendor status
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "waitingVendorAt" timestamp`);

        // Add totalWaitingVendorMinutes - Total time spent waiting for vendor
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "totalWaitingVendorMinutes" int NOT NULL DEFAULT 0`);

        // Add indexes for SLA queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_slaStartedAt" ON "tickets" ("slaStartedAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_firstResponseTarget" ON "tickets" ("firstResponseTarget")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_isFirstResponseBreached" ON "tickets" ("isFirstResponseBreached")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_isFirstResponseBreached"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_firstResponseTarget"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_slaStartedAt"`);

        // Drop columns
        await queryRunner.dropColumn('tickets', 'totalWaitingVendorMinutes');
        await queryRunner.dropColumn('tickets', 'waitingVendorAt');
        await queryRunner.dropColumn('tickets', 'resolvedAt');
        await queryRunner.dropColumn('tickets', 'isFirstResponseBreached');
        await queryRunner.dropColumn('tickets', 'firstResponseTarget');
        await queryRunner.dropColumn('tickets', 'firstResponseAt');
        await queryRunner.dropColumn('tickets', 'slaStartedAt');
    }
}
