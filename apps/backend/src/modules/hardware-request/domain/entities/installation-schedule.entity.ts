import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
    ManyToOne, JoinColumn, Index, OneToMany,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';
import { InstallStatus } from '../enums/install-status.enum';
import { InstallationScheduleItem } from './installation-schedule-item.entity';

@Entity('installation_schedules')
@Index(['technicianId', 'scheduledStart'])
@Index(['status', 'scheduledStart'])
@Index(['requestId'])
export class InstallationSchedule {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) requestId: string;
    @ManyToOne(() => HardwareRequest, (req) => req.schedules, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' }) request: HardwareRequest;

    @Column({ type: 'uuid' }) technicianId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'technicianId' }) technician: User;

    @Column({ type: 'timestamptz', nullable: true }) scheduledStart: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) scheduledEnd: Date | null;

    @Column({ type: 'enum', enum: InstallStatus, enumName: 'install_status_enum', default: InstallStatus.PROPOSED })
    status: InstallStatus;

    @Column({ type: 'uuid' }) proposedBy: string;
    @Column({ type: 'uuid', nullable: true }) confirmedBy: string | null;

    @Column({ type: 'text', nullable: true }) locationDetail: string | null;
    @Column({ type: 'text', nullable: true }) rescheduleReason: string | null;

    @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    proposedSlots?: Array<{ start: string; end: string }> | null;

    @Column({ type: 'timestamptz', nullable: true })
    selectedSlotAt?: Date | null;

    @Column({ type: 'int', default: 0 })
    rescheduleCount: number;

    @OneToMany(() => InstallationScheduleItem, (item) => item.schedule, { cascade: true })
    items: InstallationScheduleItem[];

    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
    @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
