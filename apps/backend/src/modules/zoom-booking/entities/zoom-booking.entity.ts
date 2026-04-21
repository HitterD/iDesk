import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { BookingStatus } from '../enums/booking-status.enum';
import { ZoomAccount } from './zoom-account.entity';
import { ZoomMeeting } from './zoom-meeting.entity';
import { ZoomParticipant } from './zoom-participant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('zoom_bookings')
@Index(['zoomAccountId', 'bookingDate', 'startTime'], { unique: true })
@Index(['bookedByUserId'])
@Index(['bookingDate'])
@Index(['status'])
export class ZoomBooking {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    zoomAccountId: string;

    @ManyToOne(() => ZoomAccount, (account) => account.bookings)
    @JoinColumn({ name: 'zoomAccountId' })
    zoomAccount: ZoomAccount;

    @Column({ type: 'varchar', nullable: true })
    bookedByUserId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'bookedByUserId' })
    bookedByUser: User;

    @Column({ length: 100 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'date' })
    bookingDate: Date;

    @Column({ type: 'time' })
    startTime: string; // HH:mm format

    @Column({ type: 'time' })
    endTime: string; // HH:mm format

    @Column({ type: 'int', default: 60 })
    durationMinutes: number;

    @Column({
        type: 'enum',
        enum: BookingStatus,
        default: BookingStatus.PENDING,
    })
    status: BookingStatus;

    @Column({ type: 'text', nullable: true })
    cancellationReason: string;

    @Column({ type: 'varchar', nullable: true })
    cancelledByUserId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'cancelledByUserId' })
    cancelledByUser: User;

    @Column({ type: 'timestamp', nullable: true })
    cancelledAt: Date;

    @Column({ default: false })
    isExternal: boolean; // true = synced from Zoom, not created via iDesk

    @Column({ type: 'bigint', nullable: true, unique: true })
    externalZoomMeetingId: string; // Zoom meeting ID for dedup (null = internal)

    @OneToOne(() => ZoomMeeting, (meeting) => meeting.booking, { nullable: true })
    meeting: ZoomMeeting;

    @OneToMany(() => ZoomParticipant, (participant) => participant.booking)
    participants: ZoomParticipant[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
