import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Business Hours Configuration Entity
 * Used for accurate SLA calculation considering working hours and holidays
 */
@Entity('business_hours')
export class BusinessHours {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ default: 'default' })
    name: string;

    @Column({ default: true })
    isDefault: boolean;

    // Days of week (0 = Sunday, 6 = Saturday)
    // Default: Mon-Fri [1, 2, 3, 4, 5]
    @Column('simple-json', { default: '[1,2,3,4,5]' })
    workDays: number[];

    // Time in minutes from midnight
    // Default: 8:00 AM = 480 minutes
    @Column({ type: 'int', default: 480 })
    startTime: number;

    // Default: 5:00 PM = 1020 minutes
    @Column({ type: 'int', default: 1020 })
    endTime: number;

    @Column({ default: 'Asia/Jakarta' })
    timezone: string;

    // Indonesian National Holidays for 2025
    @Column('simple-json', { nullable: true, default: '[]' })
    holidays: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
