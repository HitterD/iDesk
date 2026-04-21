import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { ZoomBooking } from './zoom-booking.entity';

@Entity('zoom_meetings')
export class ZoomMeeting {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    zoomBookingId: string;

    @OneToOne(() => ZoomBooking, (booking) => booking.meeting)
    @JoinColumn({ name: 'zoomBookingId' })
    booking: ZoomBooking;

    @Column({ type: 'bigint' })
    zoomMeetingId: string; // Zoom API Meeting ID

    @Column({ type: 'text' })
    joinUrl: string;

    @Column({ type: 'text' })
    startUrl: string; // Host start URL

    @Column({ type: 'varchar', length: 20, nullable: true })
    password: string;

    @Column({ type: 'jsonb', nullable: true })
    meetingSettings: Record<string, any>;

    @Column({ type: 'text', nullable: true })
    hostEmail: string;

    @CreateDateColumn()
    createdAt: Date;
}
