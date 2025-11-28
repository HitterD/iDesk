import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ContractStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    EXPIRING_SOON = 'EXPIRING_SOON',
    EXPIRED = 'EXPIRED',
}

@Entity('renewal_contracts')
export class RenewalContract {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // === METADATA (Extracted or Manual) ===
    @Column({ nullable: true })
    poNumber: string;

    @Column({ nullable: true })
    vendorName: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    contractValue: number;

    // === CRITICAL DATES ===
    @Column({ type: 'date', nullable: true })
    startDate: Date;

    @Index('idx_renewal_end_date')
    @Column({ type: 'date', nullable: true })
    endDate: Date;

    // === FILE STORAGE ===
    @Column()
    originalFileName: string;

    @Column()
    filePath: string;

    @Column({ nullable: true })
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
    acknowledgedAt: Date;

    @Column({ nullable: true })
    acknowledgedById: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'acknowledgedById' })
    acknowledgedBy: User;

    // === AUDIT ===
    @Column()
    uploadedById: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'uploadedById' })
    uploadedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // === EXTRACTION METADATA ===
    @Column({ nullable: true })
    extractionStrategy: string;

    @Column({ type: 'float', nullable: true })
    extractionConfidence: number;

    @Column({ type: 'jsonb', nullable: true })
    rawExtractedData: Record<string, any>;
}
