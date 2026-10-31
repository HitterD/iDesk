import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CsiPeriodRatee } from './csi-period-ratee.entity';
import { CsiDimension } from './csi-dimension.entity';
import { CsiOption, CsiQuestionType } from '../csi.constants';

@Entity('csi_period_ratee_dimensions')
@Index('UQ_csi_period_ratee_dimensions_ratee_dimension', ['periodRateeId', 'dimensionId'], { unique: true })
export class CsiPeriodRateeDimension {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodRateeId: string;

    @ManyToOne(() => CsiPeriodRatee, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodRateeId' })
    periodRatee: CsiPeriodRatee;

    @Column({ type: 'uuid' })
    dimensionId: string;

    @ManyToOne(() => CsiDimension, { nullable: false })
    @JoinColumn({ name: 'dimensionId' })
    dimension: CsiDimension;

    @Column({ type: 'varchar', length: 300 })
    dimensionName: string;

    @Column({ type: 'varchar', length: 40, nullable: true })
    shortLabel: string | null;

    // Snapshot of the question definition at assignment time.
    @Column({ type: 'varchar', length: 10, default: CsiQuestionType.STAR })
    type: CsiQuestionType;

    @Column({ default: true })
    required: boolean;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    options: CsiOption[];

    @Column({ type: 'int' })
    sortOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
