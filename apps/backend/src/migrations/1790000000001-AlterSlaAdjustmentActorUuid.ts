import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterSlaAdjustmentActorUuid1790000000001 implements MigrationInterface {
    name = 'AlterSlaAdjustmentActorUuid1790000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Safely alter actorId and approvedById from varchar to uuid
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sla_adjustments' 
                    AND column_name = 'actorId' 
                    AND data_type = 'character varying'
                ) THEN
                    ALTER TABLE "sla_adjustments" 
                    ALTER COLUMN "actorId" TYPE uuid 
                    USING (CASE WHEN "actorId" ~ '^[0-9a-fA-F-]{36}$' THEN "actorId"::uuid ELSE NULL END);
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sla_adjustments' 
                    AND column_name = 'approvedById' 
                    AND data_type = 'character varying'
                ) THEN
                    ALTER TABLE "sla_adjustments" 
                    ALTER COLUMN "approvedById" TYPE uuid 
                    USING (CASE WHEN "approvedById" ~ '^[0-9a-fA-F-]{36}$' THEN "approvedById"::uuid ELSE NULL END);
                END IF;
            END $$;
        `);

        // Add foreign key constraint to users table if not exists
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "sla_adjustments" 
                ADD CONSTRAINT "FK_sla_adjustments_actor" 
                FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sla_adjustments" DROP CONSTRAINT IF EXISTS "FK_sla_adjustments_actor";
        `);
        await queryRunner.query(`
            ALTER TABLE "sla_adjustments" 
            ALTER COLUMN "actorId" TYPE varchar USING "actorId"::text,
            ALTER COLUMN "approvedById" TYPE varchar USING "approvedById"::text;
        `);
    }
}
