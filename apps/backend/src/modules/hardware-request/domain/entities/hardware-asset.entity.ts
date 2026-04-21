import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { HardwareRequestItem } from './hardware-request-item.entity';
import { User } from '../../../users/entities/user.entity';
import { Site } from '../../../sites/entities/site.entity';

@Entity('hardware_assets')
@Index(['assignedToUserId'])
export class HardwareAsset {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) itemId: string;
    @ManyToOne(() => HardwareRequestItem, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'itemId' }) item: HardwareRequestItem;

    @Column({ type: 'varchar', length: 128, unique: true }) barcode: string;

    @Column({ type: 'uuid' }) assignedToUserId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'assignedToUserId' }) assignedTo: User;

    @Column({ type: 'uuid' }) siteId: string;
    @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'siteId' }) site: Site;

    @Column({ type: 'timestamptz' }) installedAt: Date;
    @Column({ type: 'uuid' }) installedBy: string;

    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
