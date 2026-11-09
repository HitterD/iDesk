import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';

/** An account allowed to read the CSI report of one HC service (HCC / HCD / HCS), across every location. */
@Entity('csi_service_report_owners')
@Index('UQ_csi_service_report_owners', ['scope', 'serviceCode', 'userId'], { unique: true })
export class CsiServiceReportOwner {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'varchar', length: 10 })
    serviceCode: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}
