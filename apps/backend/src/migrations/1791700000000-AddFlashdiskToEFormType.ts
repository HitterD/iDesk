import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlashdiskToEFormType1791700000000 implements MigrationInterface {
    name = 'AddFlashdiskToEFormType1791700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "eform_requests_formtype_enum" ADD VALUE IF NOT EXISTS 'FLASHDISK'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support dropping enum values from existing enum types
    }
}
