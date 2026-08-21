import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ticket deletion is ADMIN-only. The MANAGER preset advertised a delete right
 * that no endpoint ever enforced; now that a real delete endpoint exists, the
 * stale grant must go.
 *
 * A code change to the preset literal is not enough: seedDefaultPresets only
 * fills keys that are still undefined, so an already-stored key is never
 * revisited. This rewrites the stored row.
 */
export class RevokeManagerTicketDelete1787366401000 implements MigrationInterface {
    name = 'RevokeManagerTicketDelete1787366401000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Argumen keempat jsonb_set = false: jangan pernah menciptakan key pada
        // instalasi yang belum punya. Digabung dengan WHERE ... ? 'ticketing.delete',
        // migration ini hanya bisa mencabut hak, tidak pernah memberi.
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "permissions" = jsonb_set(
                "permissions",
                '{ticketing.delete,canDelete}',
                'false'::jsonb,
                false
            )
            WHERE "targetRole" = 'MANAGER'
              AND "permissions" ? 'ticketing.delete'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "permissions" = jsonb_set(
                "permissions",
                '{ticketing.delete,canDelete}',
                'true'::jsonb,
                false
            )
            WHERE "targetRole" = 'MANAGER'
              AND "permissions" ? 'ticketing.delete'
        `);
    }
}
