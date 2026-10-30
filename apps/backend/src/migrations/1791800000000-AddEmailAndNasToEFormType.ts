import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailAndNasToEFormType1791800000000 implements MigrationInterface {
    name = 'AddEmailAndNasToEFormType1791800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "eform_requests_formtype_enum" ADD VALUE IF NOT EXISTS 'EMAIL'`,
        );
        await queryRunner.query(
            `ALTER TYPE "eform_requests_formtype_enum" ADD VALUE IF NOT EXISTS 'SYNOLOGY_NAS'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support dropping enum values from existing enum types
    }
}
