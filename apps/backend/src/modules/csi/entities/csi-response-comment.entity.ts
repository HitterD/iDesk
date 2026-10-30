import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CsiResponse } from './csi-response.entity';
import { CsiPeriodRatee } from './csi-period-ratee.entity';
import { CSI_COMMENT_MAX } from '../csi.constants';

@Entity('csi_response_comments')
@Index('UQ_csi_response_comments_response_ratee', ['responseId', 'periodRateeId'], { unique: true })
export class CsiResponseComment {
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

    @Column({ type: 'varchar', length: CSI_COMMENT_MAX })
    comment: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
