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

    @Column({ type: 'varchar', length: 100, nullable: true })
    occurrenceId?: string | null; // Zoom API Occurrence ID for recurring meeting occurrences

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

    @Column({ type: 'text', nullable: true })
    recordingUrl?: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    recordingPasscode?: string | null;

    @Column({ type: 'int', nullable: true })
    recordingDuration?: number | null; // Duration in minutes

    @Column({ type: 'jsonb', nullable: true })
    recordingFiles?: Array<any> | null;

    @Column({ type: 'timestamp', nullable: true })
    recordedAt?: Date | null;

    @CreateDateColumn()
    createdAt: Date;
}
