import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';

/**
 * A rated PIC of a service (HC: HCC / HCD / HCS staff), keyed by NIK. No iDesk account is needed; when one exists with
 * the same NIK it is linked (so the person never rates themself). Imported from the directory, editable by HC admins.
 */
@Entity('csi_pics')
@Index('UQ_csi_pics_scope_nik', ['scope', 'nik'], { unique: true })
export class CsiPic {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'varchar', length: 20 })
    nik: string;

    @Column({ type: 'varchar', length: 150 })
    fullName: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    /** Layanan (HCC / HCD / HCS). */
    @Column({ type: 'varchar', length: 10 })
    serviceCode: string;

    /** Normalised bagian. */
    @Column({ type: 'varchar', length: 150, nullable: true })
    bagian: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    workLocation: string | null;

    @Column({ type: 'uuid', nullable: true })
    siteId: string | null;

    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User | null;

    @Column({ type: 'varchar', nullable: true })
    photoUrl: string | null;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
