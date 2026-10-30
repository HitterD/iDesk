import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { CsiPeriod } from './csi-period.entity';
import { CsiPeriodRater } from './csi-period-rater.entity';
import { CsiPeriodRatee } from './csi-period-ratee.entity';

@Entity('csi_period_rater_ratees')
@Unique('UQ_csi_period_rater_ratees_rater_ratee', ['periodRaterId', 'periodRateeId'])
export class CsiPeriodRaterRatee {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'uuid' })
    periodRaterId: string;

    @ManyToOne(() => CsiPeriodRater, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodRaterId' })
    periodRater: CsiPeriodRater;

    @Column({ type: 'uuid' })
    periodRateeId: string;

    @ManyToOne(() => CsiPeriodRatee, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodRateeId' })
    periodRatee: CsiPeriodRatee;
}
