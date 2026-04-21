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
