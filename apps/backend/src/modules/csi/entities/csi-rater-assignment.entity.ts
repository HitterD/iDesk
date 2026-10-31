import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';

@Entity('csi_rater_assignments')
@Unique('UQ_csi_rater_assignments_scope_rater_subject', ['scope', 'raterUserId', 'subjectKey'])
export class CsiRaterAssignment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'uuid' })
    raterUserId: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'raterUserId' })
    raterUser: User;

    @Column({ type: 'varchar', length: 41 })
    subjectKey: string;
}
