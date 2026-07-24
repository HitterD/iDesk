import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvTokenToSite1784700000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "tvToken" varchar UNIQUE`,
        );
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "sites" DROP COLUMN IF EXISTS "tvToken"`,
        );
    }
}
