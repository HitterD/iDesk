import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiPeriod } from './csi-period.entity';
import { CsiDepartment } from './csi-department.entity';

@Entity('csi_responses')
@Index('UQ_csi_responses_period_respondent', ['periodId', 'respondentId'], { unique: true })
export class CsiResponse {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, { nullable: false })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'uuid' })
    respondentId: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'respondentId' })
    respondent: User;

    @Column({ type: 'uuid' })
    departmentId: string;

    @ManyToOne(() => CsiDepartment, { nullable: false })
    @JoinColumn({ name: 'departmentId' })
    department: CsiDepartment;

    @Column({ type: 'varchar', length: 100 })
    departmentName: string;

    @Column({ type: 'timestamptz' })
    submittedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
