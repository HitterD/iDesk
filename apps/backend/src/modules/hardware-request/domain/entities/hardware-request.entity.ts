// apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    VersionColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Site } from '../../../sites/entities/site.entity';
import { RequestStatus } from '../enums/request-status.enum';
import { HardwareRequestItem } from './hardware-request-item.entity';
import { InstallationSchedule } from './installation-schedule.entity';

@Entity('hardware_requests')
@Index(['status', 'createdAt'])
@Index(['requesterId', 'createdAt'])
export class HardwareRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 32, unique: true })
    requestNumber: string;

    @Column({ type: 'uuid' })
    requesterId: string;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'requesterId' })
    requester: User;

    @Column({ type: 'uuid', nullable: true })
    recipientId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'recipientId' })
    recipient: User | null;

    @Column({ type: 'varchar', nullable: true })
    recipientName: string | null;

    @Column({ type: 'varchar', nullable: true })
    division: string | null;

    @Column({ type: 'uuid' })
    siteId: string;

    @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @Column({ type: 'text' })
    justification: string;

    @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.DRAFT })
    status: RequestStatus;

    @Column({ type: 'timestamptz', nullable: true })
    submittedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    reviewedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    approvedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    procuredAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    installedAt: Date | null;

    @Column({ name: 'install_marked_done_at', type: 'timestamptz', nullable: true })
    installMarkedDoneAt: Date | null;

    @Column({ name: 'user_confirmed_at', type: 'timestamptz', nullable: true })
    userConfirmedAt: Date | null;

    @Column({ name: 'user_confirmation_kind', type: 'varchar', length: 16, nullable: true })
    userConfirmationKind: 'ACCEPT_AS_IS' | 'REPORT_ISSUE' | null;

    @Column({ type: 'timestamptz', nullable: true })
    completedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    reviewedById: string | null;

    @Column({ type: 'uuid', nullable: true })
    approvedById: string | null;

    @Column({ type: 'uuid', nullable: true })
    procuredById: string | null;

    @Column({ type: 'text', nullable: true })
    rejectReason: string | null;

    @VersionColumn()
    version: number;

    @OneToMany(() => HardwareRequestItem, (item) => item.request, {
        cascade: ['insert', 'update'],
    })
    items: HardwareRequestItem[];

    @OneToMany(() => InstallationSchedule, (sched) => sched.request)
    schedules: InstallationSchedule[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
