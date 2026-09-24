import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuidebookAcknowledgedAtToUsers1792400000000 implements MigrationInterface {
    name = 'AddGuidebookAcknowledgedAtToUsers1792400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guidebookAcknowledgedAt" TIMESTAMP;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" DROP COLUMN IF EXISTS "guidebookAcknowledgedAt";`
        );
    }
}
