import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedHardwareCatalog1776000302000 implements MigrationInterface {
    name = 'SeedHardwareCatalog1776000302000';

    async up(q: QueryRunner): Promise<void> {
        const items: [string, string, string][] = [
            ['LAPTOP_STD', 'Laptop Standard', 'LAPTOP'],
            ['LAPTOP_DESIGN', 'Laptop Design/Heavy', 'LAPTOP'],
            ['MONITOR_24', 'Monitor 24"', 'MONITOR'],
            ['MONITOR_27', 'Monitor 27"', 'MONITOR'],
            ['MOUSE_STD', 'Mouse', 'ACCESSORY'],
            ['KEYBOARD_STD', 'Keyboard', 'ACCESSORY'],
            ['HEADSET_STD', 'Headset', 'ACCESSORY'],
            ['NET_CABLE', 'Network Cable', 'NETWORK'],
            ['NET_AP', 'Access Point', 'NETWORK'],
            ['SW_LICENSE_GEN', 'Software License (Generic)', 'SOFTWARE'],
        ];

        const hcCols = await q.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='hardware_catalog'`
        );
        const hcNames = hcCols.map((r: any) => r.column_name);
        const dOrderCol = hcNames.includes('display_order') ? 'display_order' : '"displayOrder"';
        const createdCol = hcNames.includes('created_at') ? 'created_at' : '"createdAt"';
        const updatedCol = hcNames.includes('updated_at') ? 'updated_at' : '"updatedAt"';

        let order = 10;
        for (const [code, name, category] of items) {
            await q.query(
                `INSERT INTO hardware_catalog (code, name, category, ${dOrderCol}, active, ${createdCol}, ${updatedCol})
                 VALUES ($1, $2, $3::hardware_catalog_category_enum, $4, TRUE, NOW(), NOW())
                 ON CONFLICT (code) DO NOTHING`,
                [code, name, category, order],
            );
            order += 10;
        }
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`
            DELETE FROM hardware_catalog WHERE code IN (
                'LAPTOP_STD', 'LAPTOP_DESIGN', 'MONITOR_24', 'MONITOR_27',
                'MOUSE_STD', 'KEYBOARD_STD', 'HEADSET_STD',
                'NET_CABLE', 'NET_AP', 'SW_LICENSE_GEN'
            )
        `);
    }
}
