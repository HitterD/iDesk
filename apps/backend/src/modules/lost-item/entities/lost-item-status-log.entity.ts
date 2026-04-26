import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LostItemReport } from './lost-item-report.entity';

@Entity('lost_item_status_logs')
export class LostItemStatusLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    lostItemReportId: string;

    @ManyToOne(() => LostItemReport)
    @JoinColumn({ name: 'lost_item_report_id' })
    lostItemReport: LostItemReport;

    @Column({ type: 'varchar', nullable: true })
    fromStatus: string | null;

    @Column()
    toStatus: string;

    @Column({ type: 'uuid', nullable: true })
    changedById: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'changed_by_id' })
    changedBy: User | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    timestamp: Date;
}
