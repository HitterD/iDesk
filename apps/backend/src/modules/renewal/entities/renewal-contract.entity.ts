import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
    DeleteDateColumn
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ContractStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    EXPIRING_SOON = 'EXPIRING_SOON',
    EXPIRED = 'EXPIRED',
}

export enum ContractCategory {
    SOFTWARE = 'SOFTWARE',
    HARDWARE = 'HARDWARE',
    SERVICE = 'SERVICE',
    SUBSCRIPTION = 'SUBSCRIPTION',
    MAINTENANCE = 'MAINTENANCE',
    OTHER = 'OTHER',
}

@Entity('renewal_contracts')
@Index('idx_renewal_status_enddate', ['status', 'endDate'])
export class RenewalContract {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // === METADATA (Extracted or Manual) ===
    @Column({ type: 'varchar', nullable: true })
    poNumber: string;

    @Column({ type: 'varchar', nullable: true })
    vendorName: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: ContractCategory,
        nullable: true,
    })
    category: ContractCategory;

    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    contractValue: number;

    // === CRITICAL DATES ===
    @Column({ type: 'date', nullable: true })
    startDate: Date | null;

    @Index('idx_renewal_end_date')
    @Column({ type: 'date', nullable: true })
    endDate: Date | null;

    // === FILE STORAGE ===
    @Column()
    originalFileName: string;

    @Column()
    filePath: string;

    @Column({ type: 'int', nullable: true })
    fileSize: number;

    // === STATUS ===
    @Column({
        type: 'enum',
        enum: ContractStatus,
        default: ContractStatus.DRAFT,
    })
    status: ContractStatus;

    // === REMINDER TRACKING ===
    @Column({ default: false })
    reminderD60Sent: boolean; // 2-month early warning

    @Column({ default: false })
    reminderD30Sent: boolean;

    @Column({ default: false })
    reminderD7Sent: boolean;

    @Column({ default: false })
    reminderD1Sent: boolean;

    // === ACKNOWLEDGE FEATURE ===
    @Column({ default: false })
    isAcknowledged: boolean;

    @Column({ type: 'timestamp', nullable: true })
    acknowledgedAt: Date | null;

    @Column({ type: 'varchar', nullable: true })
    acknowledgedById: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'acknowledgedById' })
    acknowledgedBy: User;

    // === AUDIT ===
    @Column({ type: 'varchar', nullable: true })
    uploadedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'uploadedById' })
    uploadedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

    // === EXTRACTION METADATA ===
    @Column({ type: 'varchar', nullable: true })
    extractionStrategy: string;

    @Column({ type: 'float', nullable: true })
    extractionConfidence: number;

    @Column({ type: 'jsonb', nullable: true })
    rawExtractedData: Record<string, any>;

    // === RENEWAL WORKFLOW ===
    @Column({ default: false })
    isRenewed: boolean;

    @Column({ type: 'uuid', nullable: true })
    renewedContractId: string; // Points to the NEW contract

    @Column({ type: 'uuid', nullable: true })
    previousContractId: string; // Points to the OLD contract
}
