import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { ZoomBooking } from './zoom-booking.entity';

@Entity('zoom_participants')
export class ZoomParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    zoomBookingId: string;

    @ManyToOne(() => ZoomBooking, (booking) => booking.participants)
    @JoinColumn({ name: 'zoomBookingId' })
    booking: ZoomBooking;

    @Column()
    email: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    name: string;

    @Column({ default: false })
    isExternal: boolean;

    @Column({ default: false })
    emailSent: boolean;

    @Column({ type: 'timestamp', nullable: true })
    emailSentAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
