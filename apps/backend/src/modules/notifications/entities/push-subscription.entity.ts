import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('push_subscriptions')
@Index(['userId'])
@Index(['endpoint'], { unique: true })
export class PushSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    // The push service endpoint URL
    @Column('text')
    endpoint: string;

    // Encryption key for push messages
    @Column('text')
    p256dh: string;

    // Auth secret for push messages
    @Column('text')
    auth: string;

    // User agent for device identification
    @Column({ type: 'varchar', nullable: true })
    userAgent: string;

    // Device name/label for display
    @Column({ type: 'varchar', nullable: true })
    deviceName: string;

    // Whether this subscription is active
    @Column({ default: true })
    isActive: boolean;

    // Track last successful push
    @Column({ type: 'timestamp', nullable: true })
    lastPushAt: Date;

    // Track failed attempts for cleanup
    @Column({ default: 0 })
    failedAttempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
