import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebDevAndMobileDevTicketType1790200000000 implements MigrationInterface {
    name = 'AddWebDevAndMobileDevTicketType1790200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'WEB_DEV_REQUEST'`,
        );
        await queryRunner.query(
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'MOBILE_DEV_REQUEST'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing values from an enum type easily.
    }
}
