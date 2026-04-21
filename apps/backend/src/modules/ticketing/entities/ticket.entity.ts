import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
    VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from './ticket-message.entity';
import { Site } from '../../sites/entities/site.entity';

export enum TicketStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_VENDOR = 'WAITING_VENDOR',
    RESOLVED = 'RESOLVED',
    CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
}

export enum TicketSource {
    TELEGRAM = 'TELEGRAM',
    WEB = 'WEB',
    EMAIL = 'EMAIL',
}

export enum TicketType {
    SERVICE = 'SERVICE',
    ICT_BUDGET = 'ICT_BUDGET',
    LOST_ITEM = 'LOST_ITEM',
    ACCESS_REQUEST = 'ACCESS_REQUEST',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
    ORACLE_REQUEST = 'ORACLE_REQUEST',
}

@Entity('tickets')
@Index(['status', 'priority']) // Composite index for filtering
@Index(['createdAt']) // Index for date-based queries
@Index(['userId']) // Index for user's tickets lookup
@Index(['assignedToId']) // Index for agent's assigned tickets
@Index(['status', 'slaTarget']) // Index for SLA breach queries
@Index(['priority']) // Index for priority filtering
@Index(['category']) // Index for category filtering
@Index(['siteId']) // Index for multi-site filtering
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true, nullable: true })
    ticketNumber: string;

    @Column()
    title: string;

    @Column('text')
    description: string;

    @Column({ default: 'GENERAL' })
    category: string;

    @Column({ type: 'varchar', nullable: true })
    device: string;

    @Column({ type: 'varchar', nullable: true })
    software: string;

    @Column({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.TODO,
    })
    status: TicketStatus;

    @Column({
        type: 'enum',
        enum: TicketPriority,
        default: TicketPriority.MEDIUM,
    })
    priority: TicketPriority;

    @Column({
        type: 'enum',
        enum: TicketSource,
        default: TicketSource.WEB,
    })
    source: TicketSource;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User;

    // Multi-site support
    @Column({ type: 'varchar', nullable: true })
    siteId: string;

    @ManyToOne(() => Site, { nullable: true })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    // Ticket type for different ticket categories
    @Column({
        type: 'enum',
        enum: TicketType,
        default: TicketType.SERVICE,
    })
    ticketType: TicketType;

    // Required reason for CRITICAL priority
    @Column({ nullable: true, type: 'text' })
    criticalReason: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string;

    @OneToMany(() => TicketMessage, (message) => message.ticket)
    messages: TicketMessage[];

    @Column({ default: false })
    isOverdue: boolean;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assignedToId' })
    assignedTo: User | null;

    @Column({ type: 'varchar', nullable: true })
    assignedToId: string | null;

    @Column({ type: 'int', default: 0 })
    totalPausedMinutes: number;

    @Column({ type: 'timestamp', nullable: true })
    lastPausedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    slaTarget: Date | null;

    // === SLA Enhancement Fields ===

    @Column({ type: 'timestamp', nullable: true })
    slaStartedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    firstResponseAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    firstResponseTarget: Date | null;

    @Column({ default: false })
    isFirstResponseBreached: boolean;

    @Column({ type: 'timestamp', nullable: true })
    resolvedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    waitingVendorAt: Date | null;

    @Column({ type: 'int', default: 0 })
    totalWaitingVendorMinutes: number;

    @Column({ default: false })
    slaWarningSent: boolean;

    @Column({ type: 'timestamp', nullable: true })
    autoReassignedAt: Date;

    // === Hardware Installation Fields ===

    @Column({ default: false })
    isHardwareInstallation: boolean;

    @Column({ type: 'timestamp', nullable: true })
    scheduledDate: Date | null;

    @Column({ type: 'varchar', nullable: true })
    scheduledTime: string | null;  // e.g., "08:00", "09:00", etc.

    @Column({ type: 'varchar', nullable: true })
    hardwareType: string | null;  // PC, IP_PHONE, PRINTER, or custom

    @Column({ default: false })
    reminderD1Sent: boolean;

    @Column({ default: false })
    reminderD0Sent: boolean;

    @Column({ default: false })
    userAcknowledged: boolean;

    // === Optimistic Locking ===
    // Note: Default 1 is required for existing data when column is first added
    @VersionColumn({ default: 1 })
    version: number;
}

