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

export interface TelegramPreferences {
    notifyNewReply: boolean;
    notifyStatusChange: boolean;
    notifySlaWarning: boolean;
    quietHoursStart?: string; // "22:00"
    quietHoursEnd?: string;   // "07:00"
}

@Entity('telegram_sessions')
export class TelegramSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    telegramId: string;

    @Column({ type: 'varchar', nullable: true })
    telegramUsername: string;

    @Column({ type: 'varchar', nullable: true })
    telegramFirstName: string;

    @Column({ type: 'bigint' })
    chatId: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ default: 'IDLE' })
    state: string;

    @Column({ type: 'jsonb', nullable: true })
    stateData: any | null;

    @Column({ type: 'timestamp', nullable: true })
    linkedAt: Date | null;

    // Active ticket for chat mode - enables continuous conversation
    @Column({ type: 'varchar', nullable: true })
    activeTicketId: string | null;

    // Track last activity for session management
    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt: Date;

    // NEW FIELDS (V7 Redesign)
    @Column({ default: 'id' })
    language: string; // 'id' | 'en'

    @Column({ default: true })
    notificationsEnabled: boolean;

    @Column({ 
        type: 'jsonb', 
        default: '{"notifyNewReply": true, "notifyStatusChange": true, "notifySlaWarning": true}' 
    })
    preferences: TelegramPreferences;

    @Column({ type: 'jsonb', default: '[]' })
    quickReplies: string[]; // Saved quick reply templates

    @Column({ default: 0 })
    ticketsCreated: number;

    @Column({ default: 0 })
    messagesCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
