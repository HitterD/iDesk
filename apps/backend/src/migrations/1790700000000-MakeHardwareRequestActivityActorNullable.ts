import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeHardwareRequestActivityActorNullable1790700000000 implements MigrationInterface {
    name = 'MakeHardwareRequestActivityActorNullable1790700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'hardware_request_activities' 
                    AND column_name = 'actorId'
                ) THEN
                    ALTER TABLE "hardware_request_activities" ALTER COLUMN "actorId" DROP NOT NULL;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'hardware_request_activities' 
                    AND column_name = 'actor_id'
                ) THEN
                    ALTER TABLE "hardware_request_activities" ALTER COLUMN "actor_id" DROP NOT NULL;
                END IF;
            END $$;
        `);

        // Safely update foreign key constraint to ON DELETE SET NULL if needed
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'FK_cb8bcd3a144cec7997cabd1ac3a'
                    AND table_name = 'hardware_request_activities'
                ) THEN
                    ALTER TABLE "hardware_request_activities" 
                    DROP CONSTRAINT "FK_cb8bcd3a144cec7997cabd1ac3a";

                    ALTER TABLE "hardware_request_activities"
                    ADD CONSTRAINT "FK_cb8bcd3a144cec7997cabd1ac3a"
                    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            EXCEPTION
                WHEN others THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'hardware_request_activities' 
                    AND column_name = 'actorId'
                ) THEN
                    ALTER TABLE "hardware_request_activities" ALTER COLUMN "actorId" SET NOT NULL;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'hardware_request_activities' 
                    AND column_name = 'actor_id'
                ) THEN
                    ALTER TABLE "hardware_request_activities" ALTER COLUMN "actor_id" SET NOT NULL;
                END IF;
            END $$;
        `);
    }
}
