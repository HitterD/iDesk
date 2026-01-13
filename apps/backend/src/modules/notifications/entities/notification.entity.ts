import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Category for notification segregation (Tickets vs Renewals vs Hardware vs Zoom)
export enum NotificationCategory {
    CATEGORY_TICKET = 'CATEGORY_TICKET',
    CATEGORY_RENEWAL = 'CATEGORY_RENEWAL',
    CATEGORY_HARDWARE = 'CATEGORY_HARDWARE',
    CATEGORY_ZOOM = 'CATEGORY_ZOOM',
}

export enum NotificationType {
    // Ticket-related notifications
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_ASSIGNED = 'TICKET_ASSIGNED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    TICKET_RESOLVED = 'TICKET_RESOLVED',
    TICKET_CANCELLED = 'TICKET_CANCELLED',
    TICKET_REPLY = 'TICKET_REPLY',
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

    // Hardware installation notifications
    HARDWARE_INSTALL_D1 = 'HARDWARE_INSTALL_D1',  // 1 day before
    HARDWARE_INSTALL_D0 = 'HARDWARE_INSTALL_D0',  // Day of installation

    // Zoom booking notifications
    ZOOM_BOOKING_CONFIRMED = 'ZOOM_BOOKING_CONFIRMED',
    ZOOM_BOOKING_CANCELLED = 'ZOOM_BOOKING_CANCELLED',
    ZOOM_BOOKING_REMINDER = 'ZOOM_BOOKING_REMINDER',

    // VPN access expiry notifications
    VPN_EXPIRY_D60 = 'VPN_EXPIRY_D60',
    VPN_EXPIRY_D30 = 'VPN_EXPIRY_D30',
    VPN_EXPIRY_D7 = 'VPN_EXPIRY_D7',
    VPN_EXPIRY_D1 = 'VPN_EXPIRY_D1',
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

    @Column({ nullable: true })
    ticketId?: string;

    // Generic reference ID for any entity (renewal contracts, etc.)
    @Index('idx_notification_reference')
    @Column({ type: 'uuid', nullable: true })
    referenceId?: string;

    @Column({ nullable: true })
    link?: string;

    @Column({ default: false })
    isRead: boolean;

    // === CRITICAL NOTIFICATION ACKNOWLEDGMENT ===
    // If true, must be acknowledged via fullscreen modal
    @Column({ default: false })
    requiresAcknowledge: boolean;

    @Column({ type: 'timestamp', nullable: true })
    acknowledgedAt?: Date;

    @Column({ nullable: true })
    acknowledgedById?: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'acknowledgedById' })
    acknowledgedBy?: User;

    @CreateDateColumn()
    createdAt: Date;
}
