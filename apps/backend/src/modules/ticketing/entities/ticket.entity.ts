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
    DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketParticipant } from './ticket-participant.entity';
import { SlaAdjustment } from './sla-adjustment.entity';
import { Site } from '../../sites/entities/site.entity';

export enum TicketStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_VENDOR = 'WAITING_VENDOR',
    RESOLVED = 'RESOLVED',
    CANCELLED = 'CANCELLED',
    // Final: set only by the requester's confirmation, self-resolve, or the auto-close
    // cron once the post-resolve confirmation window expires. Locked for everyone.
    CLOSED = 'CLOSED',
}

/** Statuses that count as "done" for stats: agent-resolved (awaiting confirmation) or closed. */
export const TICKET_DONE_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
/** Statuses where no more work happens on the ticket. */
export const TICKET_INACTIVE_STATUSES: TicketStatus[] = [...TICKET_DONE_STATUSES, TicketStatus.CANCELLED];
/** Statuses where the ticket still needs work, including a paused vendor wait. */
export const TICKET_ACTIVE_STATUSES: TicketStatus[] = [TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_VENDOR];

export enum TicketPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
}

export enum TicketSource {
    /** Legacy: tickets created by the retired Telegram bot. */
    TELEGRAM = 'TELEGRAM',
    WEB = 'WEB',
    EMAIL = 'EMAIL',
    /** Filed by the iPop app through the integration API. */
    IPOP = 'IPOP',
    /** Filed by another connected app (Settings > Integrasi aplikasi); the app is in externalSource. */
    API = 'API',
}

export enum TicketType {
    SERVICE = 'SERVICE',
    ICT_BUDGET = 'ICT_BUDGET',
    LOST_ITEM = 'LOST_ITEM',
    ACCESS_REQUEST = 'ACCESS_REQUEST',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
    ORACLE_REQUEST = 'ORACLE_REQUEST',
    WEB_DEV_REQUEST = 'WEB_DEV_REQUEST',
    MOBILE_DEV_REQUEST = 'MOBILE_DEV_REQUEST',
}

/**
 * Which team owns the ticket for access purposes. Replaces the old
 * category/ticketType sniffing for the Oracle split:
 * OPS_SUPPORT - general ICT/ops support (agents)
 * ORACLE_DEV  - Oracle/K2 application tickets (AGENT_ORACLE)
 */
export enum HandlingTeam {
    OPS_SUPPORT = 'OPS_SUPPORT',
    ORACLE_DEV = 'ORACLE_DEV',
    MOBILE_DEV = 'MOBILE_DEV',
    WEB_DEV = 'WEB_DEV',
}

/** Longest vendor note a PIC can save (column length and DTO limit). */
export const VENDOR_NOTE_MAX_LENGTH = 300;

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

    /** External system that filed the ticket (e.g. 'IPOP'); with externalRef it makes creation idempotent. */
    @Column({ type: 'varchar', length: 20, nullable: true })
    externalSource: string | null;

    /** The caller's own id for this ticket (unique per externalSource). */
    @Column({ type: 'varchar', length: 100, nullable: true })
    externalRef: string | null;

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

    @Column({
        type: 'enum',
        enum: HandlingTeam,
        default: HandlingTeam.OPS_SUPPORT,
    })
    handlingTeam: HandlingTeam;

    // Required reason for CRITICAL priority
    @Column({ nullable: true, type: 'text' })
    criticalReason: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string;

    @OneToMany(() => TicketMessage, (message) => message.ticket)
    messages: TicketMessage[];

    @OneToMany(() => TicketParticipant, (participant) => participant.ticket)
    participants: TicketParticipant[];

    @OneToMany(() => SlaAdjustment, (adjustment) => adjustment.ticket)
    slaAdjustments: SlaAdjustment[];

    @Column({ default: false })
    isOverdue: boolean;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assignedToId' })
    assignedTo: User | null;

    @Column({ type: 'varchar', nullable: true })
    assignedToId: string | null;

    /** Who filed the ticket when it differs from the requester (an agent filing on someone's behalf). */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'createdById' })
    createdBy: User | null;

    @Column({ type: 'varchar', nullable: true })
    createdById: string | null;

    @Column({ type: 'int', default: 0 })
    totalPausedMinutes: number;

    @Column({ type: 'timestamp', nullable: true })
    lastPausedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    slaTarget: Date | null;

    // === SLA Enhancement Fields ===

    /**
     * Anchor for SLA-extend accounting: the target as first set when the
     * SLA clock started. Extends sum against this, never against a target
     * that was already shifted by a previous extend. Null until first set.
     */
    @Column({ type: 'timestamp', nullable: true })
    originalSlaTarget: Date | null;

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

    /** Requester must confirm or dispute before this; the auto-close cron closes it afterwards. */
    @Column({ type: 'timestamp', nullable: true })
    resolutionDeadlineAt: Date | null;

    /** Set when the requester disputes a resolution; cleared on the next resolve. Drives the agent's action item. */
    @Column({ type: 'timestamp', nullable: true })
    disputedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    closedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    waitingVendorAt: Date | null;

    /** Agreed vendor visit / response time while WAITING_VENDOR; null otherwise. */
    @Column({ type: 'timestamp', nullable: true })
    vendorVisitAt: Date | null;

    /** Why the ticket waits on the vendor (template or typed by the PIC); null when not WAITING_VENDOR. */
    @Column({ type: 'varchar', length: VENDOR_NOTE_MAX_LENGTH, nullable: true })
    vendorNote: string | null;

    /** Pending ticket reminder that warns the PIC before vendorVisitAt; cancelled on reschedule or status change. */
    @Column({ type: 'uuid', nullable: true })
    vendorVisitReminderId: string | null;

    /** Resolution SLA minutes left when the clock was paused (waiting vendor or resolved); null while running. */
    @Column({ type: 'int', nullable: true })
    slaRemainingMinutes: number | null;

    /** First-response SLA minutes left when the clock was paused; null while running. */
    @Column({ type: 'int', nullable: true })
    firstResponseRemainingMinutes: number | null;

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

    // === Unread Chat Tracking Fields ===

    @Column({ type: 'timestamp', nullable: true })
    lastMessageAt: Date | null;

    @Column({ type: 'varchar', nullable: true })
    lastMessageSenderRole: string | null; // 'USER' | 'AGENT' | 'ADMIN'

    @Column({ type: 'timestamp', nullable: true })
    userLastReadAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    agentLastReadAt: Date | null;

    // === Optimistic Locking ===
    // Note: Default 1 is required for existing data when column is first added
    @VersionColumn({ default: 1 })
    version: number;

    /**
     * Soft delete marker. Set by TicketUpdateService.bulkSoftDelete (ADMIN only).
     * TypeORM adds "deletedAt IS NULL" to every repository select and join, so
     * deleted tickets disappear from every read path without per-query changes.
     */
    @DeleteDateColumn()
    deletedAt: Date;
}

