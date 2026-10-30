import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Site } from '../../sites/entities/site.entity';
import { CsiPeriod } from './csi-period.entity';

/** Sites a period covers; a survey may span several sites. */
@Entity('csi_period_sites')
@Index('UQ_csi_period_sites_period_site', ['periodId', 'siteId'], { unique: true })
export class CsiPeriodSite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    periodId: string;

    @ManyToOne(() => CsiPeriod, (period) => period.sites, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'periodId' })
    period: CsiPeriod;

    @Column({ type: 'uuid' })
    siteId: string;

    @ManyToOne(() => Site, { nullable: false })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @CreateDateColumn()
    createdAt: Date;
}
