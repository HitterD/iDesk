import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSlaEnhancementFields1732934400000 implements MigrationInterface {
    name = 'AddSlaEnhancementFields1732934400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add slaStartedAt - When SLA timer actually starts (status -> IN_PROGRESS)
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'slaStartedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add firstResponseAt - When agent first responded
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'firstResponseAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add firstResponseTarget - Target time for first response
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'firstResponseTarget',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add isFirstResponseBreached - Flag if first response SLA was breached
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'isFirstResponseBreached',
            type: 'boolean',
            default: false,
        }));

        // Add resolvedAt - When ticket was resolved
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add waitingVendorAt - When ticket entered waiting vendor status
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'waitingVendorAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // Add totalWaitingVendorMinutes - Total time spent waiting for vendor
        await queryRunner.addColumn('tickets', new TableColumn({
            name: 'totalWaitingVendorMinutes',
            type: 'int',
            default: 0,
        }));

        // Add indexes for SLA queries
        await queryRunner.query(`CREATE INDEX "IDX_tickets_slaStartedAt" ON "tickets" ("slaStartedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_firstResponseTarget" ON "tickets" ("firstResponseTarget")`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_isFirstResponseBreached" ON "tickets" ("isFirstResponseBreached")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_isFirstResponseBreached"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_firstResponseTarget"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_slaStartedAt"`);

        // Drop columns
        await queryRunner.dropColumn('tickets', 'totalWaitingVendorMinutes');
        await queryRunner.dropColumn('tickets', 'waitingVendorAt');
        await queryRunner.dropColumn('tickets', 'resolvedAt');
        await queryRunner.dropColumn('tickets', 'isFirstResponseBreached');
        await queryRunner.dropColumn('tickets', 'firstResponseTarget');
        await queryRunner.dropColumn('tickets', 'firstResponseAt');
        await queryRunner.dropColumn('tickets', 'slaStartedAt');
    }
}
