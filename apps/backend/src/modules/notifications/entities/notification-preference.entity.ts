import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum DigestFrequency {
    REALTIME = 'REALTIME',
    HOURLY = 'HOURLY',
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
}

@Entity('notification_preferences')
@Index(['userId'], { unique: true })
export class NotificationPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    // =====================
    // Channel Toggles
    // =====================

    @Column({ default: true })
    inAppEnabled: boolean;

    @Column({ default: true })
    emailEnabled: boolean;

    @Column({ default: false })
    telegramEnabled: boolean;

    @Column({ default: false })
    pushEnabled: boolean;

    // =====================
    // Contact Information
    // =====================

    @Column({ nullable: true })
    emailAddress: string;

    @Column({ nullable: true })
    telegramChatId: string;

    @Column('simple-array', { nullable: true })
    pushTokens: string[];

    // =====================
    // Digest Settings
    // =====================

    @Column({ default: false })
    digestEnabled: boolean;

    @Column({
        type: 'enum',
        enum: DigestFrequency,
        default: DigestFrequency.REALTIME,
    })
    digestFrequency: DigestFrequency;

    @Column({ nullable: true })
    digestTime: string; // HH:mm format - when to send daily/weekly digest

    // =====================
    // Type-specific Settings
    // =====================
    // JSON object mapping notification types to channel preferences
    // e.g., { "TICKET_ASSIGNED": { "email": true, "telegram": true }, "MENTION": { "email": true } }
    @Column('jsonb', { default: {} })
    typeSettings: Record<string, Record<string, boolean>>;

    // =====================
    // Quiet Hours (Do Not Disturb)
    // =====================

    @Column({ default: false })
    quietHoursEnabled: boolean;

    @Column({ nullable: true })
    quietHoursStart: string; // HH:mm format

    @Column({ nullable: true })
    quietHoursEnd: string; // HH:mm format

    @Column({ nullable: true })
    timezone: string; // e.g., 'Asia/Jakarta'

    // =====================
    // Timestamps
    // =====================

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
