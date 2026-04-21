import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Category for notification segregation (Tickets vs Renewals vs Hardware vs Zoom)
export enum NotificationCategory {
    CATEGORY_TICKET = 'CATEGORY_TICKET',
    CATEGORY_RENEWAL = 'CATEGORY_RENEWAL',
    CATEGORY_HARDWARE = 'CATEGORY_HARDWARE',
    CATEGORY_ZOOM = 'CATEGORY_ZOOM',
    CATEGORY_EFORM = 'CATEGORY_EFORM',
}

export enum NotificationType {
    // Ticket-related notifications
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_ASSIGNED = 'TICKET_ASSIGNED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    TICKET_RESOLVED = 'TICKET_RESOLVED',
    TICKET_CANCELLED = 'TICKET_CANCELLED',
    TICKET_REPLY = 'TICKET_REPLY',
    CHAT_MESSAGE_RECEIVED = 'CHAT_MESSAGE_RECEIVED',
    MENTION = 'MENTION',
    SLA_WARNING = 'SLA_WARNING',
    SLA_BREACHED = 'SLA_BREACHED',
    SYSTEM = 'SYSTEM',

    // Renewal-related notifications
    RENEWAL_D60_WARNING = 'RENEWAL_D60_WARNING',
    RENEWAL_D30_WARNING = 'RENEWAL_D30_WARNING',
    RENEWAL_D7_WARNING = 'RENEWAL_D7_WARNING',
    RENEWAL_D1_WARNING = 'RENEWAL_D1_WARNING',
    RENEWAL_EXPIRED = 'RENEWAL_EXPIRED',

    // Hardware Request notifications
    HARDWARE_REQUEST_SUBMITTED = 'HARDWARE_REQUEST_SUBMITTED',
    HARDWARE_REQUEST_APPROVED = 'HARDWARE_REQUEST_APPROVED',
    HARDWARE_REQUEST_APPROVED_PROC = 'HARDWARE_REQUEST_APPROVED_PROC',
    HARDWARE_REQUEST_REJECTED = 'HARDWARE_REQUEST_REJECTED',
    HARDWARE_REQUEST_CANCELLED = 'HARDWARE_REQUEST_CANCELLED',
    HARDWARE_REQUEST_PROC_DONE = 'HARDWARE_REQUEST_PROC_DONE',
    HARDWARE_REQUEST_PROC_DONE_TECH = 'HARDWARE_REQUEST_PROC_DONE_TECH',
    HARDWARE_REQUEST_SCHEDULE_PROPOSED = 'HARDWARE_REQUEST_SCHEDULE_PROPOSED',
    HARDWARE_REQUEST_SCHEDULE_CONFIRMED = 'HARDWARE_REQUEST_SCHEDULE_CONFIRMED',
    HARDWARE_REQUEST_SCHEDULE_RESCHEDULED = 'HARDWARE_REQUEST_SCHEDULE_RESCHEDULED',
    HARDWARE_REQUEST_INSTALL_STARTED = 'HARDWARE_REQUEST_INSTALL_STARTED',
    HARDWARE_REQUEST_COMPLETED = 'HARDWARE_REQUEST_COMPLETED',
    HARDWARE_REQUEST_COMPLETED_LEAD = 'HARDWARE_REQUEST_COMPLETED_LEAD',
    HARDWARE_REQUEST_COMMENTED = 'HARDWARE_REQUEST_COMMENTED',

    // Zoom booking notifications
    ZOOM_BOOKING_CONFIRMED = 'ZOOM_BOOKING_CONFIRMED',
    ZOOM_BOOKING_CANCELLED = 'ZOOM_BOOKING_CANCELLED',
    ZOOM_BOOKING_REMINDER = 'ZOOM_BOOKING_REMINDER',

    // VPN access expiry notifications
    VPN_EXPIRY_D60 = 'VPN_EXPIRY_D60',
    VPN_EXPIRY_D30 = 'VPN_EXPIRY_D30',
    VPN_EXPIRY_D7 = 'VPN_EXPIRY_D7',
    VPN_EXPIRY_D1 = 'VPN_EXPIRY_D1',

    // E-Form Access notifications
    EFORM_SUBMITTED = 'EFORM_SUBMITTED',
    EFORM_MANAGER1_APPROVED = 'EFORM_MANAGER1_APPROVED',
    EFORM_MANAGER2_APPROVED = 'EFORM_MANAGER2_APPROVED',
    EFORM_ICT_CONFIRMED = 'EFORM_ICT_CONFIRMED',
    EFORM_REJECTED = 'EFORM_REJECTED',
    EFORM_CREDENTIALS_READY = 'EFORM_CREDENTIALS_READY',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
@Index(['userId', 'requiresAcknowledge', 'acknowledgedAt'])
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({
        type: 'enum',
        enum: NotificationType,
        default: NotificationType.SYSTEM,
    })
    type: NotificationType;

    // Category for filtering (Tickets vs Renewals)
    @Index('idx_notification_category')
    @Column({
        type: 'enum',
        enum: NotificationCategory,
        default: NotificationCategory.CATEGORY_TICKET,
    })
    category: NotificationCategory;

    @Column()
    title: string;

    @Column('text')
    message: string;

    @Column({ type: 'varchar', nullable: true })
    ticketId?: string;

    // Generic reference ID for any entity (renewal contracts, etc.)
    @Index('idx_notification_reference')
    @Column({ type: 'uuid', nullable: true })
    referenceId?: string;

    @Column({ type: 'varchar', nullable: true })
    link?: string;

    @Column({ default: false })
    isRead: boolean;

    // === CRITICAL NOTIFICATION ACKNOWLEDGMENT ===
    // If true, must be acknowledged via fullscreen modal
    @Column({ default: false })
    requiresAcknowledge: boolean;

    @Column({ type: 'timestamp', nullable: true })
    acknowledgedAt?: Date;

    @Column({ type: 'varchar', nullable: true })
    acknowledgedById?: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'acknowledgedById' })
    acknowledgedBy?: User;

    @CreateDateColumn()
    createdAt: Date;
}
