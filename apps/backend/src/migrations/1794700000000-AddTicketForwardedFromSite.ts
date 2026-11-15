import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive: records which handling site forwarded an IT Support ticket to another site,
 * so the destination badge, ticket list, and TV board can still show the originating site.
 */
export class AddTicketForwardedFromSite1794700000000 implements MigrationInterface {
    name = 'AddTicketForwardedFromSite1794700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "forwardedFromSiteId" uuid NULL REFERENCES "sites"("id") ON DELETE SET NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "forwardedFromSiteId"`,
        );
    }
}
