import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMobileDevAndWebDevHandlingTeamData1790300100000 implements MigrationInterface {
    name = 'UpdateMobileDevAndWebDevHandlingTeamData1790300100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "tickets" SET "handlingTeam" = 'MOBILE_DEV'
            WHERE "ticketType" = 'MOBILE_DEV_REQUEST'
               OR LOWER(COALESCE("category", '')) IN
                  ('mobile_dev_request', 'mobile_developer', 'mobile developer')
        `);
        await queryRunner.query(`
            UPDATE "tickets" SET "handlingTeam" = 'WEB_DEV'
            WHERE "ticketType" = 'WEB_DEV_REQUEST'
               OR LOWER(COALESCE("category", '')) IN
                  ('web_dev_request', 'web_developer', 'web developer')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration needed
    }
}
