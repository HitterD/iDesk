import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { HardwareRequestItem } from '../src/modules/hardware-request/domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../src/modules/hardware-request/domain/entities/hardware-request.entity';
import { HardwareCatalog } from '../src/modules/hardware-request/domain/entities/hardware-catalog.entity';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [HardwareRequestItem, HardwareRequest, HardwareCatalog],
});

async function run() {
    await ds.initialize();
    const repo = ds.getRepository(HardwareRequestItem);
    const items = await repo.find();
    let splitCount = 0;
    
    for (const item of items) {
        if (item.quantity > 1) {
            console.log(`Splitting item ${item.id} with quantity ${item.quantity} for request ${item.requestId}`);
            const qty = item.quantity;
            item.quantity = 1;
            await repo.save(item);

            const newItems = [];
            for (let i = 1; i < qty; i++) {
                const newItem = repo.create({
                    requestId: item.requestId,
                    catalogId: item.catalogId,
                    categorySnapshot: item.categorySnapshot,
                    quantity: 1,
                    actualCost: item.actualCost,
                    vendor: item.vendor,
                    invoiceNumber: item.invoiceNumber,
                    invoiceDate: item.invoiceDate,
                    notes: item.notes,
                    deliveryStatus: item.deliveryStatus,
                    arrivedAt: item.arrivedAt,
                    procurementDecision: item.procurementDecision,
                    procurementDecidedAt: item.procurementDecidedAt,
                    procurementDecidedBy: item.procurementDecidedBy,
                });
                newItems.push(newItem);
            }
            await repo.save(newItems);
            splitCount++;
        }
    }
    console.log(`Done. Split ${splitCount} items.`);
    process.exit(0);
}

run().catch(console.error);