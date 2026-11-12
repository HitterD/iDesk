import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive: previous (normalised) names of an HC PIC master, kept on rename so template imports still link. */
export class CsiPicAliases1794240000001 implements MigrationInterface {
    name = 'CsiPicAliases1794240000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_pics" ADD COLUMN IF NOT EXISTS "aliases" varchar(150)[] NOT NULL DEFAULT ARRAY[]::varchar[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "aliases"`);
    }
}
