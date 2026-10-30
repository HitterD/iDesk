import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiRateeKind } from '../csi.constants';
import { CsiPeriod } from './csi-period.entity';

@Entity('csi_period_ratees')
@Index('UQ_csi_period_ratees_period_user', ['periodId', 'userId'], { unique: true })
@Index('UQ_csi_period_ratees_team', ['periodId'], { unique: true, where: `"kind" = 'TEAM'` })
export class CsiPeriodRatee {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'varchar', length: 10, default: CsiRateeKind.PERSON })
    kind: CsiRateeKind;

    /** Null only for the TEAM ratee. */
    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User | null;

    @Column({ type: 'varchar', length: 150 })
    displayName: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    @Column({ type: 'int' })
    sortOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
