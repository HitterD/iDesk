import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CsiPeriod } from './csi-period.entity';

@Entity('csi_period_raters')
@Index('UQ_csi_period_raters_period_user', ['periodId', 'userId'], { unique: true })
export class CsiPeriodRater {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
