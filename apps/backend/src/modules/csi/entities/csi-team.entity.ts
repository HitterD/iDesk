import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { CsiTeamKind } from '../csi.constants';

@Entity('csi_teams')
@Index('UQ_csi_teams_site_kind', ['scope', 'siteId'], { unique: true, where: `"kind" = 'SITE'` })
export class CsiTeam {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'varchar', length: 10, default: CsiTeamKind.SITE })
    kind: CsiTeamKind;

    @Column({ type: 'varchar', length: 10, nullable: true })
    serviceCode: string | null;

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
