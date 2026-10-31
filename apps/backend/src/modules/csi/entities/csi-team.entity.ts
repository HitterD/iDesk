import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';

@Entity('csi_teams')
@Unique('UQ_csi_teams_scope_site', ['scope', 'siteId'])
export class CsiTeam {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'uuid' })
    siteId: string;

    @ManyToOne(() => Site, { nullable: false })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', nullable: true })
    photoUrl: string | null;

    @Column({ type: 'varchar', length: 90, nullable: true })
    tagline: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    jobTitle: string | null;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
