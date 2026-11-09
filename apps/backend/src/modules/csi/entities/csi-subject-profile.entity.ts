import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';

@Entity('csi_subject_profiles')
@Unique('UQ_csi_subject_profiles_scope_user', ['scope', 'userId'])
export class CsiSubjectProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', nullable: true })
    photoUrl: string | null;

    @Column({ type: 'varchar', length: 90, nullable: true })
    tagline: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    /** Fungsi pelayanan shown on the rating card (ICT agents; snapshotted onto the period ratee). */
    @Column({ type: 'varchar', length: 150, nullable: true })
    serviceFunction: string | null;

    /**
     * Picked by hand as a subject of the scope. HC has no staff roles of its own, so its people are exactly the
     * members; ICT people come from the ICT roles and ignore this flag.
     */
    @Column({ type: 'boolean', default: false })
    isMember: boolean;
}
