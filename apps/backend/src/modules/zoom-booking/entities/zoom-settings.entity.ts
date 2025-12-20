import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
} from 'typeorm';

@Entity('zoom_settings')
export class ZoomSettings {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int', default: 60 })
    defaultDurationMinutes: number; // 30, 60, 90, 120

    @Column({ type: 'int', default: 30 })
    advanceBookingDays: number; // Max days ahead for booking

    @Column({ type: 'time', default: '08:00' })
    slotStartTime: string; // Business hours start

    @Column({ type: 'time', default: '18:00' })
    slotEndTime: string; // Business hours end

    @Column({ type: 'int', default: 30 })
    slotIntervalMinutes: number; // 30 min slots

    @Column({ type: 'jsonb', default: '[]' })
    blockedDates: string[]; // Array of date strings (holidays)

    @Column({ type: 'jsonb', default: '[1,2,3,4,5]' })
    workingDays: number[]; // 0=Sunday, 1=Monday, etc.

    @Column({ default: false })
    requireDescription: boolean;

    @Column({ type: 'int', default: 5 })
    maxBookingPerUserPerDay: number;

    @Column({ type: 'jsonb', default: '[30, 60, 90, 120]' })
    allowedDurations: number[]; // Available duration options in minutes

    @UpdateDateColumn()
    updatedAt: Date;
}
