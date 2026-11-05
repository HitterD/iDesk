import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a ticket was reported from (agents only): the requester's IP and computer name at creation,
 * plus the desktop app heartbeats that name the computer (user_devices).
 */
export class AddRequesterDevice1794160000000 implements MigrationInterface {
    name = 'AddRequesterDevice1794160000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets"
            ADD COLUMN IF NOT EXISTS "requesterIp" varchar(45) NULL,
            ADD COLUMN IF NOT EXISTS "requesterHostname" varchar(253) NULL,
            ADD COLUMN IF NOT EXISTS "requesterHostnameSource" varchar(10) NULL`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_devices" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "hostname" varchar(253) NOT NULL,
            "lanIp" varchar(45) NULL,
            "windowsUser" varchar(100) NULL,
            "osVersion" varchar(100) NULL,
            "appVersion" varchar(30) NULL,
            "lastSeenAt" timestamp NOT NULL DEFAULT now(),
            "createdAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_user_devices_user_hostname" UNIQUE ("userId", "hostname")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_devices_user_seen" ON "user_devices" ("userId", "lastSeenAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "user_devices"`);
        await queryRunner.query(`ALTER TABLE "tickets"
            DROP COLUMN IF EXISTS "requesterHostnameSource",
            DROP COLUMN IF EXISTS "requesterHostname",
            DROP COLUMN IF EXISTS "requesterIp"`);
    }
}
