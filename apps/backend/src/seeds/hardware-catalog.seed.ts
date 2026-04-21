import { DataSource } from 'typeorm';
import { HardwareCatalog } from '../modules/hardware-request/domain/entities/hardware-catalog.entity';
import { ItemCategory } from '../modules/hardware-request/domain/enums/item-category.enum';

export async function seedHardwareCatalog(ds: DataSource): Promise<void> {
    const repo = ds.getRepository(HardwareCatalog);

    const initial: Array<Partial<HardwareCatalog>> = [
        { code: 'LAPTOP_STD', name: 'Laptop Standard',
          category: ItemCategory.LAPTOP,
          defaultSpecs: { cpu: 'i5', ram: '16GB', storage: '512GB SSD' },
          requiredFields: [
              { key: 'preferredBrand', label: 'Preferred Brand', type: 'text', required: false },
          ],
          displayOrder: 10 },
        { code: 'LAPTOP_DESIGN', name: 'Laptop Design',
          category: ItemCategory.LAPTOP,
          defaultSpecs: { cpu: 'i7', ram: '32GB', storage: '1TB SSD', gpu: 'dedicated' },
          displayOrder: 20 },
        { code: 'MONITOR_24', name: 'Monitor 24 inch',
          category: ItemCategory.MONITOR,
          defaultSpecs: { resolution: '1920x1080', panel: 'IPS' },
          displayOrder: 30 },
        { code: 'MONITOR_27', name: 'Monitor 27 inch',
          category: ItemCategory.MONITOR,
          defaultSpecs: { resolution: '2560x1440', panel: 'IPS' },
          displayOrder: 40 },
        { code: 'MOUSE_STD', name: 'Mouse Standard',
          category: ItemCategory.ACCESSORY, displayOrder: 50 },
        { code: 'KEYBOARD_STD', name: 'Keyboard Standard',
          category: ItemCategory.ACCESSORY, displayOrder: 60 },
        { code: 'HEADSET_STD', name: 'Headset',
          category: ItemCategory.ACCESSORY, displayOrder: 70 },
        { code: 'CABLE_LAN', name: 'Network Cable (LAN)',
          category: ItemCategory.NETWORK, displayOrder: 80 },
        { code: 'AP_STD', name: 'Access Point',
          category: ItemCategory.NETWORK, displayOrder: 90 },
        { code: 'LICENSE_GENERIC', name: 'Software License (Generic)',
          category: ItemCategory.SOFTWARE,
          requiredFields: [
              { key: 'softwareName', label: 'Software Name', type: 'text', required: true },
              { key: 'seats', label: 'Seats', type: 'number', required: true },
          ],
          displayOrder: 100 },
    ];

    for (const data of initial) {
        const existing = await repo.findOne({ where: { code: data.code! } });
        if (existing) continue;
        await repo.save(repo.create(data));
    }
    console.log(`[seed] hardware_catalog ready (${initial.length} items)`);
}
