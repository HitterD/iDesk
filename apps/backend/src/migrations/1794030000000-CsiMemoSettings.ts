import { MigrationInterface, QueryRunner } from 'typeorm';

/** CSI revision 2: remembered Interoffice Memo header per service scope. */
export class CsiMemoSettings1794030000000 implements MigrationInterface {
    name = 'CsiMemoSettings1794030000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_memo_settings" (
            "scope" varchar(10) NOT NULL,
            "data" jsonb NOT NULL,
            "updatedAt" timestamp NOT NULL DEFAULT now(),
            PRIMARY KEY ("scope")
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_memo_settings"`);
    }
}
