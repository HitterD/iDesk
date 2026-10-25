import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { CsiResponse } from './csi-response.entity';
import { CsiPeriodRatee } from './csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from './csi-period-ratee-dimension.entity';
import { CSI_SCORE_MIN, CSI_SCORE_MAX } from '../csi.constants';

@Entity('csi_response_items')
@Index('UQ_csi_response_items_response_dimension', ['responseId', 'periodRateeDimensionId'], { unique: true })
@Check('CHK_csi_response_items_score', `"score" BETWEEN ${CSI_SCORE_MIN} AND ${CSI_SCORE_MAX}`)
export class CsiResponseItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    responseId: string;

    @ManyToOne(() => CsiResponse, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'responseId' })
    response: CsiResponse;

    @Column({ type: 'uuid' })
    periodRateeId: string;

    @ManyToOne(() => CsiPeriodRatee, { nullable: false })
    @JoinColumn({ name: 'periodRateeId' })
    periodRatee: CsiPeriodRatee;

    @Column({ type: 'uuid' })
    periodRateeDimensionId: string;

    @ManyToOne(() => CsiPeriodRateeDimension, { nullable: false })
    @JoinColumn({ name: 'periodRateeDimensionId' })
    periodRateeDimension: CsiPeriodRateeDimension;

    @Column({ type: 'smallint' })
    score: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
