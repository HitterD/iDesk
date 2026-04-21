import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropIctBudget1776000300500 implements MigrationInterface {
    name = 'DropIctBudget1776000300500';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS ict_budget_items CASCADE`);
        await q.query(`DROP TABLE IF EXISTS ict_budgets CASCADE`);
    }

    async down(_q: QueryRunner): Promise<void> {
        // manual restore from backup
    }
}
