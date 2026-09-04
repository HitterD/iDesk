import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationEventType {
    NEW_TICKET = 'new_ticket',
    ASSIGNED = 'assigned',
    RESOLVED = 'resolved',
    CRITICAL = 'critical',
    MESSAGE = 'message',
    SLA_WARNING = 'sla_warning',
    SLA_BREACH = 'sla_breach',
}

/**
 * Robustly normalize any input string (e.g. 'NEW_TICKET', 'new_ticket', 'new-ticket', 'New Ticket')
 * to a valid PostgreSQL/TypeORM NotificationEventType enum value.
 */
export function normalizeNotificationEventType(value: any): NotificationEventType {
    if (!value) return NotificationEventType.NEW_TICKET;
    const str = String(value).trim().toLowerCase().replace(/[-\s]/g, '_');

    // 1. Direct match with enum values (e.g. 'new_ticket')
    const directMatch = Object.values(NotificationEventType).find(
        (v) => v.toLowerCase() === str
    );
    if (directMatch) return directMatch;

    // 2. Match with enum keys (e.g. 'NEW_TICKET' -> 'new_ticket')
    const keyMatch = Object.entries(NotificationEventType).find(
        ([k]) => k.toLowerCase() === str
    );
    if (keyMatch) return keyMatch[1];

    // Fallback default
    return NotificationEventType.NEW_TICKET;
}

@Entity('notification_sounds')
export class NotificationSound {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: NotificationEventType,
    })
    eventType: NotificationEventType;

    @Column({ length: 100 })
    soundName: string;

    @Column()
    soundUrl: string; // /uploads/sounds/custom.mp3 or /sounds/default/xxx.mp3

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'varchar', nullable: true })
    uploadedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'uploadedById' })
    uploadedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
