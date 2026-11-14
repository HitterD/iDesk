import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiPeriod } from './csi-period.entity';

export type DraftAnswerValue = number | string;
export type DraftAnswers = Record<string, Record<string, DraftAnswerValue>>;
export type DraftComments = Record<string, string>;

@Entity('csi_response_drafts')
@Index('UQ_csi_response_drafts_period_respondent', ['periodId', 'respondentId'], { unique: true })
@Index('IDX_csi_response_drafts_respondent', ['respondentId'])
export class CsiResponseDraft {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'uuid' })
    respondentId: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'respondentId' })
    respondent: User;

    @Column({ type: 'uuid', nullable: true })
    departmentId: string | null;

    @Column({ type: 'int', default: 0 })
    position: number;

    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    answers: DraftAnswers;

    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    comments: DraftComments;

    @Column({ type: 'jsonb', nullable: true })
    picks: string[] | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
