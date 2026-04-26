import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LostItemReport } from './lost-item-report.entity';

export enum FoundClaimStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    RETURNED = 'RETURNED',
    REJECTED = 'REJECTED',
}

@Entity('found_item_claims')
export class FoundItemClaim {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    finderId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'finder_id' })
    finder: User;

    @Column({ type: 'uuid', nullable: true })
    lostItemReportId: string | null;

    @ManyToOne(() => LostItemReport, { nullable: true })
    @JoinColumn({ name: 'lost_item_report_id' })
    lostItemReport: LostItemReport | null;

    @Column('text')
    locationFound: string;

    @Column()
    foundAt: Date;

    @Column('text')
    description: string;

    @Column({ type: 'text', array: true, default: [] })
    photoUrls: string[];

    @Column({ type: 'varchar', default: FoundClaimStatus.PENDING })
    status: FoundClaimStatus;

    @Column({ type: 'text', nullable: true })
    managerNotes: string | null;

    @Column({ type: 'uuid', nullable: true })
    matchedById: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'matched_by_id' })
    matchedBy: User | null;

    @Column({ type: 'timestamp', nullable: true })
    matchedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
