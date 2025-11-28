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

@Entity('telegram_sessions')
export class TelegramSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    telegramId: string;

    @Column({ nullable: true })
    telegramUsername: string;

    @Column({ nullable: true })
    telegramFirstName: string;

    @Column({ type: 'bigint' })
    chatId: string;

    @Column({ nullable: true })
    userId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ default: 'IDLE' })
    state: string;

    @Column({ type: 'jsonb', nullable: true })
    stateData: any;

    @Column({ nullable: true })
    linkedAt: Date;

    // Active ticket for chat mode - enables continuous conversation
    @Column({ nullable: true })
    activeTicketId: string;

    // Track last activity for session management
    @Column({ nullable: true })
    lastActivityAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
