import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandlingTeam1790100000000 implements MigrationInterface {
    name = 'AddHandlingTeam1790100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Idempotent: DO block creates the enum only if it does not exist yet.
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "handling_team_enum" AS ENUM ('OPS_SUPPORT', 'ORACLE_DEV');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        // Reuse the established Oracle identification: ticketType ORACLE_REQUEST
        // or an Oracle/K2 category. Covers both edges the codebase used to sniff.
        await queryRunner.query(
            `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "handlingTeam" "handling_team_enum" DEFAULT 'OPS_SUPPORT' NOT NULL`,
        );
        await queryRunner.query(`
            UPDATE "tickets" SET "handlingTeam" = 'ORACLE_DEV'
            WHERE "ticketType" = 'ORACLE_REQUEST'
               OR LOWER(COALESCE("category", '')) IN
                  ('oracle', 'k2', 'oracle / k2', 'oracle/k2', 'oracle_request')
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_tickets_handling_team" ON "tickets" ("handlingTeam")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_handling_team"`);
        await queryRunner.query(
            `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "handlingTeam"`,
        );
        await queryRunner.query(`DROP TYPE IF EXISTS "handling_team_enum"`);
    }
}
