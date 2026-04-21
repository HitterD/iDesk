import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesktopToHardwareCategory1776600000002 implements MigrationInterface {
    name = 'AddDesktopToHardwareCategory1776600000002';

    async up(queryRunner: QueryRunner): Promise<void> {
        // In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in older versions,
        // but TypeORM usually runs each query. If there's an issue with transaction blocks, you can add 
        // { transaction: false } to your Data Source config or handle it.
        // For Postgres 12+, ADD VALUE IF NOT EXISTS is supported and sometimes requires being outside transaction.
        // To be safe, we'll try catching the error if it already exists, though IF NOT EXISTS is standard.
        await queryRunner.query(`ALTER TYPE hardware_catalog_category_enum ADD VALUE IF NOT EXISTS 'DESKTOP';`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support dropping a value from an ENUM type easily.
        // It requires creating a new type, altering the column to use the new type, and dropping the old one.
        // For this simple addition, down is left blank.
    }
}
