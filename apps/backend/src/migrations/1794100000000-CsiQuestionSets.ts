import { MigrationInterface, QueryRunner } from 'typeorm';

/** CSI: reusable question sets per scope for the "Orang yang dinilai" step. */
export class CsiQuestionSets1794100000000 implements MigrationInterface {
    name = 'CsiQuestionSets1794100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_question_sets" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "scope" varchar(10) NOT NULL,
            "name" varchar(100) NOT NULL,
            "dimensionIds" jsonb NOT NULL DEFAULT '[]',
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_csi_question_sets_scope_name" UNIQUE ("scope", "name")
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_question_sets"`);
    }
}
