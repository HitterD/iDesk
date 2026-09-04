import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileDevAndWebDevUserRoles1790400000000 implements MigrationInterface {
    name = 'AddMobileDevAndWebDevUserRoles1790400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'AGENT_WEB_DEV'`,
        );
        await queryRunner.query(
            `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'AGENT_MOBILE_DEV'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing values from an enum type easily.
    }
}
