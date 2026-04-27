import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDivisionToHardwareRequest1776600000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "division" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "division"`);
    }
}
