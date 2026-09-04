import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArticleViewUserColumns1787112000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        // Ensure article_views table exists
        await qr.query(`
            CREATE TABLE IF NOT EXISTS "article_views" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "articleId" uuid NOT NULL,
                "userId" uuid,
                "userName" character varying,
                "userAvatar" character varying,
                "userRole" character varying,
                "count" integer NOT NULL DEFAULT 1,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lastViewedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_article_views_id" PRIMARY KEY ("id")
            )
        `);

        // Add columns if table already existed without them
        await qr.query(`
            ALTER TABLE "article_views" 
            ADD COLUMN IF NOT EXISTS "userId" uuid,
            ADD COLUMN IF NOT EXISTS "userName" character varying,
            ADD COLUMN IF NOT EXISTS "userAvatar" character varying,
            ADD COLUMN IF NOT EXISTS "userRole" character varying,
            ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now();
        `);

        // Add foreign key to users table if not exists
        await qr.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_article_views_userId'
                ) THEN
                    ALTER TABLE "article_views" 
                    ADD CONSTRAINT "FK_article_views_userId" 
                    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);

        // Add index on articleId and userId
        await qr.query(`
            CREATE INDEX IF NOT EXISTS "IDX_article_views_article_user" 
            ON "article_views" ("articleId", "userId");
        `);
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(`DROP INDEX IF EXISTS "IDX_article_views_article_user"`);
        await qr.query(`ALTER TABLE "article_views" DROP CONSTRAINT IF EXISTS "FK_article_views_userId"`);
        await qr.query(`
            ALTER TABLE "article_views" 
            DROP COLUMN IF EXISTS "userId",
            DROP COLUMN IF EXISTS "userName",
            DROP COLUMN IF EXISTS "userAvatar",
            DROP COLUMN IF EXISTS "userRole",
            DROP COLUMN IF EXISTS "createdAt";
        `);
    }
}
