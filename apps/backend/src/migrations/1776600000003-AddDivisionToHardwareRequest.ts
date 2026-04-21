import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDivisionToHardwareRequest1776600000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'hardware_requests',
            new TableColumn({
                name: 'division',
                type: 'varchar',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('hardware_requests', 'division');
    }
}
