// apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { HardwareCatalog } from './hardware-catalog.entity';

@Entity('hardware_request_items')
@Index(['requestId'])
export class HardwareRequestItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    requestId: string;

    @ManyToOne(() => HardwareRequest, (req) => req.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' })
    request: HardwareRequest;

    @Column({ type: 'uuid', nullable: true })
    catalogId: string | null;

    @ManyToOne(() => HardwareCatalog, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'catalogId' })
    catalog: HardwareCatalog | null;

    @Column({ type: 'jsonb' })
    categorySnapshot: {
        code: string;
        name: string;
        category: string;
        specs: Record<string, unknown>;
        customFields: Record<string, unknown>;
    };

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
    actualCost: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    vendor: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    invoiceNumber: string | null;

    @Column({ type: 'date', nullable: true })
    invoiceDate: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'PENDING',
    })
    deliveryStatus: 'PENDING' | 'ARRIVED' | 'NOT_PROCURED';

    @Column({ type: 'timestamptz', nullable: true })
    arrivedAt: Date | null;

    @Column({
        type: 'varchar',
        length: 20,
        nullable: true,
    })
    procurementDecision: 'APPROVED' | 'REJECTED' | null;

    @Column({ type: 'timestamptz', nullable: true })
    procurementDecidedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    procurementDecidedBy: string | null;
}
