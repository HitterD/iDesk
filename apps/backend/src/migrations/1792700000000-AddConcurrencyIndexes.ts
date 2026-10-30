import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the hottest read paths under concurrent load:
 * - e-form pending approvals (polled by every sidebar) and "my requests"
 * - site-scoped ticket lists (ordered by createdAt) and status counts / TV board
 * - the participant EXISTS check in a normal user's ticket list
 */
const INDEXES: ReadonlyArray<{ name: string; table: string; columns: string }> = [
    { name: 'idx_eform_requests_approver_status', table: 'eform_requests', columns: '"currentApproverId", "status"' },
    { name: 'idx_eform_requests_requester_created', table: 'eform_requests', columns: '"requesterId", "createdAt"' },
    { name: 'idx_tickets_site_created', table: 'tickets', columns: '"siteId", "createdAt"' },
    { name: 'idx_tickets_site_status', table: 'tickets', columns: '"siteId", "status"' },
    { name: 'idx_ticket_participants_user_ticket', table: 'ticket_participants', columns: '"userId", "ticketId"' },
];

export class AddConcurrencyIndexes1792700000000 implements MigrationInterface {
    name = 'AddConcurrencyIndexes1792700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { name, table, columns } of INDEXES) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { name } of INDEXES) {
            await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
        }
    }
}
