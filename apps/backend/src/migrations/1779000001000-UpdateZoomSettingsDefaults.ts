import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateZoomSettingsDefaults1779000001000
    implements MigrationInterface
{
    name = 'UpdateZoomSettingsDefaults1779000001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Only update rows that still have OLD defaults — never override admin customizations.
        await queryRunner.query(`
            UPDATE zoom_settings
            SET
                "maxBookingPerUserPerDay" = 50,
                "workingDays" = '[0,1,2,3,4,5,6]'::jsonb,
                "slotStartTime" = '00:00',
                "slotEndTime" = '23:59',
                "updatedAt" = NOW()
            WHERE
                "maxBookingPerUserPerDay" = 5
                OR "workingDays" = '[1,2,3,4,5]'::jsonb
                OR "slotStartTime" = '08:00'
                OR "slotEndTime" = '18:00'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert only rows that now have new defaults.
        await queryRunner.query(`
            UPDATE zoom_settings
            SET
                "maxBookingPerUserPerDay" = 5,
                "workingDays" = '[1,2,3,4,5]'::jsonb,
                "slotStartTime" = '08:00',
                "slotEndTime" = '18:00',
                "updatedAt" = NOW()
            WHERE
                "maxBookingPerUserPerDay" = 50
                AND "workingDays" = '[0,1,2,3,4,5,6]'::jsonb
                AND "slotStartTime" = '00:00'
                AND "slotEndTime" = '23:59'
        `);
    }
}
