import { MigrationInterface, QueryRunner } from 'typeorm';

/** Staff presets that gave either old page now give the one "Perangkat & Akses" page. */
export const MIGRATE_PRESETS_SQL = `
    UPDATE "permission_presets"
    SET "pageAccess" = ("pageAccess" - 'hardware_requests' - 'eform_access') || '{"devices_access": true}'::jsonb
    WHERE "targetRole" <> 'USER'
      AND "pageAccess" ?| ARRAY['hardware_requests', 'eform_access']
      AND (("pageAccess"->>'hardware_requests') = 'true' OR ("pageAccess"->>'eform_access') = 'true')
`;

/** Everything still holding the old keys (requester presets, staff presets that had both off) just loses them. */
export const STRIP_USER_PRESETS_SQL = `
    UPDATE "permission_presets"
    SET "pageAccess" = "pageAccess" - 'hardware_requests' - 'eform_access'
    WHERE "pageAccess" ?| ARRAY['hardware_requests', 'eform_access']
`;

/**
 * Hardware Requests and E-Form Access were menu pages; the requests are tickets now. IT keeps one page for the install
 * schedule, access validity and the catalog (`devices_access`); requesters have no such page, their requests live in
 * My Tickets. Data only: no enum or table is changed, so it is safe inside the shared migration transaction.
 */
export class DevicesAccessPageKey1794850000000 implements MigrationInterface {
    name = 'DevicesAccessPageKey1794850000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(MIGRATE_PRESETS_SQL);
        await queryRunner.query(STRIP_USER_PRESETS_SQL);
    }

    public async down(): Promise<void> {
        // Not reversible: which of the two old pages a preset had is no longer known.
    }
}
