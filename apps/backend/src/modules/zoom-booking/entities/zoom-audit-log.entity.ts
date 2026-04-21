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

    @Column({ type: 'varchar', nullable: true })
    zoomBookingId: string | null;

    @ManyToOne(() => ZoomBooking, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'zoomBookingId' })
    booking: ZoomBooking;

    @Column({ type: 'varchar', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ length: 50 })
    action: string; // CREATED, CANCELLED, MODIFIED, SETTINGS_CHANGED

    @Column({ type: 'jsonb', nullable: true })
    oldValues: Record<string, any> | null;

    @Column({ type: 'jsonb', nullable: true })
    newValues: Record<string, any> | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress: string | null;

    @Column({ type: 'text', nullable: true })
    userAgent: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
