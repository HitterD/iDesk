import { MigrationInterface, QueryRunner } from 'typeorm';

/** Chat replies are emailed only when they stay unread; this records that the follow-up email went out. */
export class NotificationEmailedAt1794320000000 implements MigrationInterface {
    name = 'NotificationEmailedAt1794320000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "emailedAt" TIMESTAMP NULL`);
        // The digest scans unread chat notifications by age.
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_notifications_unread_reply" ON "notifications" ("createdAt") WHERE "isRead" = false AND "type" = 'TICKET_REPLY'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_unread_reply"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "emailedAt"`);
    }
}
