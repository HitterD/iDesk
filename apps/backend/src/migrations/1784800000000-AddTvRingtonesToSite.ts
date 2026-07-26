import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvRingtonesToSite1784800000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneNewTicket" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneInProgress" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneClosing" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "closingTime" varchar(5)`);
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "closingTime"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneClosing"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneInProgress"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneNewTicket"`);
    }
}
