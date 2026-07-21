import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class AddMustChangePassword1784600000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`,
        );

        // Tandai user password lokal yang belum pernah login.
        await qr.query(
            `UPDATE "users"
             SET "mustChangePassword" = true
             WHERE "password" IS NOT NULL AND "lastActiveAt" IS NULL`,
        );

        // Tandai juga password lokal legacy "123456". bcrypt tidak dapat
        // dibandingkan melalui SQL, jadi compare per baris lalu update batch.
        const users: Array<{ id: string; password: string | null }> = await qr.query(
            `SELECT "id", "password" FROM "users" WHERE "password" IS NOT NULL`,
        );
        const legacyPasswordIds: string[] = [];
        for (const u of users) {
            if (u.password && (await bcrypt.compare('123456', u.password))) {
                legacyPasswordIds.push(u.id);
            }
        }

        if (legacyPasswordIds.length > 0) {
            await qr.query(
                `UPDATE "users" SET "mustChangePassword" = true WHERE "id" = ANY($1)`,
                [legacyPasswordIds],
            );
        }
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "users" DROP COLUMN IF EXISTS "mustChangePassword"`,
        );
    }
}
