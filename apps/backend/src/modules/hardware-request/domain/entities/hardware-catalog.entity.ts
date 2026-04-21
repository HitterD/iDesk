// apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { ItemCategory } from '../enums/item-category.enum';

@Entity('hardware_catalog')
@Index(['active', 'displayOrder'])
export class HardwareCatalog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 80, unique: true })
    code: string;

    @Column({ type: 'varchar', length: 160 })
    name: string;

    @Column({ type: 'enum', enum: ItemCategory })
    category: ItemCategory;

    @Column({ type: 'jsonb', default: () => "'{}'" })
    defaultSpecs: Record<string, unknown>;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    requiredFields: Array<{
        key: string;
        label: string;
        type: 'text' | 'number' | 'select';
        options?: string[];
        required?: boolean;
    }>;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'int', default: 0 })
    displayOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
