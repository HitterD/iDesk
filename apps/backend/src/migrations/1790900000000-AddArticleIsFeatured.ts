import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the "start here" flag used by the KB landing page hero card.
 *
 * A partial unique index enforces the product rule at the database level:
 * at most one article may be featured at any time. Promoting a new article
 * therefore has to clear the previous one (see KnowledgeBaseService.setFeatured),
 * and no concurrent request can slip a second featured article past the check.
 */
export class AddArticleIsFeatured1790900000000 implements MigrationInterface {
    name = 'AddArticleIsFeatured1790900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "articles"
            ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false
        `);

        // Only one featured article, ever. Partial index so the millions of
        // false rows cost nothing.
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_articles_single_featured"
            ON "articles" (("isFeatured"))
            WHERE "isFeatured" = true AND "deletedAt" IS NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_articles_isFeatured"
            ON "articles" ("isFeatured")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_articles_isFeatured"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_articles_single_featured"`);
        await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN IF EXISTS "isFeatured"`);
    }
}
