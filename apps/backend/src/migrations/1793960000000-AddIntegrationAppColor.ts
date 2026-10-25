import { MigrationInterface, QueryRunner } from 'typeorm';

/** Dot colour of a connected app's ticket source badge; null = derived from the client id. */
export class AddIntegrationAppColor1793960000000 implements MigrationInterface {
    name = 'AddIntegrationAppColor1793960000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "integration_apps" ADD COLUMN IF NOT EXISTS "color" varchar(16) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "integration_apps" DROP COLUMN IF EXISTS "color"`);
    }
}
