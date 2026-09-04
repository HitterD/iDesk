import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteDivisionRingtones1791000000000 implements MigrationInterface {
    name = 'AddSiteDivisionRingtones1791000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sites"
            ADD COLUMN IF NOT EXISTS "ringtoneNewTicketSupport" character varying,
            ADD COLUMN IF NOT EXISTS "ringtoneNewTicketOracle" character varying,
            ADD COLUMN IF NOT EXISTS "ringtoneNewTicketWebDev" character varying,
            ADD COLUMN IF NOT EXISTS "ringtoneNewTicketMobileDev" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sites"
            DROP COLUMN IF EXISTS "ringtoneNewTicketMobileDev",
            DROP COLUMN IF EXISTS "ringtoneNewTicketWebDev",
            DROP COLUMN IF EXISTS "ringtoneNewTicketOracle",
            DROP COLUMN IF EXISTS "ringtoneNewTicketSupport"
        `);
    }
}
