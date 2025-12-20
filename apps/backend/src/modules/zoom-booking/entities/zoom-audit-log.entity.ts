import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ZoomBooking } from './zoom-booking.entity';
import { User } from '../../users/entities/user.entity';

@Entity('zoom_audit_logs')
@Index(['zoomBookingId'])
@Index(['userId'])
@Index(['createdAt'])
export class ZoomAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    zoomBookingId: string;

    @ManyToOne(() => ZoomBooking, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'zoomBookingId' })
    booking: ZoomBooking;

    @Column()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ length: 50 })
    action: string; // CREATED, CANCELLED, MODIFIED, SETTINGS_CHANGED

    @Column({ type: 'jsonb', nullable: true })
    oldValues: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    newValues: Record<string, any>;

    @Column({ length: 45, nullable: true })
    ipAddress: string;

    @Column({ type: 'text', nullable: true })
    userAgent: string;

    @CreateDateColumn()
    createdAt: Date;
}
