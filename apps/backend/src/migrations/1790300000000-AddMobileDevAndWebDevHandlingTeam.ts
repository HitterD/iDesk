import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileDevAndWebDevHandlingTeam1790300000000 implements MigrationInterface {
    name = 'AddMobileDevAndWebDevHandlingTeam1790300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "handling_team_enum" ADD VALUE IF NOT EXISTS 'MOBILE_DEV'`,
        );
        await queryRunner.query(
            `ALTER TYPE "handling_team_enum" ADD VALUE IF NOT EXISTS 'WEB_DEV'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing values from an enum type easily.
    }
}
