import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { ZoomAccountType } from '../enums/booking-status.enum';
import { ZoomBooking } from './zoom-booking.entity';

@Entity('zoom_accounts')
@Index(['displayOrder'])
@Index(['isActive'])
export class ZoomAccount {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 50 })
    name: string; // "Zoom 1", "Zoom 2", etc.

    @Column({ unique: true })
    email: string; // zoom1@company.com

    @Column({ nullable: true })
    zoomUserId: string; // Zoom API User ID

    @Column({
        type: 'enum',
        enum: ZoomAccountType,
        default: ZoomAccountType.SUB,
    })
    accountType: ZoomAccountType;

    @Column({ type: 'int', default: 1 })
    displayOrder: number; // 1-10 for sorting

    @Column({ length: 7, default: '#3B82F6' })
    colorHex: string; // Color for calendar display

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'text', nullable: true })
    description: string;

    @OneToMany(() => ZoomBooking, (booking) => booking.zoomAccount)
    bookings: ZoomBooking[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
