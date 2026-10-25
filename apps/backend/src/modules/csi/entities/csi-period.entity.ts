import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { CsiRespondentMode } from '../csi.constants';

@Entity('csi_periods')
@Index('IDX_csi_periods_scope_site_start', ['scope', 'siteId', 'startDate'])
export class CsiPeriod {
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
    title: string;

    @Column({ type: 'text' })
    intro: string;

    @Column({ type: 'text' })
    thankYou: string;

    @Column({ type: 'date' })
    startDate: string;

    @Column({ type: 'date' })
    endDate: string;

    @Column({ type: 'varchar', length: 10 })
    respondentMode: CsiRespondentMode;

    @Column({ type: 'uuid' })
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
