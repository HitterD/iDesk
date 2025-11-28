import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Notification } from './notification.entity';

export enum DeliveryChannel {
    IN_APP = 'IN_APP',
    EMAIL = 'EMAIL',
    TELEGRAM = 'TELEGRAM',
    PUSH = 'PUSH',
    SMS = 'SMS',
}

export enum DeliveryStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
    BOUNCED = 'BOUNCED',
}

@Entity('notification_logs')
@Index(['notificationId'])
@Index(['channel', 'status'])
@Index(['createdAt'])
export class NotificationLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    notificationId: string;

    @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'notificationId' })
    notification: Notification;

    @Column({
        type: 'enum',
        enum: DeliveryChannel,
    })
    channel: DeliveryChannel;

    @Column({
        type: 'enum',
        enum: DeliveryStatus,
        default: DeliveryStatus.PENDING,
    })
    status: DeliveryStatus;

    @Column({ nullable: true })
    recipient: string; // email address, chat ID, device token, etc.

    @Column({ nullable: true })
    externalMessageId: string; // Message ID from external service (e.g., email provider)

    @Column({ nullable: true })
    errorMessage: string;

    @Column({ type: 'int', default: 0 })
    retryCount: number;

    @Column({ nullable: true })
    sentAt: Date;

    @Column({ nullable: true })
    deliveredAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
